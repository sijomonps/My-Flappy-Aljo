import { clamp } from './physics.js';

export class ParticleSystem {
    constructor(maxParticles = 150) {
        this.maxParticles = maxParticles;
        this.active = [];
        this.pool = [];
    }

    reset() {
        while (this.active.length > 0) {
            this.pool.push(this.active.pop());
        }
    }

    create(config) {
        let particle;

        if (this.active.length >= this.maxParticles) {
            particle = this.active.shift();
        } else {
            particle = this.pool.pop() || {};
        }

        particle.x = config.x;
        particle.y = config.y;
        particle.vx = config.vx || 0;
        particle.vy = config.vy || 0;
        particle.life = config.life || 1;
        particle.maxLife = config.life || 1;
        particle.size = config.size || 2;
        particle.sizeGrowth = config.sizeGrowth || 0;
        particle.drag = config.drag || 0.95;
        particle.gravity = config.gravity || 0.08;
        particle.fade = config.fade || 0.02;
        particle.color = config.color || 'rgba(255,255,255,0.9)';
        particle.glow = config.glow || 0;

        this.active.push(particle);
        return particle;
    }

    spawnScoreBurst(x, y) {
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.25;
            const speed = 1.3 + Math.random() * 1.8;
            this.create({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.8,
                life: 0.7,
                size: Math.random() * 2.3 + 1.6,
                sizeGrowth: 0.01,
                drag: 0.94,
                gravity: 0.05,
                fade: 0.034,
                color: `hsl(${Math.random() * 40 + 155}, 100%, 56%)`,
                glow: 4
            });
        }
    }

    spawnFlapBurst(x, y) {
        for (let i = 0; i < 5; i++) {
            const spread = (Math.random() - 0.5) * 1.3;
            this.create({
                x: x - 8 + Math.random() * 8,
                y: y + 16 + Math.random() * 8,
                vx: -0.6 + spread,
                vy: 0.8 + Math.random() * 1.6,
                life: 0.42,
                size: Math.random() * 1.7 + 1,
                sizeGrowth: -0.01,
                drag: 0.92,
                gravity: 0.025,
                fade: 0.04,
                color: 'rgba(255,255,255,0.78)',
                glow: 0
            });
        }
    }

    spawnTrail(x, y, velocity) {
        const speedFactor = clamp(Math.abs(velocity) / 10, 0, 1);
        this.create({
            x: x - 10 + Math.random() * 5,
            y: y + (Math.random() - 0.5) * 10,
            vx: -1 - Math.random() * 0.5,
            vy: 0.4 + velocity * 0.025 + (Math.random() - 0.5) * 0.3,
            life: 0.3,
            size: 1.2 + speedFactor,
            sizeGrowth: 0.01,
            drag: 0.9,
            gravity: 0.018,
            fade: 0.05,
            color: 'rgba(255,255,255,0.65)',
            glow: 0
        });
    }

    spawnCollisionBurst(x, y) {
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20 + (Math.random() - 0.5) * 0.2;
            const speed = 1.6 + Math.random() * 3.3;
            this.create({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.4,
                life: 0.8,
                size: Math.random() * 3 + 1.2,
                sizeGrowth: -0.012,
                drag: 0.92,
                gravity: 0.07,
                fade: 0.03,
                color: `hsl(${Math.random() * 60}, 100%, 55%)`,
                glow: 5
            });
        }
    }

    spawnNearMissBurst(x, y) {
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.2;
            const speed = 1.1 + Math.random();
            this.create({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.4,
                size: Math.random() * 1.4 + 1,
                sizeGrowth: -0.008,
                drag: 0.93,
                gravity: 0.02,
                fade: 0.055,
                color: 'rgba(251,191,36,0.88)',
                glow: 3
            });
        }
    }

    update(timeScale = 1) {
        const step = Math.max(0.45, timeScale);

        for (let i = this.active.length - 1; i >= 0; i--) {
            const p = this.active[i];

            p.vx *= Math.pow(p.drag, step);
            p.vy *= Math.pow(p.drag, step);
            p.x += p.vx * step;
            p.y += p.vy * step;
            p.vy += p.gravity * step;
            p.size += p.sizeGrowth * step;
            p.life -= p.fade * step;

            if (p.life <= 0 || p.size <= 0.2) {
                this.pool.push(p);
                this.active[i] = this.active[this.active.length - 1];
                this.active.pop();
            }
        }
    }

    draw(ctx) {
        const activeCount = this.active.length;
        const glowLimit = Math.min(24, activeCount);

        for (let i = 0; i < activeCount; i++) {
            const p = this.active[i];
            const alpha = clamp(p.life / p.maxLife, 0, 1);

            ctx.globalAlpha = alpha * alpha;
            if (p.glow > 0 && i < glowLimit) {
                ctx.shadowColor = p.color;
                ctx.shadowBlur = Math.min(p.glow, 5);
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }
}
