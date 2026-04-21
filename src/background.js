export function createBackgroundState() {
    return {
        groundOffset: 0,
        clouds: [],
        farHills: [],
        midObjects: [],
        groundBlades: [],
        dirtDots: []
    };
}

export function initBackgroundState(state, canvas, groundHeight) {
    state.groundOffset = 0;
    state.clouds = [];
    state.farHills = [];
    state.midObjects = [];
    state.groundBlades = [];
    state.dirtDots = [];

    const w = canvas.logicalWidth || canvas.width;
    const h = canvas.logicalHeight || canvas.height;

    for (let i = 0; i < 5; i++) {
        state.clouds.push({
            x: Math.random() * w,
            y: Math.random() * (h / 2) + 20,
            radius: Math.random() * 20 + 20
        });
    }

    for (let i = 0; i < 7; i++) {
        state.farHills.push({
            x: (i * w) / 3.2,
            width: Math.random() * 160 + 170,
            height: Math.random() * 75 + 55
        });
    }

    for (let i = 0; i < 10; i++) {
        state.midObjects.push({
            x: (i * w) / 2.2,
            width: Math.random() * 110 + 110,
            height: Math.random() * 70 + 30
        });
    }

    for (let i = 0; i < 70; i++) {
        state.groundBlades.push({
            x: Math.random() * (w * 2),
            y: Math.random() * 8,
            height: Math.random() * 8 + 4,
            phase: Math.random() * Math.PI * 2
        });
    }

    for (let i = 0; i < 45; i++) {
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
        parallaxMidSpeed
    } = options;

    if (gameover && !ignoreFreeze) {
        return;
    }

    state.groundOffset -= speed;
    if (state.groundOffset <= -canvasWidth) {
        state.groundOffset += canvasWidth;
    }

    state.clouds.forEach(cloud => {
        cloud.x -= cloudSpeed;
        if (cloud.x + cloud.radius * 2 < 0) {
            cloud.x = canvasWidth + cloud.radius * 2;
            cloud.y = Math.random() * (canvasHeight / 2) + 20;
        }
    });

    state.farHills.forEach(hill => {
        hill.x -= speed * parallaxFarSpeed;
        if (hill.x + hill.width < -40) {
            hill.x = canvasWidth + Math.random() * canvasWidth * 0.4;
            hill.width = Math.random() * 160 + 170;
            hill.height = Math.random() * 75 + 55;
        }
    });

    state.midObjects.forEach(obj => {
        obj.x -= speed * parallaxMidSpeed;
        if (obj.x + obj.width < -30) {
            obj.x = canvasWidth + Math.random() * canvasWidth * 0.3;
            obj.width = Math.random() * 110 + 110;
            obj.height = Math.random() * 70 + 30;
        }
    });

    state.groundBlades.forEach(blade => {
        blade.x -= speed;
        blade.phase += 0.045;
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

    const horizonY = h - groundHeight - 20;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, horizonY - 120, w, 140);

    state.farHills.forEach(hill => {
        const baseY = h - groundHeight - 14;
        ctx.fillStyle = 'rgba(4, 120, 87, 0.34)';

        ctx.beginPath();
        ctx.moveTo(hill.x, baseY);
        ctx.quadraticCurveTo(hill.x + hill.width * 0.25, baseY - hill.height, hill.x + hill.width * 0.52, baseY - hill.height * 0.45);
        ctx.quadraticCurveTo(hill.x + hill.width * 0.76, baseY - hill.height * 0.1, hill.x + hill.width, baseY);
        ctx.closePath();
        ctx.fill();
    });

    state.midObjects.forEach(obj => {
        const baseY = h - groundHeight + 4;
        ctx.fillStyle = 'rgba(15, 118, 110, 0.5)';

        ctx.beginPath();
        ctx.moveTo(obj.x, baseY);
        ctx.quadraticCurveTo(obj.x + obj.width * 0.2, baseY - obj.height, obj.x + obj.width * 0.44, baseY - obj.height * 0.55);
        ctx.quadraticCurveTo(obj.x + obj.width * 0.72, baseY - obj.height * 0.2, obj.x + obj.width, baseY);
        ctx.closePath();
        ctx.fill();
    });

    state.clouds.forEach(cloud => {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';

        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.radius * 0.8, cloud.y - cloud.radius * 0.3, cloud.radius * 0.8, 0, Math.PI * 2);
        ctx.arc(cloud.x - cloud.radius * 0.7, cloud.y - cloud.radius * 0.2, cloud.radius * 0.7, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.radius * 0.3, cloud.y + cloud.radius * 0.4, cloud.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    ctx.fillStyle = cachedRender.groundGradient;
    ctx.fillRect(state.groundOffset, h - groundHeight, w, groundHeight);
    ctx.fillRect(state.groundOffset + w, h - groundHeight, w, groundHeight);

    ctx.fillStyle = '#0d9488';
    state.groundBlades.forEach(blade => {
        const sway = Math.sin(((frame || 0) * 0.08) + blade.phase) * 0.8;
        ctx.fillRect(blade.x + sway, h - groundHeight + blade.y, 2, blade.height);
    });

    ctx.fillStyle = 'rgba(139, 90, 43, 0.3)';
    state.dirtDots.forEach(dot => {
        const y = h - groundHeight + dot.y;
        ctx.beginPath();
        ctx.arc(dot.x, y, dot.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}
