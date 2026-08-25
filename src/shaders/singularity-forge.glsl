// SINGULARITY FORGE
// Original self-contained Shadertoy / WebGL2 fragment shader.
// No texture channels are required.
//
// Features:
// - Curved-ray integration through an approximate black-hole gravity field
// - Volumetric, Doppler-shifted accretion disk sampled along the bent ray
// - Three independently rotating SDF megastructure rings
// - Procedural emissive machinery, orbital crystals, AO and soft shadows
// - Procedural nebula/star field, photon-ring scattering and filmic grading

#ifndef TRACE_STEPS
#define TRACE_STEPS 236
#endif

#define TAU 6.28318530718
#define PI  3.14159265359
#define EVENT_HORIZON 1.08
#define PHOTON_ORBIT  1.56
#define MAX_TRAVEL    72.0

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3  saturate(vec3 x)  { return clamp(x, 0.0, 1.0); }

mat2 rot(float a)
{
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

float hash11(float p)
{
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash12(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p)
{
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p)
{
    p = vec3(dot(p, vec3(127.1, 311.7,  74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
}

float valueNoise(vec3 p)
{
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash13(i + vec3(0,0,0));
    float n100 = hash13(i + vec3(1,0,0));
    float n010 = hash13(i + vec3(0,1,0));
    float n110 = hash13(i + vec3(1,1,0));
    float n001 = hash13(i + vec3(0,0,1));
    float n101 = hash13(i + vec3(1,0,1));
    float n011 = hash13(i + vec3(0,1,1));
    float n111 = hash13(i + vec3(1,1,1));

    return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
               mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

float fbm(vec3 p)
{
    float f = 0.0;
    f += 0.5000 * valueNoise(p); p = p * 2.03 + 11.7;
    f += 0.2500 * valueNoise(p); p = p * 2.01 + 17.3;
    f += 0.1250 * valueNoise(p); p = p * 2.04 +  7.1;
    f += 0.0625 * valueNoise(p);
    return f / 0.9375;
}

float sdTorus(vec3 p, vec2 t)
{
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdRoundBox(vec3 p, vec3 b, float r)
{
    vec3 q = abs(p) - b + r;
    return min(max(q.x, max(q.y, q.z)), 0.0) + length(max(q, 0.0)) - r;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r)
{
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = saturate(dot(pa, ba) / dot(ba, ba));
    return length(pa - ba * h) - r;
}

float sdDiamond(vec3 p, float s)
{
    return (abs(p.x) + abs(p.y) + abs(p.z) - s) * 0.5773502692;
}

vec3 ringFrame(vec3 p, vec3 a)
{
    p.yz = rot(a.x) * p.yz;
    p.xz = rot(a.y) * p.xz;
    p.xy = rot(a.z) * p.xy;
    return p;
}

void unite(inout vec2 res, float d, float material)
{
    if (d < res.x) res = vec2(d, material);
}

// One articulated gyroscope ring in local coordinates.
// Materials: 1 dark metal, 2 bright alloy, 3 cyan, 4 magenta, 5 gold crystal.
vec2 ringAssembly(vec3 q, float radius, float variant, float spin)
{
    vec2 res = vec2(1e5, 0.0);
    vec3 qr = q;
    qr.xz = rot(spin) * qr.xz;

    float rail = min(sdTorus(q, vec2(radius - 0.22, 0.070)),
                     sdTorus(q, vec2(radius + 0.22, 0.070)));
    unite(res, rail, 2.0);
    unite(res, sdTorus(q, vec2(radius, 0.145 + 0.018 * variant)), 1.0);

    vec3 qa = q; qa.y -= 0.145;
    vec3 qb = q; qb.y += 0.145;
    unite(res, sdTorus(qa, vec2(radius, 0.027)), 3.0 + mod(variant, 2.0));
    unite(res, sdTorus(qb, vec2(radius, 0.021)), 4.0 - mod(variant, 2.0));

    float count = 10.0 + 2.0 * variant;
    float sector = TAU / count;
    float angle = atan(qr.z, qr.x);
    float index = floor(angle / sector + 0.5);
    qr.xz = rot(-index * sector) * qr.xz;

    vec3 moduleP = qr - vec3(radius, 0.0, 0.0);
    float module = sdRoundBox(moduleP,
                              vec3(0.31 + 0.035 * variant,
                                   0.215,
                                   0.49 + 0.035 * variant), 0.065);
    unite(res, module, 2.0);

    vec3 spokeP = qr - vec3(radius * 0.61, 0.0, 0.0);
    float spoke = sdRoundBox(spokeP,
                             vec3(radius * 0.29, 0.050, 0.050), 0.024);
    unite(res, spoke, 1.0);

    float parity = mod(index, 2.0);
    vec3 antennaP = moduleP - vec3(0.0, mix(0.40, -0.40, parity), 0.0);
    float antenna = sdCapsule(antennaP,
                              vec3(0.0, -0.17, 0.0),
                              vec3(0.0,  0.17, 0.0), 0.038);
    unite(res, antenna, 3.0 + parity);

    return res;
}

vec2 mapScene(vec3 p)
{
    vec2 res = vec2(1e5, 0.0);
    float t = iTime;

    vec3 q0 = ringFrame(p, vec3( 0.18 + 0.10 * sin(t * 0.13),
                                 0.24 + t * 0.055,
                                -0.13));
    vec2 r0 = ringAssembly(q0, 6.55, 2.0,  t * 0.19);
    if (r0.x < res.x) res = r0;

    vec3 q1 = ringFrame(p, vec3(-0.78 + t * 0.031,
                                 0.16 + 0.12 * sin(t * 0.17),
                                 0.46));
    vec2 r1 = ringAssembly(q1, 4.95, 1.0, -t * 0.27 + 1.1);
    if (r1.x < res.x) res = r1;

    vec3 q2 = ringFrame(p, vec3( 0.52,
                                -0.61 + t * 0.041,
                                 0.21 + 0.09 * sin(t * 0.11)));
    vec2 r2 = ringAssembly(q2, 3.55, 0.0,  t * 0.36 + 2.4);
    if (r2.x < res.x) res = r2;

    vec3 c = ringFrame(p, vec3(0.36, -0.18 + t * 0.018, 0.12));
    c.xz = rot(-t * 0.10) * c.xz;
    float crystalCount = 11.0;
    float crystalSector = TAU / crystalCount;
    float ca = atan(c.z, c.x);
    float ci = floor(ca / crystalSector + 0.5);
    c.xz = rot(-ci * crystalSector) * c.xz;
    float cr = 8.35 + 0.28 * sin(ci * 2.17);
    c -= vec3(cr, 0.52 * sin(ci * 1.71 + t * 0.45), 0.0);
    c.xy = rot(ci * 1.37 + t * 0.42) * c.xy;
    c.yz = rot(ci * 0.73 - t * 0.31) * c.yz;
    unite(res, sdDiamond(c, 0.52 + 0.10 * hash11(ci + 4.0)), 5.0);

    vec3 b = p;
    b.xz = rot(t * 0.14) * b.xz;
    float beamCount = 6.0;
    float beamSector = TAU / beamCount;
    float ba = atan(b.z, b.x);
    float bi = floor(ba / beamSector + 0.5);
    b.xz = rot(-bi * beamSector) * b.xz;
    vec3 bp = b - vec3(2.15, 0.0, 0.0);
    float pylon = sdRoundBox(bp, vec3(0.075, 0.62, 0.075), 0.030);
    unite(res, pylon, 3.0 + mod(bi, 2.0));

    return res;
}

vec3 calcNormal(vec3 p)
{
    const float e = 0.0025;
    vec2 h = vec2(1.0, -1.0) * e;
    return normalize(h.xyy * mapScene(p + h.xyy).x +
                     h.yyx * mapScene(p + h.yyx).x +
                     h.yxy * mapScene(p + h.yxy).x +
                     h.xxx * mapScene(p + h.xxx).x);
}

float calcAO(vec3 p, vec3 n)
{
    float occ = 0.0;
    float weight = 1.0;
    for (int i = 1; i <= 5; ++i)
    {
        float h = 0.055 * float(i);
        float d = mapScene(p + n * h).x;
        occ += (h - d) * weight;
        weight *= 0.62;
    }
    return saturate(1.0 - 2.15 * occ);
}

float softShadow(vec3 ro, vec3 rd, float maxT)
{
    float shade = 1.0;
    float t = 0.035;
    for (int i = 0; i < 18; ++i)
    {
        float h = mapScene(ro + rd * t).x;
        shade = min(shade, 11.0 * h / t);
        t += clamp(h, 0.035, 0.48);
        if (h < 0.0015 || t > maxT) break;
    }
    return saturate(shade);
}

vec3 starNebula(vec3 rd)
{
    vec3 bandNormal = normalize(vec3(0.20, 0.91, -0.36));
    float latitude = dot(rd, bandNormal);
    float band = exp(-17.0 * abs(latitude));

    float n0 = fbm(rd * 3.6 + vec3(1.2, 4.7, 8.1));
    float n1 = fbm(rd * 7.1 + vec3(9.2, 2.1, 3.7));
    float cloud = band * smoothstep(0.40, 0.82, n0 + 0.28 * n1);

    vec3 col = vec3(0.0014, 0.0020, 0.0065);
    col += band * vec3(0.012, 0.018, 0.040);
    col += cloud * mix(vec3(0.045, 0.008, 0.085),
                       vec3(0.006, 0.075, 0.110), n1) * 2.6;

    vec3 cell = floor(rd * 920.0);
    vec3 rnd = hash33(cell);
    float star = pow(rnd.x, 165.0);
    float core = pow(rnd.x, 650.0);
    vec3 starCol = mix(vec3(1.0, 0.48, 0.25),
                       vec3(0.55, 0.78, 1.0), rnd.y);
    col += star * starCol * (1.0 + 4.0 * core);

    vec3 bigCell = floor(rd * 210.0);
    vec3 br = hash33(bigCell + 17.0);
    float giant = pow(br.x, 330.0);
    col += giant * mix(vec3(1.6, 0.38, 0.08),
                       vec3(0.35, 0.80, 1.8), br.z) * 4.0;

    return col;
}

vec4 sampleAccretionDisk(vec3 p, vec3 rayDir)
{
    float r = length(p.xz);
    float inner = smoothstep(1.28, 1.62, r);
    float outer = 1.0 - smoothstep(7.65, 9.15, r);
    float radialMask = inner * outer;

    float angle = atan(p.z, p.x);
    float scaleHeight = 0.070 + 0.012 * r;
    float warpedY = p.y - 0.055 * sin(angle * 3.0 - iTime * 0.45 + r * 0.31);
    float vertical = exp(-2.4 * (warpedY * warpedY) / (scaleHeight * scaleHeight));

    float spiral0 = 0.5 + 0.5 * sin(r * 15.5 - angle * 7.0 - iTime * 3.2
                                   + 1.4 * sin(r * 2.3 + angle * 5.0));
    float spiral1 = 0.5 + 0.5 * sin(r * 31.0 + angle * 13.0 + iTime * 1.7);
    float clumps = 0.58 + 0.42 * sin(angle * 41.0 - r * 10.5
                                    + 1.8 * sin(angle * 9.0 + r * 3.0));
    clumps = clumps * clumps;

    float density = radialMask * vertical;
    density *= 0.12 + 0.68 * spiral0 * spiral0 + 0.20 * spiral1;
    density *= 0.48 + 0.52 * clumps;

    float heat = pow(saturate((8.7 - r) / 7.4), 0.72);
    vec3 thermal = mix(vec3(0.42, 0.006, 0.001),
                       vec3(1.55, 0.19, 0.015), heat);
    thermal = mix(thermal, vec3(1.75, 1.15, 0.55), pow(heat, 3.4));
    thermal = mix(thermal, vec3(1.40, 1.62, 2.10), pow(heat, 8.0) * 0.55);

    vec3 tangent = normalize(vec3(-p.z, 0.0, p.x));
    float velocity = dot(tangent, -rayDir);
    float beaming = pow(max(0.25, 1.0 + 0.62 * velocity), 3.0);
    float blueShift = smoothstep(0.05, 0.88, velocity);
    float redShift = smoothstep(0.05, 0.88, -velocity);
    thermal = mix(thermal, thermal * vec3(0.46, 0.76, 1.42), 0.48 * blueShift);
    thermal = mix(thermal, thermal * vec3(1.32, 0.55, 0.25), 0.42 * redShift);

    float escape = smoothstep(EVENT_HORIZON + 0.04, 2.10, r);
    vec3 emission = thermal * density * beaming * (0.38 + 1.55 * heat) * escape;

    return vec4(emission, density * (0.30 + 0.65 * heat));
}

vec3 surfaceMaterial(vec3 p, vec3 n, vec3 rd, float material)
{
    vec3 view = -rd;
    float ao = calcAO(p, n);

    vec3 keyDir = normalize(vec3(-0.62, 0.73, 0.29));
    float shadow = softShadow(p + n * 0.012, keyDir, 13.0);
    float ndl = max(dot(n, keyDir), 0.0);

    vec3 inward = normalize(-p + vec3(0.0, 0.16, 0.0));
    float diskBounce = max(dot(n, inward), 0.0) / (1.0 + 0.08 * dot(p, p));

    float fresnel = pow(1.0 - max(dot(n, view), 0.0), 5.0);
    vec3 halfVec = normalize(keyDir + view);

    vec3 base;
    vec3 emission = vec3(0.0);
    float metallic;
    float roughness;

    if (material < 1.5)
    {
        base = vec3(0.020, 0.027, 0.040);
        metallic = 0.86;
        roughness = 0.30;
    }
    else if (material < 2.5)
    {
        base = vec3(0.19, 0.23, 0.28);
        metallic = 0.94;
        roughness = 0.18;
    }
    else if (material < 3.5)
    {
        base = vec3(0.015, 0.080, 0.095);
        emission = vec3(0.02, 1.15, 2.65);
        metallic = 0.52;
        roughness = 0.13;
    }
    else if (material < 4.5)
    {
        base = vec3(0.090, 0.012, 0.070);
        emission = vec3(1.70, 0.055, 1.35);
        metallic = 0.48;
        roughness = 0.16;
    }
    else
    {
        base = vec3(0.31, 0.075, 0.010);
        emission = vec3(2.15, 0.38, 0.025);
        metallic = 0.30;
        roughness = 0.10;
    }

    vec3 fp = abs(fract(p * 3.25) - 0.5);
    float panel = 1.0 - smoothstep(0.445, 0.495, max(fp.x, max(fp.y, fp.z)));
    float brushed = 0.86 + 0.14 * sin(dot(p, vec3(31.0, 17.0, 23.0)));
    base *= mix(0.80, 1.08, panel) * brushed;

    float specPower = mix(92.0, 20.0, roughness);
    float spec = pow(max(dot(n, halfVec), 0.0), specPower);
    vec3 f0 = mix(vec3(0.04), base, metallic);
    vec3 specular = f0 * spec * (1.2 + 2.0 * (1.0 - roughness));

    vec3 ambient = vec3(0.018, 0.025, 0.050) * ao;
    vec3 diffuse = base * (0.12 + 1.35 * ndl * shadow) * ao;
    diffuse += base * diskBounce * vec3(1.6, 0.32, 0.08) * 7.0;

    vec3 reflected = starNebula(reflect(rd, n)) * (0.16 + 0.72 * fresnel);
    vec3 pulse = emission * (0.72 + 0.28 * sin(iTime * 4.1
                              + dot(p, vec3(1.7, 2.3, 1.1))));

    return ambient + diffuse + specular * shadow + reflected + pulse * (0.62 + 0.38 * ao);
}

mat3 cameraBasis(vec3 eye, vec3 target, float roll)
{
    vec3 forward = normalize(target - eye);
    vec3 upHint = vec3(sin(roll), cos(roll), 0.0);
    vec3 right = normalize(cross(forward, upHint));
    vec3 up = cross(right, forward);
    return mat3(right, up, forward);
}

vec3 renderSingularity(vec3 ro, vec3 rd, vec2 fragCoord)
{
    vec3 p = ro;
    vec3 dir = rd;
    vec3 radiance = vec3(0.0);
    float transmittance = 1.0;
    float travel = 0.0;
    float closestR = 1e5;
    float photonScatter = 0.0;
    bool absorbed = false;
    bool surfaceHit = false;
    vec3 hitP = vec3(0.0);
    float hitMaterial = 0.0;

    float jitter = hash12(fragCoord + floor(iTime * 19.0));
    p += dir * (0.012 + 0.028 * jitter);

    for (int i = 0; i < TRACE_STEPS; ++i)
    {
        float r = length(p);
        closestR = min(closestR, r);

        if (r < EVENT_HORIZON)
        {
            absorbed = true;
            break;
        }

        vec2 scene = mapScene(p);
        float hitEpsilon = 0.0028 + 0.00013 * travel;
        if (scene.x < hitEpsilon)
        {
            surfaceHit = true;
            hitP = p;
            hitMaterial = scene.y;
            break;
        }

        float gravityCap = mix(0.034, 0.285,
                               smoothstep(EVENT_HORIZON + 0.12, 8.0, r));
        float stepLen = min(scene.x * 0.58, gravityCap);
        stepLen = clamp(stepLen, 0.010, 0.285);

        vec4 disk = sampleAccretionDisk(p, dir);
        if (disk.a > 0.012) stepLen = min(stepLen, 0.075);

        float alpha = 1.0 - exp(-disk.a * stepLen * 3.6);
        radiance += transmittance * disk.rgb * alpha * 4.2;
        transmittance *= 1.0 - alpha * 0.58;

        float shell = exp(-42.0 * abs(r - PHOTON_ORBIT));
        photonScatter += shell * stepLen;

        float g0 = 2.48 / (r * r * r + 0.16);
        dir = normalize(dir - p * (0.5 * g0 * stepLen));
        p += dir * stepLen;
        float r1 = length(p);
        float g1 = 2.48 / (r1 * r1 * r1 + 0.16);
        dir = normalize(dir - p * (0.5 * g1 * stepLen));

        travel += stepLen;

        if (travel > MAX_TRAVEL) break;
        if (r1 > 25.0 && dot(p, dir) > 0.0 && travel > 8.0) break;
        if (transmittance < 0.015) break;
    }

    if (surfaceHit)
    {
        vec3 n = calcNormal(hitP);
        radiance += transmittance * surfaceMaterial(hitP, n, dir, hitMaterial);
    }
    else if (!absorbed)
    {
        radiance += transmittance * starNebula(dir);
    }

    float caustic = 1.0 - exp(-photonScatter * 3.2);
    float approachTint = saturate(0.5 + 0.5 * dot(normalize(vec3(-p.z, 0.0, p.x)), -dir));
    vec3 causticColor = mix(vec3(1.9, 0.16, 0.015),
                            vec3(0.18, 0.72, 2.4), approachTint);
    radiance += transmittance * caustic * causticColor * 1.25;

    float corona = exp(-3.8 * max(0.0, closestR - EVENT_HORIZON));
    corona *= smoothstep(EVENT_HORIZON, PHOTON_ORBIT + 0.75, closestR);
    radiance += corona * vec3(0.28, 0.055, 0.012) * 0.18;

    return radiance;
}

vec3 acesToneMap(vec3 x)
{
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return saturate((x * (a * x + b)) / (x * (c * x + d) + e));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    vec2 mouse = iMouse.xy / max(iResolution.xy, vec2(1.0));

    float orbit = 0.18 * iTime;
    float elevation = 0.24 + 0.055 * sin(iTime * 0.23);
    float radius = 14.4 + 0.7 * sin(iTime * 0.11);

    if (iMouse.z > 0.0)
    {
        orbit += (mouse.x - 0.5) * TAU;
        elevation = mix(-0.10, 0.62, mouse.y);
        radius -= 1.1;
    }

    vec3 ro = radius * vec3(cos(elevation) * cos(orbit),
                            sin(elevation),
                            cos(elevation) * sin(orbit));
    ro.y += 0.55;

    vec3 target = vec3(0.0, 0.08 * sin(iTime * 0.19), 0.0);
    float roll = 0.035 * sin(iTime * 0.31) + 0.018 * sin(iTime * 0.71);
    mat3 camera = cameraBasis(ro, target, roll);

    float r2 = dot(uv, uv);
    uv *= 1.0 + 0.045 * r2 + 0.012 * r2 * r2;
    uv.x *= 1.055;
    vec3 rd = normalize(camera * vec3(uv, 1.72));

    vec3 color = renderSingularity(ro, rd, fragCoord);

#ifndef OUTPUT_LINEAR
    vec2 q = fragCoord / iResolution.xy;
    float vignette = pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.18);
    color *= 0.52 + 0.48 * vignette;

    float grain = hash12(fragCoord + fract(iTime) * 733.0) - 0.5;
    color += grain * 0.012 * (0.25 + length(color));

    color = acesToneMap(color * 1.12);
    color = pow(color, vec3(1.0 / 2.2));
#endif

    fragColor = vec4(color, 1.0);
}
