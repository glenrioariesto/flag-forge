/**
 * Extracts flag-chat context (country / weapon / last user message)
 * from an OpenAI-style message list. Pure function, unit-testable.
 */

export type ChatContext = {
    country: string;
    weapon: string;
    userMessage: string;
};

type Msg = { role?: unknown; content?: unknown };

export function extractContext(messages: unknown): ChatContext {
    let country = "ID";
    let weapon = "cannon";
    let userMessage = "";

    if (!Array.isArray(messages)) return { country, weapon, userMessage };

    const system = (messages as Msg[]).find(
        (m): m is { role: string; content: string } =>
            typeof m === "object" &&
            m !== null &&
            (m as Msg).role === "system" &&
            typeof (m as Msg).content === "string",
    );
    if (system) {
        const flagMatch = system.content.match(/flag of\s+([A-Za-z]{2,10})/i);
        if (flagMatch) country = flagMatch[1].toUpperCase();
        const weaponMatch = system.content.match(/have a\s+(\w+)\s+weapon/i);
        if (weaponMatch) weapon = weaponMatch[1].toLowerCase();
    }

    for (let i = (messages as Msg[]).length - 1; i >= 0; i--) {
        const m = (messages as Msg[])[i];
        if (m?.role === "user" && typeof m.content === "string") {
            userMessage = m.content;
            break;
        }
    }

    return { country, weapon, userMessage };
}
