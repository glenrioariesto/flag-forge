import { Room, Client } from "colyseus";
import { youtubeChat, ChatMessage } from "../services/youtube";
import { GameStatePayload, WeaponType } from "../types/game";
import { extractCountryCode } from "../lib/country";

const weaponTypes = ["cannon", "laser", "rocket"] as const;

const BOT_COUNTRIES = [
    "ID", "US", "JP", "BR", "FR", "DE", "KR", "GB",
    "CA", "AU", "ES", "IT", "NL", "IN", "MX", "PH",
    "VN", "SG", "MY", "TH", "SA", "AR", "TR", "PL"
];

type FlagEntity = {
    id: string;
    country: string;
    author?: string;
    isBot: boolean;
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
    private spawnQueue: { country: string; author: string; isBot: boolean }[] = [];
    private maxActiveFlags = 20;
    private maxQueueSize = 200;
    private spawnRatePerSecond = 4;
    private spawnAccumulator = 0;

    // --- Round & Autonomous Idle Loop Settings ---
    private lastUserChatTime = Date.now();
    private idleBotTimer = 0;
    private roundDuration = 600; // 10 minutes per round
    private roundTimeLeft = 600;
    private roundNumber = 1;
    private winnerBanner: { country: string; score: number } | null = null;
    private winnerBannerTimer = 0;
    private totalSpawns = 0;

    onCreate() {
        this.maxClients = 150;

        youtubeChat.on("chat_message", (data: ChatMessage) => {
            const raw = String(data.message || "").trim();
            // Match 2-3 letter country code or known flag aliases
            const cleanCountry = this.extractCountryCode(raw);
            if (!cleanCountry) return;

            this.lastUserChatTime = Date.now();
            this.enqueueSpawn(cleanCountry, data.author || "Viewer", false);
        });

        const interval = Math.floor(1000 / this.tickRate);
        this.tickTimer = setInterval(() => this.step(1 / this.tickRate), interval);

        // Pre-populate with initial friendly bots so screen is lively immediately
        this.populateInitialBots();
    }

    private populateInitialBots() {
        const initial = ["ID", "US", "JP", "BR", "FR", "KR", "DE", "GB"];
        for (const code of initial) {
            this.enqueueSpawn(code, `Bot_${code}`, true);
        }
    }

    onJoin(client: Client) {
        client.send("state", this.getStatePayload());
    }

    onLeave(client: Client, code?: number) {
        console.log(`[Colyseus] Client ${client.sessionId} disconnected (code ${code})`);
    }

    onDispose() {
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
        }
    }

    private step(dt: number) {
        this.updateRound(dt);
        this.updateIdleBotSpawner(dt);
        this.updateFlags(dt);
        this.updateBullets(dt);
        this.resolveCollisions();
        this.processSpawnQueue(dt);

        this.tickCount += 1;
        if (this.tickCount % this.broadcastEvery === 0) {
            this.broadcast("state", this.getStatePayload());
        }
    }

    // --- Round Management (Leaderboard Reset Loop) ---
    private updateRound(dt: number) {
        if (this.winnerBannerTimer > 0) {
            this.winnerBannerTimer -= dt;
            if (this.winnerBannerTimer <= 0) {
                this.winnerBanner = null;
                this.scores.clear();
                this.roundTimeLeft = this.roundDuration;
                this.roundNumber += 1;
                this.broadcast("round_start", { roundNumber: this.roundNumber });
            }
            return;
        }

        this.roundTimeLeft -= dt;
        if (this.roundTimeLeft <= 0) {
            // Determine winner
            const topLeader = this.getLeaderboard()[0];
            const winner = topLeader ? { country: topLeader.country, score: topLeader.score } : { country: "ID", score: 0 };
            this.winnerBanner = winner;
            this.winnerBannerTimer = 7; // Show winner banner for 7 seconds
            this.broadcast("round_winner", winner);
        }
    }

    // --- Autonomous Idle Simulation Spawner ---
    private updateIdleBotSpawner(dt: number) {
        // If chat is quiet for > 5 seconds or active flags drop below 8, spawn AI bots
        const isIdle = (Date.now() - this.lastUserChatTime) > 6000;
        const needsFlags = this.flags.length < 8;

        if (isIdle || needsFlags) {
            this.idleBotTimer += dt;
            const spawnInterval = needsFlags ? 1.5 : 4.0; // Faster when arena is empty

            if (this.idleBotTimer >= spawnInterval && this.flags.length < this.maxActiveFlags) {
                this.idleBotTimer = 0;
                const randomCountry = BOT_COUNTRIES[Math.floor(Math.random() * BOT_COUNTRIES.length)];
                this.enqueueSpawn(randomCountry, `Bot_${randomCountry}`, true);
            }
        } else {
            this.idleBotTimer = 0;
        }
    }

    private extractCountryCode(text: string): string | null {
        return extractCountryCode(text);
    }

    private spawnFlag(country: string, author: string, isBot: boolean) {
        const id = `f_${this.nextId++}`;
        const x = 10 + Math.random() * 80;
        const y = 10 + Math.random() * 80;
        const speed = isBot ? (6 + Math.random() * 5) : (8 + Math.random() * 6);
        const angle = Math.random() * Math.PI * 2;
        const weapon = weaponTypes[this.nextWeaponIndex % weaponTypes.length];
        this.nextWeaponIndex += 1;

        const flag: FlagEntity = {
            id,
            country,
            author,
            isBot,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            weapon,
            cooldownMs: this.weaponCooldownMs(weapon)
        };

        this.flags.unshift(flag);
        this.totalSpawns += 1;

        this.broadcast("spawn", { 
            country, 
            weapon, 
            author, 
            isBot,
            x,
            y 
        });
    }

    private enqueueSpawn(country: string, author: string, isBot: boolean) {
        if (this.spawnQueue.length >= this.maxQueueSize) {
            this.spawnQueue.shift();
        }
        // Real user chat goes to the front of the queue, bots go to the back
        if (!isBot) {
            this.spawnQueue.unshift({ country, author, isBot });
        } else {
            this.spawnQueue.push({ country, author, isBot });
        }
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
            const item = this.spawnQueue.shift();
            if (!item) break;
            this.spawnFlag(item.country, item.author, item.isBot);
        }
    }

    private updateFlags(dt: number) {
        const dtMs = dt * 1000;
        for (const flag of this.flags) {
            flag.x += flag.vx * dt;
            flag.y += flag.vy * dt;

            if (flag.x < 4) {
                flag.x = 4;
                flag.vx = Math.abs(flag.vx);
            }
            if (flag.x > 96) {
                flag.x = 96;
                flag.vx = -Math.abs(flag.vx);
            }
            if (flag.y < 4) {
                flag.y = 4;
                flag.vy = Math.abs(flag.vy);
            }
            if (flag.y > 96) {
                flag.y = 96;
                flag.vy = -Math.abs(flag.vy);
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
                if (dx * dx + dy * dy < 8) {
                    hitFlagIds.add(flag.id);
                    scoreGains[bullet.ownerCountry] = (scoreGains[bullet.ownerCountry] ?? 0) + 1;
                    hitBulletIds.add(bullet.id);

                    // Broadcast sound & hit event
                    this.broadcast("hit", {
                        country: bullet.ownerCountry,
                        victimCountry: flag.country,
                        x: flag.x,
                        y: flag.y,
                        weapon: bullet.weapon
                    });
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
        if (this.bullets.length > 100) {
            this.bullets.shift();
        }
    }

    private normalizeVector(x: number, y: number) {
        const length = Math.hypot(x, y) || 1;
        return { x: x / length, y: y / length };
    }

    private weaponCooldownMs(weapon: WeaponType) {
        if (weapon === "laser") return 750;
        if (weapon === "rocket") return 1300;
        return 950;
    }

    private weaponSpeed(weapon: WeaponType) {
        if (weapon === "laser") return 38;
        if (weapon === "rocket") return 26;
        return 30;
    }

    private getLeaderboard() {
        return Array.from(this.scores.entries())
            .map(([country, score]) => ({ country, score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
    }

    private getStatePayload(): GameStatePayload {
        return {
            flags: this.flags.map((flag) => ({
                id: flag.id,
                country: flag.country,
                author: flag.author,
                isBot: flag.isBot,
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
            leaderboard: this.getLeaderboard(),
            roundTimeLeft: Math.max(0, Math.ceil(this.roundTimeLeft)),
            roundDuration: this.roundDuration,
            roundNumber: this.roundNumber,
            winnerBanner: this.winnerBanner,
            totalSpawns: this.totalSpawns
        };
    }
}
