import shaderBody from './shaders/singularity-forge.glsl?raw'

const MAX_RENDER_PIXELS = 190_000
const QUALITY_SCALES = [0.52, 0.68, 0.84]
const QUALITY_NAMES = ['ECO', 'HIGH', 'ULTRA']

const vertexSource = `#version 300 es
precision highp float;
const vec2 POSITIONS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main() { gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0); }
`

const sceneFragmentSource = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
out vec4 outColor;
#define OUTPUT_LINEAR
${shaderBody}
void main() { mainImage(outColor, gl_FragCoord.xy); }
`

const blurFragmentSource = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uSourceTexel;
uniform vec2 uOutputResolution;
uniform vec2 uDirection;
uniform float uExtract;
out vec4 outColor;
vec3 sourceColor(vec2 uv) {
    vec3 color = texture(uSource, clamp(uv, vec2(0.0), vec2(1.0))).rgb;
    if (uExtract > 0.5) {
        float brightness = max(color.r, max(color.g, color.b));
        float strength = clamp((brightness - 0.72) / 0.72, 0.0, 1.0);
        color *= strength * strength;
    }
    return color;
}
void main() {
    vec2 uv = gl_FragCoord.xy / uOutputResolution;
    vec2 direction = uDirection * uSourceTexel;
    vec3 color = sourceColor(uv) * 0.227027027;
    color += sourceColor(uv + direction * 1.384615385) * 0.316216216;
    color += sourceColor(uv - direction * 1.384615385) * 0.316216216;
    color += sourceColor(uv + direction * 3.230769231) * 0.0702702703;
    color += sourceColor(uv - direction * 3.230769231) * 0.0702702703;
    outColor = vec4(color, 1.0);
}
`

const compositeFragmentSource = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBloomEnabled;
out vec4 outColor;
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
vec3 aces(vec3 color) {
    return clamp((color * (2.51 * color + 0.03)) /
                 (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
}
void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 centered = uv - 0.5;
    float radius2 = dot(centered, centered);
    vec2 chromaticOffset = centered * radius2 * 0.0065;

    vec3 scene;
    scene.r = texture(uScene, uv + chromaticOffset).r;
    scene.g = texture(uScene, uv).g;
    scene.b = texture(uScene, uv - chromaticOffset).b;

    vec3 bloom = texture(uBloom, uv).rgb;
    vec3 streak = texture(uBloom, uv + vec2(0.010, 0.0)).rgb
                + texture(uBloom, uv - vec2(0.010, 0.0)).rgb
                + 0.55 * (texture(uBloom, uv + vec2(0.028, 0.0)).rgb
                + texture(uBloom, uv - vec2(0.028, 0.0)).rgb);
    float centerGlow = dot(texture(uBloom, vec2(0.5)).rgb,
                           vec3(0.2126, 0.7152, 0.0722));
    vec3 flare = exp(-155.0 * abs(centered.y))
               * exp(-1.8 * abs(centered.x))
               * centerGlow * vec3(0.16, 0.32, 0.52);

    vec3 color = scene + uBloomEnabled * (0.78 * bloom + 0.085 * streak + flare);
    float vignette = pow(max(0.0, 16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y)), 0.17);
    color *= 0.50 + 0.50 * vignette;
    color += (hash12(gl_FragCoord.xy + fract(uTime) * 911.7) - 0.5)
            * 0.010 * (0.35 + length(color));
    color *= 0.990 + 0.010 * sin(gl_FragCoord.y * 1.47 + uTime * 25.0);
    color = aces(color * 1.08);
    color = pow(color, vec3(1.0 / 2.2));
    outColor = vec4(color, 1.0);
}
`

type RenderTarget = {
    texture: WebGLTexture
    framebuffer: WebGLFramebuffer
    width: number
    height: number
}

type SceneUniforms = {
    resolution: WebGLUniformLocation
    time: WebGLUniformLocation
    mouse: WebGLUniformLocation
}

type BlurUniforms = {
    source: WebGLUniformLocation
    sourceTexel: WebGLUniformLocation
    outputResolution: WebGLUniformLocation
    direction: WebGLUniformLocation
    extract: WebGLUniformLocation
}

type CompositeUniforms = {
    scene: WebGLUniformLocation
    bloom: WebGLUniformLocation
    resolution: WebGLUniformLocation
    time: WebGLUniformLocation
    bloomEnabled: WebGLUniformLocation
}

type RenderTargetOptions = {
    gl: WebGL2RenderingContext
    width: number
    height: number
    internalFormat: number
    textureType: number
    filter: number
}

type BlurOptions = {
    source: RenderTarget
    destination: RenderTarget
    directionX: number
    directionY: number
    extract: boolean
}

function compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string,
    label: string,
): WebGLShader {
    const shader = gl.createShader(type)
    if (!shader) throw new Error(`Unable to create the ${label} shader.`)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader) || 'Unknown compilation failure.'
        gl.deleteShader(shader)
        throw new Error(`${label} compilation failed: ${log}`)
    }
    return shader
}

function createProgram(
    gl: WebGL2RenderingContext,
    fragmentSource: string,
    label: string,
): WebGLProgram {
    const program = gl.createProgram()
    if (!program) throw new Error(`Unable to create the ${label} program.`)
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource, `${label} vertex`)
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, `${label} fragment`)
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program) || 'Unknown link failure.'
        gl.deleteProgram(program)
        throw new Error(`${label} link failed: ${log}`)
    }
    return program
}

function uniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
    const location = gl.getUniformLocation(program, name)
    if (!location) throw new Error(`Missing ${name} uniform.`)
    return location
}

function createRenderTarget({
    gl,
    width,
    height,
    internalFormat,
    textureType,
    filter,
}: RenderTargetOptions): RenderTarget {
    const texture = gl.createTexture()
    const framebuffer = gl.createFramebuffer()
    if (!texture || !framebuffer) throw new Error('Unable to create a bloom target.')

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, textureType, null)

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.deleteFramebuffer(framebuffer)
        gl.deleteTexture(texture)
        throw new Error('Bloom framebuffer is incomplete.')
    }
    return { texture, framebuffer, width, height }
}

function destroyRenderTarget(gl: WebGL2RenderingContext, target: RenderTarget | null): void {
    if (!target) return
    gl.deleteFramebuffer(target.framebuffer)
    gl.deleteTexture(target.texture)
}

// pi-lens-ignore: large-class
export class SingularityForgeRenderer {
    private readonly canvas: HTMLCanvasElement
    private readonly gl: WebGL2RenderingContext
    private readonly sceneProgram: WebGLProgram
    private readonly blurProgram: WebGLProgram
    private readonly compositeProgram: WebGLProgram
    private readonly sceneUniforms: SceneUniforms
    private readonly blurUniforms: BlurUniforms
    private readonly compositeUniforms: CompositeUniforms
    private readonly internalFormat: number
    private readonly textureType: number
    private readonly textureFilter: number
    private readonly resizeObserver: ResizeObserver | null
    private sceneTarget: RenderTarget | null = null
    private bloomA: RenderTarget | null = null
    private bloomB: RenderTarget | null = null
    private quality = 1
    private bloomEnabled = true
    private elapsed = 0
    private previous = performance.now()
    private mouseX = 0
    private mouseY = 0
    private mouseDown = false
    private visible = true
    private paused = false

    constructor(canvas: HTMLCanvasElement) {
        const gl = canvas.getContext('webgl2', {
            antialias: false,
            alpha: false,
            depth: false,
            stencil: false,
            powerPreference: 'high-performance',
        })
        if (!gl) throw new Error('WebGL2 is required for Singularity Forge.')

        const sceneProgram = createProgram(gl, sceneFragmentSource, 'Singularity scene')
        const blurProgram = createProgram(gl, blurFragmentSource, 'Singularity bloom')
        const compositeProgram = createProgram(gl, compositeFragmentSource, 'Singularity composite')
        const hdr = gl.getExtension('EXT_color_buffer_float')
        const linear = gl.getExtension('OES_texture_float_linear')
        this.canvas = canvas
        this.gl = gl
        this.sceneProgram = sceneProgram
        this.blurProgram = blurProgram
        this.compositeProgram = compositeProgram
        this.sceneUniforms = {
            resolution: uniform(gl, sceneProgram, 'iResolution'),
            time: uniform(gl, sceneProgram, 'iTime'),
            mouse: uniform(gl, sceneProgram, 'iMouse'),
        }
        this.blurUniforms = {
            source: uniform(gl, blurProgram, 'uSource'),
            sourceTexel: uniform(gl, blurProgram, 'uSourceTexel'),
            outputResolution: uniform(gl, blurProgram, 'uOutputResolution'),
            direction: uniform(gl, blurProgram, 'uDirection'),
            extract: uniform(gl, blurProgram, 'uExtract'),
        }
        this.compositeUniforms = {
            scene: uniform(gl, compositeProgram, 'uScene'),
            bloom: uniform(gl, compositeProgram, 'uBloom'),
            resolution: uniform(gl, compositeProgram, 'uResolution'),
            time: uniform(gl, compositeProgram, 'uTime'),
            bloomEnabled: uniform(gl, compositeProgram, 'uBloomEnabled'),
        }
        this.internalFormat = hdr ? gl.RGBA16F : gl.RGBA8
        this.textureType = hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE
        this.textureFilter = !hdr || linear ? gl.LINEAR : gl.NEAREST
        this.resizeObserver = 'ResizeObserver' in window
            ? new ResizeObserver(() => this.resize())
            : null

        this.canvas.addEventListener('pointerdown', this.handlePointerDown)
        this.canvas.addEventListener('pointermove', this.handlePointerMove)
        this.canvas.addEventListener('pointerup', this.handlePointerUp)
        this.canvas.addEventListener('pointercancel', this.handlePointerCancel)
        this.resizeObserver?.observe(this.canvas)
        window.addEventListener('resize', this.resize)
        gl.disable(gl.DEPTH_TEST)
        gl.disable(gl.CULL_FACE)
        gl.disable(gl.BLEND)
    }

    start(): void {
        this.resize()
        requestAnimationFrame(this.frame)
    }

    updateVisibility(visible: boolean): void {
        this.visible = visible
        this.previous = performance.now()
    }

    isPaused(): boolean {
        return this.paused
    }

    togglePaused(): void {
        this.paused = !this.paused
        this.previous = performance.now()
    }

    reset(): void {
        this.elapsed = 0
        this.previous = performance.now()
    }

    toggleBloom(): boolean {
        this.bloomEnabled = !this.bloomEnabled
        return this.bloomEnabled
    }

    cycleQuality(): string {
        this.quality = (this.quality + 1) % QUALITY_SCALES.length
        this.resize()
        return QUALITY_NAMES[this.quality] ?? 'ECO'
    }

    status(): string {
        return `${QUALITY_NAMES[this.quality]} · bloom ${this.bloomEnabled ? 'on' : 'off'}`
    }

    private resize = (): void => {
        const bounds = this.canvas.getBoundingClientRect()
        const cssWidth = Math.max(1, bounds.width || this.canvas.clientWidth)
        const cssHeight = Math.max(1, bounds.height || this.canvas.clientHeight)
        const qualityScale = QUALITY_SCALES[this.quality] ?? 0.68
        const deviceRatio = Math.min(window.devicePixelRatio || 1, 1.2) * qualityScale
        const pixelRatio = Math.min(deviceRatio, Math.sqrt(MAX_RENDER_PIXELS / (cssWidth * cssHeight)))
        const width = Math.max(2, Math.floor(cssWidth * pixelRatio))
        const height = Math.max(2, Math.floor(cssHeight * pixelRatio))
        if (this.canvas.width === width && this.canvas.height === height && this.sceneTarget) return

        this.canvas.width = width
        this.canvas.height = height
        destroyRenderTarget(this.gl, this.sceneTarget)
        destroyRenderTarget(this.gl, this.bloomA)
        destroyRenderTarget(this.gl, this.bloomB)
        const bloomWidth = Math.max(2, width >> 1)
        const bloomHeight = Math.max(2, height >> 1)
        const targetOptions = {
            gl: this.gl,
            internalFormat: this.internalFormat,
            textureType: this.textureType,
            filter: this.textureFilter,
        }
        this.sceneTarget = createRenderTarget({ ...targetOptions, width, height })
        this.bloomA = createRenderTarget({ ...targetOptions, width: bloomWidth, height: bloomHeight })
        this.bloomB = createRenderTarget({ ...targetOptions, width: bloomWidth, height: bloomHeight })
    }

    private updatePointer(event: PointerEvent): void {
        const bounds = this.canvas.getBoundingClientRect()
        this.mouseX = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * this.canvas.width
        this.mouseY = ((bounds.bottom - event.clientY) / Math.max(1, bounds.height)) * this.canvas.height
    }

    private handlePointerDown = (event: PointerEvent): void => {
        this.mouseDown = true
        this.updatePointer(event)
        this.canvas.setPointerCapture(event.pointerId)
    }

    private handlePointerMove = (event: PointerEvent): void => {
        if (this.mouseDown) this.updatePointer(event)
    }

    private handlePointerUp = (event: PointerEvent): void => {
        this.mouseDown = false
        if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
    }

    private handlePointerCancel = (): void => {
        this.mouseDown = false
    }

    private bindTexture(unit: number, target: RenderTarget, location: WebGLUniformLocation): void {
        this.gl.activeTexture(this.gl.TEXTURE0 + unit)
        this.gl.bindTexture(this.gl.TEXTURE_2D, target.texture)
        this.gl.uniform1i(location, unit)
    }

    private renderScene(): void {
        const target = this.sceneTarget
        if (!target) return
        const { gl } = this
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
        gl.viewport(0, 0, target.width, target.height)
        gl.useProgram(this.sceneProgram)
        gl.uniform3f(this.sceneUniforms.resolution, target.width, target.height, 1)
        gl.uniform1f(this.sceneUniforms.time, this.elapsed)
        gl.uniform4f(this.sceneUniforms.mouse, this.mouseX, this.mouseY, this.mouseDown ? 1 : 0, 0)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    private blur({ source, destination, directionX, directionY, extract }: BlurOptions): void {
        const { gl } = this
        gl.bindFramebuffer(gl.FRAMEBUFFER, destination.framebuffer)
        gl.viewport(0, 0, destination.width, destination.height)
        gl.useProgram(this.blurProgram)
        this.bindTexture(0, source, this.blurUniforms.source)
        gl.uniform2f(this.blurUniforms.sourceTexel, 1 / source.width, 1 / source.height)
        gl.uniform2f(this.blurUniforms.outputResolution, destination.width, destination.height)
        gl.uniform2f(this.blurUniforms.direction, directionX, directionY)
        gl.uniform1f(this.blurUniforms.extract, extract ? 1 : 0)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    private renderBloom(): void {
        if (!this.sceneTarget || !this.bloomA || !this.bloomB || !this.bloomEnabled) return
        this.blur({ source: this.sceneTarget, destination: this.bloomA, directionX: 1.45, directionY: 0, extract: true })
        this.blur({ source: this.bloomA, destination: this.bloomB, directionX: 0, directionY: 1.45, extract: false })
        this.blur({ source: this.bloomB, destination: this.bloomA, directionX: 1.85, directionY: 0, extract: false })
        this.blur({ source: this.bloomA, destination: this.bloomB, directionX: 0, directionY: 1.85, extract: false })
    }

    private renderComposite(): void {
        const scene = this.sceneTarget
        const bloom = this.bloomB
        if (!scene || !bloom) return
        const { gl } = this
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, this.canvas.width, this.canvas.height)
        gl.useProgram(this.compositeProgram)
        this.bindTexture(0, scene, this.compositeUniforms.scene)
        this.bindTexture(1, bloom, this.compositeUniforms.bloom)
        gl.uniform2f(this.compositeUniforms.resolution, this.canvas.width, this.canvas.height)
        gl.uniform1f(this.compositeUniforms.time, this.elapsed)
        gl.uniform1f(this.compositeUniforms.bloomEnabled, this.bloomEnabled ? 1 : 0)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    private frame = (now: number): void => {
        const delta = Math.min((now - this.previous) * 0.001, 0.1)
        this.previous = now
        if (!this.paused) this.elapsed += delta
        if (this.visible && !document.hidden) {
            this.renderScene()
            this.renderBloom()
            this.renderComposite()
        }
        requestAnimationFrame(this.frame)
    }
}
