// Single source of truth for weapons. The engine rotates this array at runtime
// and the overlay renders from the type derived off it, so a weapon added here
// cannot drift out of sync on one side.
export const WEAPON_TYPES = ["cannon", "laser", "rocket"] as const;

export type WeaponType = (typeof WEAPON_TYPES)[number];

// Assumed country/weapon when the real one is unknown. Both the chat-context
// extractor and the local reply builder need this fallback, so it is declared
// once here instead of being re-typed as a literal at each site.
export const DEFAULT_COUNTRY = "ID";
export const DEFAULT_WEAPON: WeaponType = "cannon";

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
