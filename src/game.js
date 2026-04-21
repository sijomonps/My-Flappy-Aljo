export function createTextUpdater(element) {
    let lastValue = element ? element.textContent : '';

    return function updateText(value) {
        if (!element) {
            return;
        }

        const nextValue = String(value);
        if (nextValue !== lastValue) {
            element.textContent = nextValue;
            lastValue = nextValue;
        }
    };
}

export function shouldSpawnPipeDistance(lastPipeX, canvasWidth, spacingDistance) {
    return typeof lastPipeX !== 'number' || lastPipeX < canvasWidth - spacingDistance;
}

export function getNextPipeX(lastPipeX, canvasWidth, spacingDistance) {
    return typeof lastPipeX !== 'number'
        ? canvasWidth
        : lastPipeX + spacingDistance;
}

export function configureCanvasSize(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.logicalWidth = rect.width;
    canvas.logicalHeight = rect.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
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
