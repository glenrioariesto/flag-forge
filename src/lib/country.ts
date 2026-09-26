/**
 * Pure country-code parser for live-chat messages.
 * Aliases are checked FIRST so words like "INDONESIA" resolve correctly
 * (previously the generic 2-4 char rule shadowed them).
 */

const ALIASES: Array<{ keys: string[]; code: string }> = [
    { keys: ["INDONESIA", "INDO"], code: "ID" },
    { keys: ["AMERICA", "USA"], code: "US" },
    { keys: ["JAPAN", "NIPPON"], code: "JP" },
    { keys: ["KOREA"], code: "KR" },
    { keys: ["BRAZIL"], code: "BR" },
    { keys: ["GERMANY"], code: "DE" },
    { keys: ["FRANCE"], code: "FR" },
];

export function extractCountryCode(text: string): string | null {
    const cleaned = (text || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
    if (!cleaned) return null;

    for (const alias of ALIASES) {
        if (alias.keys.some((k) => cleaned.includes(k))) return alias.code;
    }

    if (cleaned.length >= 2 && cleaned.length <= 4) {
        return cleaned.slice(0, 2);
    }
    return null;
}
