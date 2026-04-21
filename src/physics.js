export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function computeTimeScale(deltaTime, targetFps = 60) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
        return 1;
    }

    const clampedDelta = Math.min(deltaTime, 0.1);
    return clampedDelta / (1 / targetFps);
}

export function updateCameraState(camera, timeScale = 1) {
    const damp = Math.pow(0.86, timeScale);
    camera.x *= damp;
    camera.y *= damp;

    camera.y += camera.kick;
    camera.kick *= Math.pow(0.45, timeScale);

    if (camera.shake > 0.001) {
        const shakePower = camera.shake * 5;
        camera.x += (Math.random() - 0.5) * shakePower;
        camera.y += (Math.random() - 0.5) * shakePower;
        camera.shake *= Math.pow(0.84, timeScale);
    } else {
        camera.shake = 0;
    }
}
