// NEON RIFT — original self-contained Shadertoy fragment shader
// No texture channels required.

#define FAR_CLIP 150.0
#define GRID_STEPS 176
#define TAU 6.28318530718

float hash12(vec2 p)
{
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

float hash13(vec3 p)
{
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

float routeX(float z)
{
    return 7.5 * sin(z * 0.026)
         + 2.7 * sin(z * 0.071 + 1.4)
         + 1.2 * sin(z * 0.151 - 0.8);
}

float canyonWidth(float z)
{
    return 6.2
         + 0.85 * sin(z * 0.061 + 0.7)
         + 0.45 * sin(z * 0.137 - 1.1);
}

// 0 = air, 1 = basalt, 2 = energy crystal, 3 = portal ring
float cellMaterial(vec3 cell)
{
    vec3 c = floor(cell);
    float x = c.x + 0.5;
    float y = c.y + 0.5;
    float z = c.z + 0.5;

    float center = routeX(z);
    float side = abs(x - center);
    float width = canyonWidth(z);

    float floorY = -5.2
                 + 0.95 * sin(x * 0.22 + z * 0.075)
                 + 0.55 * sin(z * 0.183 - x * 0.071);

    float wallTop = 8.0
                  + 2.8 * sin(x * 0.087 - z * 0.049)
                  + 2.0 * sin(z * 0.103 + 0.8);

    float wallRoughness = 0.55 * sin(y * 1.63 + z * 0.217)
                        + 0.35 * sin(x * 0.81 - z * 0.119);

    // Periodic open portal rings around the flight path.
    float ringPlane = abs(mod(z + 20.0, 40.0) - 20.0);
    float ringRadius = length(vec2(x - center, y - 0.7));
    if (ringPlane < 0.58 && abs(ringRadius - 7.15) < 0.68)
        return 3.0;

    // Sparse floating crystals, kept away from the central safe corridor.
    vec3 cluster = floor(c / vec3(4.0, 5.0, 4.0));
    vec3 local = mod(c, vec3(4.0, 5.0, 4.0)) - vec3(1.5, 2.0, 1.5);
    float clusterSeed = hash13(cluster + 9.7);
    float shardShape = abs(local.x) + abs(local.z) + 0.42 * abs(local.y);
    if (clusterSeed > 0.91 &&
        side > 2.8 && side < width - 0.8 &&
        y > -2.5 && y < 7.0 && shardShape < 1.28)
        return 2.0;

    bool rock = (y < floorY) ||
                (side > width + wallRoughness && y < wallTop);

    if (rock)
    {
        // Large coherent crystal veins embedded in the rock.
        float veinSeed = hash13(floor(c * vec3(0.25, 0.50, 0.25)) + 17.0);
        float veinWave = abs(sin(x * 0.69 + y * 0.93 + z * 0.47));
        if (veinSeed > 0.825 && veinWave > 0.64)
            return 2.0;
        return 1.0;
    }

    return 0.0;
}

float occupied(vec3 cell)
{
    return step(0.5, cellMaterial(cell));
}

// Amanatides-Woo style grid traversal.
float traceVoxels(
    vec3 ro,
    vec3 rd,
    out float hitT,
    out vec3 hitCell,
    out vec3 hitNormal,
    out float hitMaterial)
{
    vec3 cell = floor(ro);
    vec3 stepDir = sign(rd);
    stepDir += 1.0 - abs(stepDir); // exact zero components step in + direction, but never win

    vec3 invDir = stepDir / max(abs(rd), vec3(1e-5));
    vec3 deltaT = abs(invDir);
    vec3 nextBoundary = cell + step(vec3(0.0), rd);
    vec3 sideT = (nextBoundary - ro) * invDir;

    float travel = 0.0;
    vec3 normal = vec3(0.0);

    for (int i = 0; i < GRID_STEPS; ++i)
    {
        float mat = cellMaterial(cell);
        if (mat > 0.5)
        {
            hitT = travel;
            hitCell = cell;
            hitNormal = normal;
            hitMaterial = mat;
            return 1.0;
        }

        if (travel > FAR_CLIP)
            break;

        if (sideT.x < sideT.y && sideT.x < sideT.z)
        {
            travel = sideT.x;
            sideT.x += deltaT.x;
            cell.x += stepDir.x;
            normal = vec3(-stepDir.x, 0.0, 0.0);
        }
        else if (sideT.y < sideT.z)
        {
            travel = sideT.y;
            sideT.y += deltaT.y;
            cell.y += stepDir.y;
            normal = vec3(0.0, -stepDir.y, 0.0);
        }
        else
        {
            travel = sideT.z;
            sideT.z += deltaT.z;
            cell.z += stepDir.z;
            normal = vec3(0.0, 0.0, -stepDir.z);
        }
    }

    hitT = FAR_CLIP;
    hitCell = cell;
    hitNormal = normal;
    hitMaterial = 0.0;
    return 0.0;
}

void faceFrame(vec3 normal, vec3 p, out vec2 uv, out vec3 axisU, out vec3 axisV)
{
    vec3 f = fract(p);

    if (abs(normal.x) > 0.5)
    {
        uv = f.zy;
        axisU = vec3(0.0, 0.0, 1.0);
        axisV = vec3(0.0, 1.0, 0.0);
    }
    else if (abs(normal.y) > 0.5)
    {
        uv = f.xz;
        axisU = vec3(1.0, 0.0, 0.0);
        axisV = vec3(0.0, 0.0, 1.0);
    }
    else
    {
        uv = f.xy;
        axisU = vec3(1.0, 0.0, 0.0);
        axisV = vec3(0.0, 1.0, 0.0);
    }
}

float voxelAO(vec3 cell, vec3 normal, vec2 uv, vec3 axisU, vec3 axisV)
{
    vec3 outside = cell + normal;

    float leftOcc   = occupied(outside - axisU);
    float rightOcc  = occupied(outside + axisU);
    float bottomOcc = occupied(outside - axisV);
    float topOcc    = occupied(outside + axisV);

    float wLeft   = 1.0 - smoothstep(0.02, 0.62, uv.x);
    float wRight  = 1.0 - smoothstep(0.02, 0.62, 1.0 - uv.x);
    float wBottom = 1.0 - smoothstep(0.02, 0.62, uv.y);
    float wTop    = 1.0 - smoothstep(0.02, 0.62, 1.0 - uv.y);

    float edgeOcc = leftOcc * wLeft + rightOcc * wRight
                  + bottomOcc * wBottom + topOcc * wTop;

    float cornerOcc = 0.0;
    cornerOcc += occupied(outside - axisU - axisV) * wLeft  * wBottom;
    cornerOcc += occupied(outside + axisU - axisV) * wRight * wBottom;
    cornerOcc += occupied(outside - axisU + axisV) * wLeft  * wTop;
    cornerOcc += occupied(outside + axisU + axisV) * wRight * wTop;

    return clamp(1.0 - 0.18 * edgeOcc - 0.10 * cornerOcc, 0.22, 1.0);
}

vec3 skyColor(vec3 rd)
{
    float up = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 sky = mix(vec3(0.003, 0.005, 0.018),
                   vec3(0.020, 0.075, 0.145),
                   pow(up, 0.72));

    float azimuth = atan(rd.x, rd.z);
    float auroraBand = exp(-28.0 * abs(rd.y - 0.18));
    float auroraWave = 0.5 + 0.5 * sin(7.0 * azimuth + 19.0 * rd.y + 0.12 * iTime);
    sky += auroraBand * auroraWave * vec3(0.02, 0.22, 0.28);

    vec3 starCell = floor(rd * 820.0);
    float star = pow(hash13(starCell), 54.0);
    sky += star * (1.4 + 0.6 * hash13(starCell + 5.0)) * vec3(0.55, 0.75, 1.0);

    return sky;
}

float portalField(vec3 p)
{
    float plane = abs(mod(p.z + 20.0, 40.0) - 20.0);
    float radial = abs(length(vec2(p.x - routeX(p.z), p.y - 0.7)) - 7.15);
    return exp(-3.2 * plane * plane - 2.4 * radial * radial);
}

vec3 volumeLight(vec3 ro, vec3 rd, float maxT, float jitter)
{
    vec3 sum = vec3(0.0);
    float limit = min(maxT, 105.0);
    const int VOLUME_STEPS = 14;

    for (int i = 0; i < VOLUME_STEPS; ++i)
    {
        float fi = (float(i) + 0.35 + 0.55 * jitter) / float(VOLUME_STEPS);
        float t = limit * fi;
        vec3 p = ro + rd * t;

        float gate = portalField(p);
        float pulse = 0.62 + 0.38 * sin(iTime * 4.2 + p.z * 0.48);

        float riverX = p.x - routeX(p.z);
        float river = exp(-0.18 * riverX * riverX)
                    * exp(-0.55 * (p.y + 4.4) * (p.y + 4.4));
        river *= 0.55 + 0.45 * sin(p.z * 0.31 - iTime * 3.0);
        river = max(river, 0.0);

        float fade = exp(-0.018 * t);
        sum += gate * pulse * fade * vec3(1.35, 0.12, 2.15);
        sum += river * fade * vec3(0.025, 0.38, 1.15);
    }

    return sum * (limit / float(VOLUME_STEPS)) * 0.035;
}

vec3 shadeVoxel(
    vec3 ro,
    vec3 rd,
    float t,
    vec3 cell,
    vec3 normal,
    float material)
{
    vec3 p = ro + rd * (t + 0.0002);
    vec2 uv;
    vec3 axisU, axisV;
    faceFrame(normal, p, uv, axisU, axisV);

    float ao = voxelAO(cell, normal, uv, axisU, axisV);
    float edgeDistance = min(min(uv.x, 1.0 - uv.x),
                             min(uv.y, 1.0 - uv.y));
    float edge = 1.0 - smoothstep(0.025, 0.095, edgeDistance);

    float randomPhase = hash13(cell) * TAU;
    float pulse = 0.5 + 0.5 * sin(iTime * 3.4 + cell.z * 0.17 + randomPhase);

    vec2 panelCell = fract(uv * 4.0);
    float panelDistance = min(min(panelCell.x, 1.0 - panelCell.x),
                              min(panelCell.y, 1.0 - panelCell.y));
    float microGrid = 1.0 - smoothstep(0.018, 0.055, panelDistance);

    float diagonal = 1.0 - smoothstep(0.035, 0.085,
        abs(fract((uv.x + uv.y) * 2.0 + randomPhase / TAU) - 0.5));

    vec3 baseColor;
    vec3 emission = vec3(0.0);

    if (material < 1.5)
    {
        baseColor = vec3(0.022, 0.038, 0.070);
        baseColor *= 0.82 + 0.28 * hash13(floor(cell * 0.5));
        emission += edge * (0.22 + 0.55 * pulse) * vec3(0.02, 0.62, 1.45);
        emission += 0.10 * microGrid * vec3(0.02, 0.20, 0.45);
    }
    else if (material < 2.5)
    {
        baseColor = vec3(0.105, 0.018, 0.165);
        emission += (0.8 + 2.2 * pulse) * vec3(0.28, 0.04, 1.40);
        emission += (edge + 0.55 * diagonal) * vec3(0.05, 1.00, 1.60);
    }
    else
    {
        baseColor = vec3(0.090, 0.020, 0.095);
        emission += (1.2 + 2.8 * pulse) * vec3(1.55, 0.08, 2.40);
        emission += 1.4 * edge * vec3(0.08, 0.90, 1.80);
        emission += 0.35 * microGrid * vec3(1.2, 0.08, 0.3);
    }

    vec3 sunDir = normalize(vec3(-0.45, 0.72, -0.36));
    float diffuse = max(dot(normal, sunDir), 0.0);
    float sky = 0.45 + 0.55 * normal.y;
    float back = pow(max(dot(normal, -sunDir), 0.0), 2.0);
    float rim = pow(1.0 - max(dot(-rd, normal), 0.0), 3.0);

    vec3 lighting = vec3(0.11, 0.14, 0.22);
    lighting += 1.35 * diffuse * vec3(0.82, 0.92, 1.00);
    lighting += 0.42 * sky * vec3(0.16, 0.28, 0.55);
    lighting += 0.20 * back * vec3(0.52, 0.08, 0.16);

    vec3 color = baseColor * lighting * ao;
    color += emission * (0.55 + 0.45 * ao);
    color += rim * emission * 0.24;

    return color;
}

mat3 cameraBasis(vec3 eye, vec3 target, float roll)
{
    vec3 forward = normalize(target - eye);
    vec3 referenceUp = vec3(sin(roll), cos(roll), 0.0);
    vec3 right = normalize(cross(referenceUp, forward));
    vec3 up = cross(forward, right);
    return mat3(right, up, forward);
}

vec3 renderScene(vec3 ro, vec3 rd, vec2 fragCoord)
{
    float hitT;
    vec3 hitCell;
    vec3 hitNormal;
    float hitMaterial;

    float hit = traceVoxels(ro, rd, hitT, hitCell, hitNormal, hitMaterial);
    vec3 background = skyColor(rd);
    vec3 color = background;

    if (hit > 0.5)
    {
        color = shadeVoxel(ro, rd, hitT, hitCell, hitNormal, hitMaterial);

        float fog = 1.0 - exp(-0.022 * hitT);
        vec3 fogColor = mix(background,
                            vec3(0.018, 0.055, 0.110),
                            0.55);
        color = mix(color, fogColor, fog);
    }

    float volumeDistance = hit > 0.5 ? hitT : FAR_CLIP;
    color += volumeLight(ro, rd, volumeDistance, hash12(fragCoord));

    return color;
}

vec3 toneMapACES(vec3 x)
{
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    vec2 mouse = iMouse.xy / max(iResolution.xy, vec2(1.0));

    float travel = iTime * 9.5;
    float heightBias = 0.0;
    if (iMouse.z > 0.0)
    {
        travel += (mouse.x - 0.5) * 120.0;
        heightBias = (mouse.y - 0.5) * 5.0;
    }

    vec3 ro = vec3(routeX(travel),
                   0.85 + 0.45 * sin(travel * 0.057) + heightBias,
                   travel);

    float lookZ = travel + 11.0;
    vec3 target = vec3(routeX(lookZ),
                       0.30 + 0.30 * sin(lookZ * 0.057),
                       lookZ);

    float roll = 0.075 * sin(travel * 0.041)
               + 0.035 * sin(travel * 0.097 + 1.5);
    mat3 camera = cameraBasis(ro, target, roll);

    // Mild anamorphic barrel distortion.
    float radius2 = dot(uv, uv);
    uv *= 1.0 + 0.085 * radius2;
    uv.x *= 1.04;

    vec3 rd = normalize(camera * vec3(uv, 1.62));
    vec3 color = renderScene(ro, rd, fragCoord);

    // Peripheral speed energy, strongest during portal crossings.
    float portalPulse = exp(-0.12 * pow(abs(mod(travel + 20.0, 40.0) - 20.0), 2.0));
    float radial = length(uv);
    float streakPattern = pow(max(0.0,
        sin(84.0 * atan(uv.y, uv.x) + hash12(floor(fragCoord * 0.08)) * TAU)), 18.0);
    color += portalPulse * streakPattern * smoothstep(0.45, 1.25, radial)
           * vec3(0.09, 0.25, 0.65);

    // Vignette, subtle scan modulation, cinematic tone map.
    vec2 q = fragCoord / iResolution.xy;
    float vignette = pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.16);
    color *= 0.50 + 0.50 * vignette;
    color *= 0.985 + 0.015 * sin(fragCoord.y * 1.35 + iTime * 24.0);

    color = toneMapACES(color * 1.15);
    color = pow(color, vec3(1.0 / 2.2));

    fragColor = vec4(color, 1.0);
}
