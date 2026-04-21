export function ensureRenderCache(cache, ctx, width, height, groundHeight, pipeWidth) {
    if (
        cache.width === width
        && cache.height === height
        && cache.groundHeight === groundHeight
        && cache.pipeWidth === pipeWidth
    ) {
        return cache;
    }

    cache.width = width;
    cache.height = height;
    cache.groundHeight = groundHeight;
    cache.pipeWidth = pipeWidth;

    cache.skyGradient = ctx.createLinearGradient(0, 0, 0, height);
    cache.skyGradient.addColorStop(0, '#8fd8ff');
    cache.skyGradient.addColorStop(0.58, '#73cfd6');
    cache.skyGradient.addColorStop(1, '#4baec3');

    cache.groundGradient = ctx.createLinearGradient(0, height - groundHeight, 0, height);
    cache.groundGradient.addColorStop(0, '#10b981');
    cache.groundGradient.addColorStop(0.15, '#059669');
    cache.groundGradient.addColorStop(0.15, '#d4a574');
    cache.groundGradient.addColorStop(1, '#a67c52');

    // Vertical gradients are reusable for all pipe x positions.
    cache.pipeGradient = ctx.createLinearGradient(0, 0, 0, height);
    cache.pipeGradient.addColorStop(0, '#4ade80');
    cache.pipeGradient.addColorStop(0.4, '#10b981');
    cache.pipeGradient.addColorStop(1, '#065f46');

    cache.capGradient = ctx.createLinearGradient(0, 0, 0, 40);
    cache.capGradient.addColorStop(0, '#86efac');
    cache.capGradient.addColorStop(0.5, '#22c55e');
    cache.capGradient.addColorStop(1, '#166534');

    cache.vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        Math.min(width, height) * 0.35,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.82
    );
    cache.vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    cache.vignette.addColorStop(1, 'rgba(0, 0, 0, 0.18)');

    return cache;
}
