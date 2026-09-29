import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting for the public /api/chat route.
 *
 * The route is unauthenticated and every accepted request can spend OpenRouter
 * credit, so it needs a per-client ceiling. Upstash is used because it is
 * HTTP-based: no connection pool to manage in a long-running `tsx server.ts`
 * process, and it still enforces a shared limit across replicas.
 *
 * Configuration (see .env.example):
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN  - required to enable
 *   CHAT_RATE_LIMIT_MAX   - requests per window (default 10)
 *   CHAT_RATE_LIMIT_WINDOW - window size (default "1 m")
 *
 * When Upstash is not configured this fails OPEN and warns once. That is a
 * deliberate trade-off: the alternative is an overlay whose AI chat 500s for
 * every viewer because a rate-limit vendor had a bad afternoon. The warning is
 * loud and unrepeated so an unprotected deployment is obvious in the logs.
 */

const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_WINDOW: Duration = "1 m";

/** Mirrors Upstash's `Duration`, which is a template-literal type. */
type Duration = `${number} ${Unit}` | `${number}${Unit}`;
type Unit = "ms" | "s" | "m" | "h" | "d" | "w";

const DURATION_PATTERN = new RegExp(`^\\d+\\s?(${["ms", "s", "m", "h", "d", "w"].join("|")})$`);

export type RateLimitConfig = {
    enabled: boolean;
    maxRequests: number;
    window: Duration;
};

export type RateLimitDecision = {
    limited: boolean;
    limit: number;
    remaining: number;
    /** Unix timestamp in ms at which the window resets. */
    resetMs: number;
};

const ALLOWED: RateLimitDecision = { limited: false, limit: 0, remaining: 0, resetMs: 0 };

export function readRateLimitConfig(env: NodeJS.ProcessEnv = process.env): RateLimitConfig {
    const parsed = env.CHAT_RATE_LIMIT_MAX ? Number.parseInt(env.CHAT_RATE_LIMIT_MAX, 10) : Number.NaN;
    // An unparseable window must not reach `Ratelimit.slidingWindow`, which
    // expects a well-formed duration and would throw at first request.
    const window = (env.CHAT_RATE_LIMIT_WINDOW ?? "").trim();
    return {
        enabled: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
        maxRequests: Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_REQUESTS,
        window: DURATION_PATTERN.test(window) ? (window as Duration) : DEFAULT_WINDOW,
    };
}

/**
 * Best-effort client identity.
 *
 * `x-forwarded-for` holds a chain, left-most entry first, appended by each hop.
 * Only trustworthy when a proxy you control strips client-supplied values
 * before setting it; on a bare Node server behind nothing, a caller can forge
 * it and buy themselves a fresh bucket. `x-real-ip` is the fallback for hosts
 * that do not emit the chain.
 */
export function extractClientIp(headers: Headers): string | null {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
        const first = forwarded.split(",")[0]?.trim();
        if (first) return first;
    }
    const realIp = headers.get("x-real-ip")?.trim();
    return realIp || null;
}

let limiter: Ratelimit | null | undefined;
let hasWarnedDisabled = false;

function getLimiter(config: RateLimitConfig): Ratelimit | null {
    if (!config.enabled) {
        if (!hasWarnedDisabled) {
            hasWarnedDisabled = true;
            console.warn(
                "[RateLimit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set — /api/chat is running UNLIMITED.",
            );
        }
        return null;
    }
    if (limiter === undefined) {
        limiter = new Ratelimit({
            redis: new Redis({
                url: process.env.UPSTASH_REDIS_REST_URL!,
                token: process.env.UPSTASH_REDIS_REST_TOKEN!,
            }),
            limiter: Ratelimit.slidingWindow(config.maxRequests, config.window),
            analytics: true,
            prefix: "flag-forge:chat",
        });
    }
    return limiter;
}

/**
 * Returns `limited: true` when the caller has exhausted its window. Never
 * throws: an Upstash outage is logged and the request is allowed through.
 */
export async function checkChatRateLimit(headers: Headers): Promise<RateLimitDecision> {
    const active = getLimiter(readRateLimitConfig());
    if (!active) return ALLOWED;

    const identifier = extractClientIp(headers) ?? "anonymous";
    try {
        const result = await active.limit(identifier);
        return {
            limited: !result.success,
            limit: result.limit,
            remaining: result.remaining,
            resetMs: result.reset,
        };
    } catch (error) {
        console.error("[RateLimit] Upstash check failed, allowing request:", error);
        return ALLOWED;
    }
}

/** Seconds a rejected caller should wait, clamped to at least 1. */
export function retryAfterSeconds(decision: RateLimitDecision, now: number = Date.now()): number {
    return Math.max(1, Math.ceil((decision.resetMs - now) / 1000));
}
