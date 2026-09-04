// IRIDESCENT FOLD — original single-pass material study.
// Analytic folds and artistic spectral interference, not a physical film solver.

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float scale = min(iResolution.x, iResolution.y);
    vec2 p = (2.0 * fragCoord - iResolution.xy) / scale;
    vec2 mouse = (2.0 * iMouse.xy - iResolution.xy) / scale;
    float held = step(0.5, iMouse.z);
    float time = iTime * 0.24;
    vec2 touch = mix(vec2(0.28 * sin(time), 0.2 * cos(time * 0.7)), mouse, held);

    // A loose pleat, pulled toward the held pointer, fills the frame.
    vec2 q = p;
    vec2 offset = p - touch;
    float pull = exp(-dot(offset, offset) * 1.1);
    q += held * offset * pull * 0.38;
    float bend = q.x + 0.33 * sin(q.y * 2.2 + time);
    bend += 0.17 * sin(q.y * 4.6 - time * 0.7);
    float ridge = bend * 7.0 + 0.5 * sin(q.y * 3.0 + time * 0.4);
    float height = 0.28 * sin(ridge) + 0.085 * sin(ridge * 2.0 + q.y);
    height += 0.16 * sin(q.y * 1.7 - time * 0.5);
    height += held * pull * 0.38;

    // Screen derivatives give a stable surface normal at any render size.
    float pixel = 2.0 / scale;
    vec3 normal = normalize(vec3(-dFdx(height) / pixel, -dFdy(height) / pixel, 1.0));
    vec3 view = normalize(vec3(p * -0.13, 1.6));
    vec3 light = normalize(vec3(-0.65 + touch.x * 0.45, 0.9 + touch.y * 0.45, 1.25));
    float facing = max(dot(normal, view), 0.0);
    float diffuse = max(dot(normal, light), 0.0);
    float thickness = 0.62 + height * 0.7 + q.y * 0.10;
    vec3 spectrum = 0.5 + 0.5 * cos(6.2831853 * (thickness * (0.65 + facing * 0.8) + vec3(0.0, 0.23, 0.48)));
    vec3 copper = vec3(0.54, 0.24, 0.12);
    vec3 film = mix(copper, spectrum, 0.76);
    vec3 halfVector = normalize(light + view);
    float highlight = pow(max(dot(normal, halfVector), 0.0), 44.0);
    float fresnel = pow(1.0 - facing, 3.0);
    float shadow = 0.45 + 0.55 * smoothstep(-0.35, 0.27, height);
    vec3 color = film * (0.14 + diffuse * 0.86) * shadow;
    color += highlight * vec3(1.2, 1.08, 0.86) * 0.9;
    color += fresnel * spectrum * 0.28;
    float thread = 0.5 + 0.5 * sin(q.y * 340.0 + bend * 14.0);
    float threadVisibility = 1.0 - smoothstep(0.8, 2.2, fwidth(q.y * 340.0 + bend * 14.0));
    color *= 1.0 - thread * threadVisibility * 0.045;
    vec2 uv = fragCoord / iResolution.xy;
    float vignette = pow(max(16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y), 0.0), 0.2);
    color *= 0.38 + 0.62 * vignette;
    color = vec3(1.0) - exp(-max(color, vec3(0.0)) * 1.35);
    fragColor = vec4(pow(color, vec3(0.82)), 1.0);
}
