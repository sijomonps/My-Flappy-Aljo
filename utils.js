export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function configureCanvasSize(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.logicalWidth = rect.width;
    canvas.logicalHeight = rect.height;

    // Reset transform before scaling to prevent blur/compounded scaling.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    return {
        dpr,
        width: rect.width,
        height: rect.height
    };
}

export function drawRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));

    if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, r);
        ctx.fill();
        return;
    }

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
}

export function ensureImageAsset(asset, src) {
    if (asset || !src) {
        return asset;
    }

    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    return image;
}

export function ensureAudioAsset(asset, src) {
    if (asset || !src) {
        return asset;
    }

    const audio = new Audio();
    audio.preload = 'none';
    audio.src = src;
    return audio;
}
