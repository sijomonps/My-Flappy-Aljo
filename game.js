export function computeTimeScale(deltaTime, targetFps = 60) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
        return 1;
    }

    const clamped = Math.min(deltaTime, 0.1);
    return clamped / (1 / targetFps);
}

export function shouldSpawnPipeDistance(lastPipeX, canvasWidth, spacingDistance) {
    return typeof lastPipeX !== 'number' || lastPipeX < canvasWidth - spacingDistance;
}

export function getNextPipeX(lastPipeX, canvasWidth, spacingDistance) {
    return typeof lastPipeX !== 'number'
        ? canvasWidth
        : lastPipeX + spacingDistance;
}

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
