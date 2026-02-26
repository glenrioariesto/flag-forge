export type WeaponType = "cannon" | "laser" | "rocket";

export interface FlagData {
    id: string;
    country: string;
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
