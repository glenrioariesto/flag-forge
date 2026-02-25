import { Room, Client } from "colyseus";
import { youtubeChat } from "../services/youtube";

const weaponTypes = ["cannon", "laser", "rocket"] as const;
type WeaponType = (typeof weaponTypes)[number];

type FlagEntity = {
    id: string;
    country: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    weapon: WeaponType;
    cooldownMs: number;
};

type BulletEntity = {
    id: string;
    ownerId: string;
    ownerCountry: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    weapon: WeaponType;
};

export class FlagRoom extends Room {
    private flags: FlagEntity[] = [];
    private bullets: BulletEntity[] = [];
    private tickTimer: NodeJS.Timeout | null = null;
    private tickRate = 30;
    private broadcastEvery = 3;
    private tickCount = 0;
    private nextId = 0;
    private nextWeaponIndex = 0;
    private scores = new Map<string, number>();
    private spawnQueue: string[] = [];
    private maxActiveFlags = 24;
    private maxQueueSize = 200;
    private spawnRatePerSecond = 4;
    private spawnAccumulator = 0;

    onCreate() {
        this.maxClients = 100;

        youtubeChat.on("chat_message", (data) => {
            const country = String(data.message || "").trim().toUpperCase();
            if (!country) return;
            this.enqueueSpawn(country);
        });

        const interval = Math.floor(1000 / this.tickRate);
        this.tickTimer = setInterval(() => this.step(1 / this.tickRate), interval);
    }

    onJoin(client: Client) {
        client.send("state", this.getStatePayload());
    }

    onLeave(client: Client, code?: number) {
        console.log(client.sessionId, "left with code", code);
    }

    onDispose() {
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
        }
    }

    private step(dt: number) {
        this.updateFlags(dt);
        this.updateBullets(dt);
        this.resolveCollisions();
        this.processSpawnQueue(dt);

        this.tickCount += 1;
        if (this.tickCount % this.broadcastEvery === 0) {
            this.broadcast("state", this.getStatePayload());
        }
    }

    private spawnFlag(country: string) {
        const id = `f_${this.nextId++}`;
        const x = 10 + Math.random() * 80;
        const y = 10 + Math.random() * 80;
        const speed = 8 + Math.random() * 6;
        const angle = Math.random() * Math.PI * 2;
        const weapon = weaponTypes[this.nextWeaponIndex % weaponTypes.length];
        this.nextWeaponIndex += 1;

        const flag: FlagEntity = {
            id,
            country,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            weapon,
            cooldownMs: this.weaponCooldownMs(weapon)
        };

        this.flags.unshift(flag);

        this.broadcast("spawn", { country, weapon });
    }

    private enqueueSpawn(country: string) {
        if (this.spawnQueue.length >= this.maxQueueSize) {
            this.spawnQueue.shift();
        }
        this.spawnQueue.push(country);
    }

    private processSpawnQueue(dt: number) {
        if (this.spawnQueue.length === 0) return;
        if (this.flags.length >= this.maxActiveFlags) return;

        this.spawnAccumulator += dt * this.spawnRatePerSecond;
        const availableSlots = this.maxActiveFlags - this.flags.length;
        const spawnCount = Math.min(availableSlots, Math.floor(this.spawnAccumulator));
        if (spawnCount <= 0) return;
        this.spawnAccumulator -= spawnCount;

        for (let i = 0; i < spawnCount; i += 1) {
            const country = this.spawnQueue.shift();
            if (!country) break;
            this.spawnFlag(country);
        }
    }

    private updateFlags(dt: number) {
        const dtMs = dt * 1000;
        for (const flag of this.flags) {
            flag.x += flag.vx * dt;
            flag.y += flag.vy * dt;

            if (flag.x < 3) {
                flag.x = 3;
                flag.vx *= -1;
            }
            if (flag.x > 97) {
                flag.x = 97;
                flag.vx *= -1;
            }
            if (flag.y < 3) {
                flag.y = 3;
                flag.vy *= -1;
            }
            if (flag.y > 97) {
                flag.y = 97;
                flag.vy *= -1;
            }

            flag.cooldownMs -= dtMs;
            if (flag.cooldownMs <= 0) {
                this.spawnBullet(flag);
                flag.cooldownMs = this.weaponCooldownMs(flag.weapon);
            }
        }
    }

    private updateBullets(dt: number) {
        for (const bullet of this.bullets) {
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
        }

        this.bullets = this.bullets.filter((bullet) => {
            return bullet.x >= -5 && bullet.x <= 105 && bullet.y >= -5 && bullet.y <= 105;
        });
    }

    private resolveCollisions() {
        if (this.bullets.length === 0 || this.flags.length === 0) return;

        const hitFlagIds = new Set<string>();
        const hitBulletIds = new Set<string>();
        const scoreGains: Record<string, number> = {};

        for (const bullet of this.bullets) {
            for (const flag of this.flags) {
                if (bullet.ownerId === flag.id) continue;
                const dx = bullet.x - flag.x;
                const dy = bullet.y - flag.y;
                if (dx * dx + dy * dy < 9) {
                    hitFlagIds.add(flag.id);
                    scoreGains[bullet.ownerCountry] = (scoreGains[bullet.ownerCountry] ?? 0) + 1;
                    hitBulletIds.add(bullet.id);
                    break;
                }
            }
        }

        if (hitFlagIds.size > 0) {
            this.flags = this.flags.filter((flag) => !hitFlagIds.has(flag.id));
        }
        if (hitBulletIds.size > 0) {
            this.bullets = this.bullets.filter((bullet) => !hitBulletIds.has(bullet.id));
        }
        for (const [country, gain] of Object.entries(scoreGains)) {
            const current = this.scores.get(country) ?? 0;
            this.scores.set(country, current + gain);
        }
    }

    private spawnBullet(flag: FlagEntity) {
        const id = `b_${this.nextId++}`;
        const baseSpeed = this.weaponSpeed(flag.weapon);
        const direction = this.normalizeVector(flag.vx, flag.vy);
        const vx = direction.x * baseSpeed;
        const vy = direction.y * baseSpeed;
        const bullet: BulletEntity = {
            id,
            ownerId: flag.id,
            ownerCountry: flag.country,
            x: flag.x,
            y: flag.y,
            vx,
            vy,
            weapon: flag.weapon
        };
        this.bullets.push(bullet);
        if (this.bullets.length > 120) {
            this.bullets.shift();
        }
    }

    private normalizeVector(x: number, y: number) {
        const length = Math.hypot(x, y) || 1;
        return { x: x / length, y: y / length };
    }

    private weaponCooldownMs(weapon: WeaponType) {
        if (weapon === "laser") return 700;
        if (weapon === "rocket") return 1200;
        return 900;
    }

    private weaponSpeed(weapon: WeaponType) {
        if (weapon === "laser") return 40;
        if (weapon === "rocket") return 28;
        return 32;
    }

    private getLeaderboard() {
        return Array.from(this.scores.entries())
            .map(([country, score]) => ({ country, score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
    }

    private getStatePayload() {
        return {
            flags: this.flags.map((flag) => ({
                id: flag.id,
                country: flag.country,
                x: flag.x,
                y: flag.y,
                weapon: flag.weapon
            })),
            bullets: this.bullets.map((bullet) => ({
                id: bullet.id,
                x: bullet.x,
                y: bullet.y,
                weapon: bullet.weapon
            })),
            leaderboard: this.getLeaderboard()
        };
    }
}
