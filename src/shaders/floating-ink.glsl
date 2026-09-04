// FLOATING INK — original procedural marbling study.
// A moving contour field on paper; no textures or fluid-simulation claims.

mat2 inkRotation(float angle) {
    float c = cos(angle), s = sin(angle);
    return mat2(c, -s, s, c);
}

float paperGrain(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float scale = min(iResolution.x, iResolution.y);
    vec2 p = (2.0 * fragCoord - iResolution.xy) / scale;
    vec2 mouse = (2.0 * iMouse.xy - iResolution.xy) / scale;
    float time = iTime * 0.16;

    // The held pointer stirs only its neighborhood, like a stylus in a tray.
    vec2 offset = p - mouse;
    float influence = exp(-1.8 * dot(offset, offset)) * step(0.5, iMouse.z);
    p = mouse + inkRotation(influence * 2.4) * offset;
    p += influence * vec2(0.12 * sin(time), 0.12 * cos(time));

    // Broad, nested currents keep the fine contours in coherent islands.
    vec2 q = p;
    for (int layer = 0; layer < 5; layer++) {
        float n = float(layer);
        q += 0.24 / (1.0 + n * 0.22) * vec2(
            sin(q.y * 2.15 + time + n * 1.7),
            cos(q.x * 1.95 - time * 0.7 + n * 1.3)
        );
        q = inkRotation(0.43) * q;
    }
    float field = length(q - vec2(-0.24, 0.12));
    field += 0.16 * sin(q.x * 3.0 + q.y * 1.8 + time);
    field += 0.09 * cos(q.y * 4.0 - time * 0.6);
    float phase = field * 48.0 + time;
    float width = clamp(fwidth(phase), 0.03, 1.2);
    float band = sin(phase);
    float ink = smoothstep(-0.22 - width, -0.22 + width, band);
    float fineLine = 1.0 - smoothstep(0.03, 0.03 + width * 0.6, abs(sin(phase * 2.0 + 0.4)));

    vec3 paper = vec3(0.91, 0.865, 0.74);
    vec3 carbon = vec3(0.065, 0.082, 0.070);
    vec3 cinnabar = vec3(0.57, 0.15, 0.085);
    float pigment = smoothstep(0.42, 0.72, sin(field * 3.0 + q.x * 1.4 - time * 0.25));
    vec3 color = mix(paper, mix(carbon, cinnabar, pigment), ink * 0.91);
    color = mix(color, vec3(0.49, 0.34, 0.16), fineLine * (1.0 - ink) * 0.36);
    float grain = paperGrain(fragCoord) - 0.5;
    color += grain * 0.038;
    vec2 uv = fragCoord / iResolution.xy;
    float edge = pow(max(16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y), 0.0), 0.12);
    color *= 0.87 + 0.13 * edge;
    fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
