const TAU = Math.PI * 2;
const SKY_CYCLE_SPEED = 0.0002;
const PARALLAX_NEAR_SPEED = 0.64;

const SKY_KEYFRAMES = [
    {
        top: [12, 21, 47],
        mid: [44, 66, 118],
        bottom: [121, 89, 130],
        haze: [140, 132, 174]
    },
    {
        top: [52, 110, 206],
        mid: [118, 190, 246],
        bottom: [246, 199, 148],
        haze: [248, 210, 154]
    },
    {
        top: [95, 175, 236],
        mid: [158, 222, 255],
        bottom: [234, 231, 196],
        haze: [237, 232, 204]
    },
    {
        top: [41, 87, 173],
        mid: [141, 112, 185],
        bottom: [255, 162, 119],
        haze: [255, 189, 126]
    },
    {
        top: [12, 21, 47],
        mid: [44, 66, 118],
        bottom: [121, 89, 130],
        haze: [140, 132, 174]
    }
];

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function lerp(start, end, t) {
    return start + (end - start) * t;
}

function lerpColor(a, b, t) {
    return [
        lerp(a[0], b[0], t),
        lerp(a[1], b[1], t),
        lerp(a[2], b[2], t)
    ];
}

function toRgba(color, alpha = 1) {
    return `rgba(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])}, ${alpha})`;
}

function sampleSkyPalette(cycle) {
    const maxIndex = SKY_KEYFRAMES.length - 1;
    const scaled = Math.max(0, Math.min(maxIndex - 0.00001, cycle * maxIndex));
    const index = Math.floor(scaled);
    const blend = scaled - index;

    const current = SKY_KEYFRAMES[index];
    const next = SKY_KEYFRAMES[index + 1];

    return {
        top: lerpColor(current.top, next.top, blend),
        mid: lerpColor(current.mid, next.mid, blend),
        bottom: lerpColor(current.bottom, next.bottom, blend),
        haze: lerpColor(current.haze, next.haze, blend)
    };
}

function fillParallaxSegments(target, count, width, minWidth, maxWidth, minHeight, maxHeight) {
    target.length = 0;
    const baseSpacing = width / Math.max(1, count - 1);
    let x = -Math.random() * baseSpacing;

    for (let i = 0; i < count; i++) {
        target.push({
            x,
            width: Math.random() * (maxWidth - minWidth) + minWidth,
            height: Math.random() * (maxHeight - minHeight) + minHeight,
            variation: Math.random(),
            seed: Math.random() * TAU
        });
        x += baseSpacing * (0.85 + Math.random() * 0.35);
    }
}

function resetParallaxSegment(segment, canvasWidth, minWidth, maxWidth, minHeight, maxHeight) {
    segment.x = canvasWidth + Math.random() * (canvasWidth * 0.32);
    segment.width = Math.random() * (maxWidth - minWidth) + minWidth;
    segment.height = Math.random() * (maxHeight - minHeight) + minHeight;
    segment.variation = Math.random();
    segment.seed = Math.random() * TAU;
}

function drawGlowOrb(ctx, x, y, radius, color, alpha, glowScale = 3.6) {
    if (alpha <= 0.001) {
        return;
    }

    const glowGradient = ctx.createRadialGradient(
        x,
        y,
        radius * 0.15,
        x,
        y,
        radius * glowScale
    );
    glowGradient.addColorStop(0, toRgba(color, alpha * 0.42));
    glowGradient.addColorStop(0.45, toRgba(color, alpha * 0.18));
    glowGradient.addColorStop(1, toRgba(color, 0));

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius * glowScale, 0, TAU);
    ctx.fill();

    ctx.fillStyle = toRgba(color, alpha);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
}

function drawLightRays(ctx, w, h, sunX, sunY, intensity, frame) {
    if (intensity < 0.06) {
        return;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const rayCount = 5;
    for (let i = 0; i < rayCount; i++) {
        const rayLength = h * (0.48 + i * 0.08);
        const halfWidth = 16 + i * 7;
        const angle = -1.1 + (i * 0.42) + Math.sin((frame * 0.01) + i) * 0.08;

        ctx.save();
        ctx.translate(sunX, sunY);
        ctx.rotate(angle);

        const rayGradient = ctx.createLinearGradient(0, 0, 0, rayLength);
        rayGradient.addColorStop(0, `rgba(255, 235, 165, ${0.075 * intensity})`);
        rayGradient.addColorStop(1, 'rgba(255, 235, 165, 0)');
        ctx.fillStyle = rayGradient;

        ctx.beginPath();
        ctx.moveTo(-halfWidth, 0);
        ctx.lineTo(halfWidth, 0);
        ctx.lineTo(halfWidth * 3.2, rayLength);
        ctx.lineTo(-halfWidth * 3.2, rayLength);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    ctx.restore();
}

function drawCloud(ctx, cloud, dayAmount, frame) {
    const shade = 205 + dayAmount * 45;
    const alpha = cloud.alpha * (0.68 + dayAmount * 0.28);
    const bob = Math.sin((frame * 0.006) + cloud.phase) * (0.8 + cloud.depth * 1.5);
    const x = cloud.x;
    const y = cloud.y + bob;
    const r = cloud.radius;

    ctx.fillStyle = `rgba(${Math.round(shade)}, ${Math.round(shade + 6)}, ${Math.round(shade + 15)}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.arc(x + r * 0.85, y - r * 0.28, r * 0.78, 0, TAU);
    ctx.arc(x - r * 0.7, y - r * 0.2, r * 0.66, 0, TAU);
    ctx.arc(x + r * 0.25, y + r * 0.34, r * 0.62, 0, TAU);
    ctx.fill();
}

function drawCloudDepthRange(ctx, clouds, minDepth, maxDepth, dayAmount, frame) {
    for (let i = 0; i < clouds.length; i++) {
        const cloud = clouds[i];
        if (cloud.depth >= minDepth && cloud.depth < maxDepth) {
            drawCloud(ctx, cloud, dayAmount, frame);
        }
    }
}

function drawRidgeLayer(ctx, segments, baseY, fillColor) {
    ctx.fillStyle = fillColor;

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const crestA = segment.height * (0.6 + segment.variation * 0.25);
        const crestB = segment.height * (0.35 + (1 - segment.variation) * 0.28);

        ctx.beginPath();
        ctx.moveTo(segment.x, baseY);
        ctx.bezierCurveTo(
            segment.x + segment.width * 0.18,
            baseY - crestA,
            segment.x + segment.width * 0.4,
            baseY - segment.height,
            segment.x + segment.width * 0.6,
            baseY - segment.height * (0.42 + segment.variation * 0.2)
        );
        ctx.bezierCurveTo(
            segment.x + segment.width * 0.77,
            baseY - crestB,
            segment.x + segment.width * 0.92,
            baseY - segment.height * 0.12,
            segment.x + segment.width,
            baseY
        );
        ctx.closePath();
        ctx.fill();
    }
}

function drawFloatingParticles(ctx, floaters, dayAmount, frame) {
    const nightAmount = 1 - dayAmount;
    const daytimeDust = [214, 234, 255];
    const nightGlow = [255, 241, 146];
    const particleColor = lerpColor(daytimeDust, nightGlow, clamp01(nightAmount * 1.2));

    for (let i = 0; i < floaters.length; i++) {
        const floater = floaters[i];
        const twinkle = 0.45 + Math.sin((frame * 0.05) + floater.phase) * 0.55;
        const baseAlpha = (0.05 + floater.depth * 0.22) * (0.65 + nightAmount * 0.9);
        const alpha = baseAlpha * twinkle;
        const radius = floater.size * (0.92 + twinkle * 0.28);

        ctx.fillStyle = toRgba(particleColor, alpha);
        ctx.beginPath();
        ctx.arc(floater.x, floater.y, radius, 0, TAU);
        ctx.fill();

        if (nightAmount > 0.3 && floater.depth > 0.62) {
            ctx.fillStyle = toRgba(particleColor, alpha * 0.18);
            ctx.beginPath();
            ctx.arc(floater.x, floater.y, radius * 2.4, 0, TAU);
            ctx.fill();
        }
    }
}

function drawFogLayer(ctx, fogBands, w, horizonY, dayAmount, frame) {
    const nightAmount = 1 - dayAmount;
    const fogGradient = ctx.createLinearGradient(0, horizonY - 120, 0, horizonY + 140);
    fogGradient.addColorStop(0, `rgba(255, 255, 255, ${0.02 + nightAmount * 0.03})`);
    fogGradient.addColorStop(0.4, `rgba(221, 235, 248, ${0.06 + nightAmount * 0.08})`);
    fogGradient.addColorStop(1, 'rgba(205, 226, 242, 0)');
    ctx.fillStyle = fogGradient;
    ctx.fillRect(0, horizonY - 120, w, 180);

    ctx.save();
    for (let i = 0; i < fogBands.length; i++) {
        const band = fogBands[i];
        const pulse = 0.75 + Math.sin((frame * 0.014) + band.phase + i * 0.55) * 0.25;
        ctx.globalAlpha = band.alpha * pulse;
        ctx.fillStyle = `rgba(230, 243, 255, ${0.55 + nightAmount * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(band.x, band.y, band.width, band.height, 0, 0, TAU);
        ctx.fill();
    }
    ctx.restore();
}

function drawDynamicSky(ctx, w, h, skyCycle, skyDrift, frame) {
    const cycle = (skyCycle + Math.sin(skyDrift) * 0.012 + 1) % 1;
    const palette = sampleSkyPalette(cycle);
    const dayAmount = clamp01((Math.sin((cycle - 0.2) * TAU) + 1) * 0.5);
    const nightAmount = 1 - dayAmount;

    const skyGradient = ctx.createLinearGradient(0, 0, 0, h);
    skyGradient.addColorStop(0, toRgba(palette.top, 1));
    skyGradient.addColorStop(0.58, toRgba(palette.mid, 1));
    skyGradient.addColorStop(1, toRgba(palette.bottom, 1));
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h);

    const haze = ctx.createLinearGradient(0, h * 0.38, 0, h * 0.88);
    haze.addColorStop(0, toRgba(palette.haze, 0));
    haze.addColorStop(1, toRgba(palette.haze, 0.18 + dayAmount * 0.14));
    ctx.fillStyle = haze;
    ctx.fillRect(0, h * 0.35, w, h * 0.58);

    const arcProgress = (cycle + 0.06) % 1;
    const sunX = arcProgress * (w + 260) - 130;
    const sunY = h * 0.2 + Math.sin(cycle * TAU) * h * 0.16;
    const moonX = ((arcProgress + 0.5) % 1) * (w + 260) - 130;
    const moonY = h * 0.24 - Math.sin(cycle * TAU) * h * 0.14;

    drawGlowOrb(ctx, sunX, sunY, 28, [255, 232, 170], Math.max(0, dayAmount - 0.08), 4.1);
    drawGlowOrb(ctx, moonX, moonY, 14, [221, 234, 255], Math.max(0, nightAmount - 0.06), 3.2);

    if (nightAmount > 0.1) {
        const starTwinkle = 0.35 + Math.sin(frame * 0.015) * 0.1;
        ctx.fillStyle = `rgba(232, 242, 255, ${nightAmount * starTwinkle * 0.55})`;
        for (let i = 0; i < 16; i++) {
            const starX = ((i * 97.13) % (w + 120)) - 60;
            const starY = 22 + ((i * 47.31) % Math.max(40, h * 0.35));
            const starR = 0.9 + (i % 3) * 0.45;
            ctx.beginPath();
            ctx.arc(starX, starY, starR, 0, TAU);
            ctx.fill();
        }
    }

    return {
        dayAmount,
        nightAmount,
        sunX,
        sunY
    };
}

export function createBackgroundState() {
    return {
        groundOffset: 0,
        skyCycle: Math.random(),
        skyDrift: Math.random() * TAU,
        clouds: [],
        farHills: [],
        midObjects: [],
        nearRidges: [],
        floaters: [],
        fogBands: [],
        groundBlades: [],
        dirtDots: []
    };
}

export function initBackgroundState(state, canvas, groundHeight) {
    state.groundOffset = 0;
    state.skyCycle = Math.random();
    state.skyDrift = Math.random() * TAU;
    state.clouds = [];
    state.farHills = [];
    state.midObjects = [];
    state.nearRidges = [];
    state.floaters = [];
    state.fogBands = [];
    state.groundBlades = [];
    state.dirtDots = [];

    const w = canvas.logicalWidth || canvas.width;
    const h = canvas.logicalHeight || canvas.height;
    const skyBottom = h - groundHeight - 18;

    const cloudCount = Math.max(9, Math.min(16, Math.floor(w / 92)));
    for (let i = 0; i < cloudCount; i++) {
        const depth = 0.25 + Math.random() * 0.9;
        const radius = 15 + Math.random() * 22 + depth * 16;
        state.clouds.push({
            x: Math.random() * (w * 1.8),
            y: Math.random() * (h * 0.45) + 16,
            radius,
            depth,
            alpha: 0.16 + depth * 0.32,
            drift: 0.68 + Math.random() * 0.68,
            phase: Math.random() * TAU
        });
    }

    fillParallaxSegments(
        state.farHills,
        Math.max(6, Math.floor(w / 170)),
        w,
        180,
        290,
        42,
        110
    );
    fillParallaxSegments(
        state.midObjects,
        Math.max(7, Math.floor(w / 140)),
        w,
        150,
        230,
        48,
        120
    );
    fillParallaxSegments(
        state.nearRidges,
        Math.max(8, Math.floor(w / 120)),
        w,
        120,
        185,
        34,
        90
    );

    const floaterCount = Math.max(24, Math.min(54, Math.floor(w / 25)));
    for (let i = 0; i < floaterCount; i++) {
        const baseY = Math.random() * Math.max(20, skyBottom - 18) + 10;
        state.floaters.push({
            x: Math.random() * (w * 1.5),
            y: baseY,
            baseY,
            size: Math.random() * 1.8 + 0.75,
            depth: Math.random(),
            phase: Math.random() * TAU,
            driftPhase: Math.random() * TAU
        });
    }

    const fogBandCount = Math.max(5, Math.min(9, Math.floor(w / 210)));
    for (let i = 0; i < fogBandCount; i++) {
        const baseY = (h - groundHeight - 42) + (Math.random() * 34 - 12);
        state.fogBands.push({
            x: Math.random() * (w * 1.8),
            y: baseY,
            baseY,
            width: Math.random() * 95 + 140,
            height: Math.random() * 16 + 20,
            alpha: Math.random() * 0.06 + 0.04,
            depth: Math.random(),
            phase: Math.random() * TAU
        });
    }

    const bladeCount = Math.max(70, Math.min(130, Math.floor(w * 0.12)));
    for (let i = 0; i < bladeCount; i++) {
        state.groundBlades.push({
            x: Math.random() * (w * 2),
            y: Math.random() * 8,
            height: Math.random() * 8 + 4,
            phase: Math.random() * TAU
        });
    }

    const dirtCount = Math.max(45, Math.min(90, Math.floor(w * 0.07)));
    for (let i = 0; i < dirtCount; i++) {
        state.dirtDots.push({
            x: Math.random() * (w * 2),
            y: Math.random() * (groundHeight - 30) + 24,
            radius: Math.random() * 2 + 0.8
        });
    }
}

export function updateBackgroundState(state, options) {
    const {
        gameover,
        ignoreFreeze,
        canvasWidth,
        canvasHeight,
        speed,
        cloudSpeed,
        parallaxFarSpeed,
        parallaxMidSpeed,
        timeScale = 1,
        groundHeight = 100
    } = options;

    if (gameover && !ignoreFreeze) {
        return;
    }

    state.skyCycle += SKY_CYCLE_SPEED * timeScale;
    if (state.skyCycle >= 1) {
        state.skyCycle -= 1;
    }
    state.skyDrift += 0.0035 * timeScale;
    if (state.skyDrift >= TAU) {
        state.skyDrift -= TAU;
    }

    state.groundOffset -= speed;
    if (state.groundOffset <= -canvasWidth) {
        state.groundOffset += canvasWidth;
    }

    state.clouds.forEach(cloud => {
        cloud.x -= cloudSpeed * (0.42 + cloud.depth * 0.95) * cloud.drift;
        cloud.phase += 0.0038 * timeScale;
        cloud.y += Math.sin(cloud.phase) * (0.03 + cloud.depth * 0.04);

        if (cloud.x + cloud.radius * 2.6 < 0) {
            const nextDepth = 0.25 + Math.random() * 0.9;
            cloud.x = canvasWidth + cloud.radius * (1.4 + Math.random() * 1.6);
            cloud.y = Math.random() * (canvasHeight * 0.45) + 16;
            cloud.depth = nextDepth;
            cloud.radius = 15 + Math.random() * 22 + nextDepth * 16;
            cloud.alpha = 0.16 + nextDepth * 0.32;
            cloud.drift = 0.68 + Math.random() * 0.68;
        }
    });

    state.farHills.forEach(hill => {
        hill.x -= speed * parallaxFarSpeed;
        if (hill.x + hill.width < -80) {
            resetParallaxSegment(hill, canvasWidth, 180, 290, 42, 110);
        }
    });

    state.midObjects.forEach(obj => {
        obj.x -= speed * parallaxMidSpeed;
        if (obj.x + obj.width < -70) {
            resetParallaxSegment(obj, canvasWidth, 150, 230, 48, 120);
        }
    });

    state.nearRidges.forEach(ridge => {
        ridge.x -= speed * PARALLAX_NEAR_SPEED;
        if (ridge.x + ridge.width < -60) {
            resetParallaxSegment(ridge, canvasWidth, 120, 185, 34, 90);
        }
    });

    state.floaters.forEach(floater => {
        floater.x -= speed * (0.16 + floater.depth * 0.52);
        floater.phase += (0.018 + floater.depth * 0.025) * timeScale;
        floater.baseY += Math.sin((floater.phase * 0.37) + floater.driftPhase) * 0.05 * timeScale;

        const minY = 10;
        const maxY = canvasHeight - groundHeight - 16;
        floater.baseY = Math.max(minY, Math.min(maxY, floater.baseY));
        floater.y = floater.baseY + Math.sin(floater.phase) * (1.2 + floater.depth * 4.5);

        if (floater.x + floater.size < -8) {
            floater.x = canvasWidth + Math.random() * (canvasWidth * 0.45);
            floater.baseY = Math.random() * Math.max(20, maxY - 12) + 10;
            floater.y = floater.baseY;
            floater.depth = Math.random();
            floater.size = Math.random() * 1.8 + 0.75;
            floater.phase = Math.random() * TAU;
            floater.driftPhase = Math.random() * TAU;
        }
    });

    state.fogBands.forEach(band => {
        band.x -= speed * (0.05 + band.depth * 0.12);
        band.phase += (0.004 + band.depth * 0.008) * timeScale;
        band.y = band.baseY + Math.sin(band.phase) * 2.6;

        if (band.x + band.width * 2 < 0) {
            band.x = canvasWidth + Math.random() * (canvasWidth * 0.5);
            band.baseY = (canvasHeight - groundHeight - 42) + (Math.random() * 34 - 12);
            band.width = Math.random() * 95 + 140;
            band.height = Math.random() * 16 + 20;
            band.alpha = Math.random() * 0.06 + 0.04;
            band.depth = Math.random();
            band.phase = Math.random() * TAU;
        }
    });

    state.groundBlades.forEach(blade => {
        blade.x -= speed;
        blade.phase += 0.045 * timeScale;
        if (blade.x < -4) {
            blade.x += canvasWidth * 2;
        }
    });

    state.dirtDots.forEach(dot => {
        dot.x -= speed * 0.92;
        if (dot.x + dot.radius < 0) {
            dot.x += canvasWidth * 2;
        }
    });
}

export function drawBackgroundState(state, ctx, options) {
    const { w, h, groundHeight, cachedRender, frame } = options;
    const tick = frame || 0;

    const skyInfo = drawDynamicSky(ctx, w, h, state.skyCycle, state.skyDrift, tick);
    drawLightRays(ctx, w, h, skyInfo.sunX, skyInfo.sunY, skyInfo.dayAmount, tick);

    drawCloudDepthRange(ctx, state.clouds, 0, 0.52, skyInfo.dayAmount, tick);

    drawRidgeLayer(ctx, state.farHills, h - groundHeight - 20, `rgba(26, 86, 118, ${0.42 + skyInfo.dayAmount * 0.08})`);
    drawCloudDepthRange(ctx, state.clouds, 0.52, 0.82, skyInfo.dayAmount, tick);

    drawRidgeLayer(ctx, state.midObjects, h - groundHeight - 4, `rgba(20, 113, 122, ${0.54 + skyInfo.dayAmount * 0.08})`);
    drawRidgeLayer(ctx, state.nearRidges, h - groundHeight + 8, `rgba(16, 126, 118, ${0.66 + skyInfo.dayAmount * 0.07})`);

    drawCloudDepthRange(ctx, state.clouds, 0.82, 2, skyInfo.dayAmount, tick);
    drawFloatingParticles(ctx, state.floaters, skyInfo.dayAmount, tick);

    ctx.fillStyle = cachedRender.groundGradient;
    ctx.fillRect(state.groundOffset, h - groundHeight, w, groundHeight);
    ctx.fillRect(state.groundOffset + w, h - groundHeight, w, groundHeight);

    const grassDay = [14, 155, 139];
    const grassNight = [9, 102, 104];
    const grassColor = lerpColor(grassDay, grassNight, skyInfo.nightAmount * 0.7);
    ctx.fillStyle = toRgba(grassColor, 0.95);
    state.groundBlades.forEach(blade => {
        const sway = Math.sin((tick * 0.08) + blade.phase) * 0.8;
        ctx.fillRect(blade.x + sway, h - groundHeight + blade.y, 2, blade.height);
    });

    ctx.fillStyle = `rgba(139, 90, 43, ${0.22 + skyInfo.dayAmount * 0.12})`;
    state.dirtDots.forEach(dot => {
        const y = h - groundHeight + dot.y;
        ctx.beginPath();
        ctx.arc(dot.x, y, dot.radius, 0, TAU);
        ctx.fill();
    });

    drawFogLayer(ctx, state.fogBands, w, h - groundHeight + 2, skyInfo.dayAmount, tick);
}
