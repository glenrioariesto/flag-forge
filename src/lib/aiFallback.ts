import { DEFAULT_COUNTRY, DEFAULT_WEAPON } from "@/types/game";

/**
 * Local fallback replies for flag chat when AI API is unavailable.
 * Usable from both server (route.ts) and client (ChatWindow.tsx).
 * Keeps responses short, competitive & funny, under 50 words.
 */

const TEMPLATES: Array<(country: string, weapon: string, userText: string) => string> = [
    (c, w) => `Ha! ${c} with ${w} fears nothing! Bring it on! 🚩💥`,
    (c, w) => `${c} here! My ${w} is locked and loaded. You can't stop me! 😤🚩`,
    (c, w, u) => `Haha "${truncate(u)}" — cute! But ${c} is winning this battle! 🏆`,
    (c, w) => `Woi! ${c} maju terus! ${w} siap menembak! Siapa berani lawan? 🔥`,
    (c, w) => `Boom! ${c} menyerang dengan ${w}! Arena ini milikku! 💣🚩`,
    (c, w) => `Hehe, aku ${c}! Peluru ${w}-ku tak pernah meleset. Coba saja kejar! ⚡`,
];

function truncate(s: string, max = 30): string {
    const t = (s || "").trim().replace(/\s+/g, " ");
    if (!t) return "that";
    return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function getLocalFallbackReply(
    country: string,
    weapon: string,
    userMessage: string,
): string {
    const c = (country || DEFAULT_COUNTRY).toUpperCase();
    const w = weapon || DEFAULT_WEAPON;
    const pick = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    return pick(c, w, userMessage);
}

/** Shape compatible with OpenAI chat completion for the UI. */
export function buildFallbackCompletion(
    country: string,
    weapon: string,
    userMessage: string,
) {
    return {
        choices: [
            {
                message: {
                    role: "assistant" as const,
                    content: getLocalFallbackReply(country, weapon, userMessage),
                },
            },
        ],
        isFallback: true,
    };
}
