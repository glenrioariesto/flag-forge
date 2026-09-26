export type WeaponType = "cannon" | "laser" | "rocket";

export interface FlagData {
    id: string;
    country: string;
    author?: string;
    isBot?: boolean;
    x: number;
    y: number;
    weapon: WeaponType;
}

export interface BulletData {
    id: string;
    x: number;
    y: number;
    weapon: WeaponType;
}

export interface LeaderboardData {
    country: string;
    score: number;
}

export interface RoundWinner {
    country: string;
    score: number;
}

export interface GameStatePayload {
    flags: FlagData[];
    bullets: BulletData[];
    leaderboard: LeaderboardData[];
    roundTimeLeft: number;
    roundDuration: number;
    roundNumber: number;
    winnerBanner: RoundWinner | null;
    totalSpawns: number;
}
