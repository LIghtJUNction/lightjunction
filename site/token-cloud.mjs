/** Seeded geometry + a single instanced WebGL2 draw call. No network dependencies. */
export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export function smoothstep(a, b, value) { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); }
export function seededRandom(seed = 0x1a17) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function phaseAt(progress) { return progress < .29 ? 0 : progress < .7 ? 1 : 2; }
export function createTokens(count, seed = 0x1a17) {
  if (!Number.isInteger(count) || count < 1 || count > 10000) throw new RangeError('Token count must be an integer between 1 and 10000');
  const random = seededRandom(seed), data = new Float32Array(count * 13);
  // A knotted, cloud-like manifold; each point is an individually modelled token.
  for (let i = 0; i < count; i++) {
    const t = i / count * Math.PI * 2, u = random() * Math.PI * 2;
    const r = .22 + Math.sqrt(random()) * .32;
    const ring = 1.23 + .44 * Math.cos(3 * t);
    const cx = ring * Math.cos(2 * t), cy = ring * Math.sin(2 * t), cz = .5 * Math.sin(3 * t);
    const x = cx + r * Math.cos(u) * Math.cos(2 * t);
    const y = cy + r * Math.cos(u) * Math.sin(2 * t);
    const z = cz + r * Math.sin(u);
    const layer = i % 5, a = random() * Math.PI * 2, spread = Math.sqrt(random());
    // Exploded strata retain the same tokens; no replacement scene or video.
    const ex = Math.cos(a) * spread * 1.4;
    const ey = (layer - 2) * .94 + (random() - .5) * .16;
    const ez = Math.sin(a) * spread * .85;
    // Solid extruded LJ monogram, sampled as weighted rectangles.
    const rects = [[-1.45, -1.09, -1.35, 1.35], [-1.09, -.4, -1.35, -.96], [.7, 1.1, -.94, 1.35], [0, 1.1, -1.35, -.93], [0, .36, -1.05, -.55]];
    const weights = rects.map(([x0, x1, y0, y1]) => (x1 - x0) * (y1 - y0));
    let pick = random() * weights.reduce((a, b) => a + b, 0), ri = 0;
    while (ri < weights.length - 1 && (pick -= weights[ri]) > 0) ri++;
    const [x0, x1, y0, y1] = rects[ri];
    const size = .078 + random() * .062;
    data.set([x, y, z, ex, ey, ez, x0 + random() * (x1 - x0), y0 + random() * (y1 - y0), (random() - .5) * .42, size, random(), random(), random()], i * 13);
  }
  return data;
}
const vertexShader = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
layout(location=3) in vec3 aCloud;
layout(location=4) in vec3 aExplode;
layout(location=5) in vec3 aLetter;
layout(location=6) in vec4 aRandom;
uniform float uAspect, uTime, uExplode, uLetter, uBurst;
uniform vec2 uPointer;
out vec3 vNormal, vWorld;
out vec2 vUV;
out float vType, vToken, vFace;
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
void main(){
  vec3 center=mix(mix(aCloud,aExplode,uExplode),aLetter,uLetter);
  float calm=1.-uLetter;
  center+=normalize(aCloud+vec3(.001))*uBurst*(.35+aRandom.w);
  center.y+=sin(uTime*.7+aRandom.y*6.28)*.028*calm;
  mat3 local=rz((aRandom.z-.5)*1.5*calm)*ry((aRandom.y-.5)*1.8*calm)*rx((aRandom.w-.5)*1.4*calm);
  vec3 scale=vec3(aRandom.x*(1.25+aRandom.y*1.1),aRandom.x*.82,aRandom.x*.6);
  scale=mix(scale,vec3(.088,.086,.07),uLetter);
  float angle=mix(-.28+uTime*.045,.08,uLetter);
  mat3 world=rx(mix(.28,-.08,uLetter)+uPointer.y*.11)*ry(angle+uPointer.x*.2)*rz(mix(-.22,0.,uLetter));
  vec3 position=world*(center+local*(aPosition*scale));
  vWorld=position;vNormal=world*local*aNormal;vUV=aUV;
  vType=aRandom.z;vToken=floor(aRandom.w*32.);vFace=step(.5,aNormal.z);
  float depth=7.5-position.z;
  float lens=2.34;
  gl_Position=vec4(position.x*lens/uAspect,position.y*lens,depth*.98-.2,depth);
}`;
const fragmentShader = `#version 300 es
precision highp float;
in vec3 vNormal,vWorld;
in vec2 vUV;
in float vType,vToken,vFace;
uniform sampler2D uAtlas;
out vec4 outColor;
void main(){
  vec3 n=normalize(vNormal);
  float key=max(dot(n,normalize(vec3(-.6,1.,1.5))),0.);
  float fill=max(dot(n,normalize(vec3(1.,.2,.7))),0.);
  float ao=.86+.14*smoothstep(-.8,1.1,vWorld.z);
  vec3 base=vec3(.90,.91,.86);
  if(vType>.9)base=vec3(.72,.90,.34);
  if(vType<.04)base=vec3(.24,.29,.19);
  float light=.49+.43*key+.16*fill;
  vec3 color=base*light*ao;
  float edge=min(min(vUV.x,1.-vUV.x),min(vUV.y,1.-vUV.y));
  float border=1.-smoothstep(.015,.05,edge);
  color=mix(color,color*.78,border*.5);
  vec2 atlasUV=(vec2(mod(vToken,8.),floor(vToken/8.))+vec2(vUV.x,1.-vUV.y))/vec2(8.,4.);
  float ink=texture(uAtlas,atlasUV).a*vFace*.76;
  color=mix(color,vec3(.18,.23,.13),ink);
  float fog=smoothstep(-1.9,2.,vWorld.z);
  color=mix(vec3(.80,.82,.75),color,.68+.32*fog);
  outColor=vec4(color,1.);
}`;
function boxGeometry() {
  const vertices = [], indices = [0, 1, 2, 0, 2, 3];
  const faces = [
    [[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],
    [[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]],
    [[1,0,0],[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]],
    [[-1,0,0],[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]],
    [[0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]],
    [[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]]
  ];
  const uv = [[0,0],[1,0],[1,1],[0,1]];
  for (const [normal, corners] of faces) for (const i of indices) vertices.push(...corners[i], ...normal, ...uv[i]);
  return new Float32Array(vertices);
}
export class TokenCloud {
  constructor(canvas, { count = 1450, onFailure = () => {} } = {}) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!this.gl) throw new Error('WebGL2 unavailable');
    const gl = this.gl;
    this.count = count;
    this.lost = false;
    this.onLost = event => { event.preventDefault(); this.lost = true; onFailure(); };
    canvas.addEventListener('webglcontextlost', this.onLost);
    const compile = (type, source) => {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message); }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexShader), fragment = compile(gl.FRAGMENT_SHADER, fragmentShader);
    const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    this.program = program; gl.useProgram(program);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    this.buffers = [];
    const buffer = (data, attrs, stride, divisor) => {
      const b = gl.createBuffer(); this.buffers.push(b); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      for (const [index, size, offset] of attrs) { gl.enableVertexAttribArray(index); gl.vertexAttribPointer(index, size, gl.FLOAT, false, stride * 4, offset * 4); gl.vertexAttribDivisor(index, divisor); }
    };
    buffer(boxGeometry(), [[0,3,0],[1,3,3],[2,2,6]], 8, 0);
    buffer(createTokens(count), [[3,3,0],[4,3,3],[5,3,6],[6,4,9]], 13, 1);
    this.uniforms = Object.fromEntries(['uAspect','uTime','uExplode','uLetter','uBurst','uPointer','uAtlas'].map(name => [name, gl.getUniformLocation(program, name)]));
    const atlas = document.createElement('canvas'); atlas.width = 1024; atlas.height = 256;
    const ctx = atlas.getContext('2d');
    if (!ctx) throw new Error('Canvas texture unavailable');
    const words = ['const','agent','{ }','await','human','/ctx','build','open','0110','Rust','Linux','fn()','token','<>','let','git','CLI','flow','if','return','0x1A','hello','source','sync','idea','./','MCP','run',' + ','LJ','fork','next'];
    ctx.font = '500 24px monospace'; ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    words.forEach((word, i) => ctx.fillText(word, i % 8 * 128 + 64, Math.floor(i / 8) * 64 + 32));
    this.texture = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.uniforms.uAtlas, 0); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.clearColor(0,0,0,0);
    this.resize();
  }
  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.5 : 1.75);
    this.canvas.width = Math.max(1, Math.round(width * dpr)); this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.aspect = Math.max(.1, width / Math.max(height, 1));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  render({ progress = 0, time = 0, pointer = [0, 0], burst = 0, reduced = false } = {}) {
    if (this.lost) return;
    const gl = this.gl, u = this.uniforms;
    const p = reduced ? [0, .5, 1][phaseAt(progress)] : progress;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(this.program); gl.bindVertexArray(this.vao);
    gl.uniform1f(u.uAspect, this.aspect); gl.uniform1f(u.uTime, reduced ? 0 : time);
    gl.uniform1f(u.uExplode, smoothstep(.1, .47, p)); gl.uniform1f(u.uLetter, smoothstep(.6, .9, p));
    gl.uniform1f(u.uBurst, reduced ? 0 : burst); gl.uniform2f(u.uPointer, reduced ? 0 : pointer[0], reduced ? 0 : pointer[1]);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, this.count);
  }
  destroy() {
    const gl = this.gl; this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.buffers.forEach(buffer => gl.deleteBuffer(buffer)); gl.deleteTexture(this.texture); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.program); this.lost = true;
  }
}

/** CPU 3D fallback for browsers that disable WebGL. Uses the same mesh and morph targets. */
export class CanvasCloud {
  constructor(canvas, { count = 650 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    if (!this.ctx) throw new Error('Canvas2D unavailable');
    this.data = createTokens(count); this.count = count; this.lost = false;
    this.words = ['const','agent','{ }','await','human','/ctx','build','open','0110','Rust','Linux','fn()','token','<>','let','git','CLI','flow','if','return','0x1A','hello','source','sync','idea','./','MCP','run',' + ','LJ','fork','next'];
    this.resize();
  }
  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.max(1, Math.round(bounds.width * this.dpr)); this.canvas.height = Math.max(1, Math.round(bounds.height * this.dpr));
  }
  render({ progress = 0, time = 0, pointer = [0,0], burst = 0, reduced = false } = {}) {
    if (this.lost) return;
    if (reduced) { progress = [0,.5,1][phaseAt(progress)]; time = 0; pointer = [0,0]; burst = 0; }
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,w,h);
    const mix = (a,b,t) => a+(b-a)*t, exploded = smoothstep(.1,.47,progress), letter = smoothstep(.6,.9,progress), calm = 1-letter;
    const rotate = (p,x,y,z) => {
      const [px,py,pz]=p, cz=Math.cos(z),sz=Math.sin(z),cy=Math.cos(y),sy=Math.sin(y),cx=Math.cos(x),sx=Math.sin(x);
      const a=px*cz-py*sz,b=px*sz+py*cz,c=a*cy+pz*sy,d=-a*sy+pz*cy;
      return [c,b*cx-d*sx,b*sx+d*cx];
    };
    const global = p => rotate(p, mix(.28,-.08,letter)+pointer[1]*.11,mix(-.28+time*.045,.08,letter)+pointer[0]*.2,mix(-.22,0,letter));
    const project = p => [w/2+p[0]*h*1.17/(7.5-p[2]),h/2-p[1]*h*1.17/(7.5-p[2])];
    const cube=[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]];
    const faceDefs=[[[0,1,2,3],[0,0,1]],[[4,5,6,7],[0,0,-1]],[[1,4,7,2],[1,0,0]],[[5,0,3,6],[-1,0,0]],[[3,2,7,6],[0,1,0]],[[5,4,1,0],[0,-1,0]]];
    const faces=[];
    for(let i=0;i<this.count;i++) {
      const o=i*13,d=this.data,seed=d[o+10],type=d[o+11],word=d[o+12],size=d[o+9];
      const local=p=>rotate(p,(word-.5)*1.4*calm,(seed-.5)*1.8*calm,(type-.5)*1.5*calm);
      const center=[0,1,2].map(j=>mix(mix(d[o+j],d[o+3+j],exploded),d[o+6+j],letter));
      const norm=Math.hypot(d[o],d[o+1],d[o+2]);
      for(let j=0;j<3;j++)center[j]+=d[o+j]/norm*burst*(.35+word);
      center[1]+=Math.sin(time*.7+seed*6.28)*.028*calm;
      // Slightly larger fallback tiles retain visual density with fewer CPU instances.
      const scale=[mix(size*(1.25+seed*1.1)*1.17,.125,letter),mix(size*.82*1.17,.12,letter),mix(size*.6,.09,letter)];
      const points=cube.map(p=>{const q=local(p.map((v,j)=>v*scale[j]/2));return global(q.map((v,j)=>v+center[j]));});
      const points2=points.map(project);
      for(let f=0;f<faceDefs.length;f++) {
        const [ids,normal]=faceDefs[f],n=global(local(normal));
        if(n[2]<-.08)continue;
        const key=Math.max(0,(-.6*n[0]+n[1]+1.5*n[2])/1.9),fill=Math.max(0,(n[0]+.2*n[1]+.7*n[2])/1.237);
        const z=ids.reduce((v,j)=>v+points[j][2],0)/4,light=(.49+.43*key+.16*fill)*(.86+.14*smoothstep(-.8,1.1,z));
        let base=type>.9?[184,230,87]:type<.04?[61,74,48]:[230,232,219];
        base=base.map(v=>Math.round(clamp(v*light,0,255)));
        faces.push({pts:ids.map(j=>points2[j]),z,color:`rgb(${base.join(',')})`,word:f===0?this.words[Math.floor(word*32)]:null});
      }
    }
    faces.sort((a,b)=>a.z-b.z);
    ctx.lineWidth=.45*this.dpr;ctx.lineJoin='round';
    for(const f of faces) {
      const p=f.pts;ctx.beginPath();ctx.moveTo(...p[0]);for(let j=1;j<4;j++)ctx.lineTo(...p[j]);ctx.closePath();ctx.fillStyle=f.color;ctx.fill();ctx.strokeStyle='#61704736';ctx.stroke();
      if(f.word&&Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1])>13*this.dpr) {
        ctx.save();ctx.setTransform((p[2][0]-p[3][0])/128,(p[2][1]-p[3][1])/128,(p[0][0]-p[3][0])/64,(p[0][1]-p[3][1])/64,...p[3]);
        ctx.fillStyle='#29371a9c';ctx.font='24px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(f.word,64,32);ctx.restore();
      }
    }
  }
  destroy() { this.lost = true; }
}
