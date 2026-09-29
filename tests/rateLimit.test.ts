import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    readRateLimitConfig,
    extractClientIp,
    retryAfterSeconds,
    type RateLimitDecision,
} from "../src/lib/rateLimit";

// `readRateLimitConfig` only reads a handful of keys, so build env fixtures
// from a plain record instead of casting to ProcessEnv (which requires NODE_ENV).
const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv;

const CONFIGURED = env({
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "token",
});

describe("readRateLimitConfig", () => {
    it("is disabled when Upstash credentials are absent", () => {
        const config = readRateLimitConfig(env({}));
        assert.equal(config.enabled, false);
    });

    it("requires both url and token", () => {
        assert.equal(readRateLimitConfig(env({ UPSTASH_REDIS_REST_URL: "https://x" })).enabled, false);
        assert.equal(readRateLimitConfig(env({ UPSTASH_REDIS_REST_TOKEN: "t" })).enabled, false);
    });

    it("is enabled when both credentials are present", () => {
        assert.equal(readRateLimitConfig(CONFIGURED).enabled, true);
    });

    it("defaults to 10 requests per 1 m", () => {
        const config = readRateLimitConfig(CONFIGURED);
        assert.equal(config.maxRequests, 10);
        assert.equal(config.window, "1 m");
    });

    it("honours overrides", () => {
        const config = readRateLimitConfig({ ...CONFIGURED, CHAT_RATE_LIMIT_MAX: "3", CHAT_RATE_LIMIT_WINDOW: "10 s" });
        assert.equal(config.maxRequests, 3);
        assert.equal(config.window, "10 s");
    });

    it("falls back to the default window when the override is malformed", () => {
        for (const raw of ["", "abc", "10", "10 minutes", "5 fortnights", "10 mo"]) {
            const config = readRateLimitConfig(env({ ...CONFIGURED, CHAT_RATE_LIMIT_WINDOW: raw }));
            assert.equal(config.window, "1 m", `expected default for ${JSON.stringify(raw)}`);
        }
    });

    it("accepts windows with or without a unit space", () => {
        assert.equal(readRateLimitConfig(env({ ...CONFIGURED, CHAT_RATE_LIMIT_WINDOW: "10 s" })).window, "10 s");
        assert.equal(readRateLimitConfig(env({ ...CONFIGURED, CHAT_RATE_LIMIT_WINDOW: "10s" })).window, "10s");
    });

    it("falls back to defaults on invalid or non-positive max", () => {
        for (const raw of ["", "abc", "0", "-5", "NaN"]) {
            const config = readRateLimitConfig({ ...CONFIGURED, CHAT_RATE_LIMIT_MAX: raw });
            assert.equal(config.maxRequests, 10, `expected default for ${JSON.stringify(raw)}`);
        }
    });
});

describe("extractClientIp", () => {
    const headers = (init: Record<string, string>) => new Headers(init);

    it("returns null when no identifying header is present", () => {
        assert.equal(extractClientIp(headers({})), null);
    });

    it("uses the left-most x-forwarded-for entry", () => {
        assert.equal(extractClientIp(headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" })), "203.0.113.7");
    });

    it("trims whitespace around forwarded entries", () => {
        assert.equal(extractClientIp(headers({ "x-forwarded-for": "  203.0.113.7 , 70.41.3.18 " })), "203.0.113.7");
    });

    it("falls back to x-real-ip when x-forwarded-for is empty", () => {
        assert.equal(extractClientIp(headers({ "x-forwarded-for": "", "x-real-ip": "198.51.100.4" })), "198.51.100.4");
    });

    it("falls back to x-real-ip when x-forwarded-for has no usable entry", () => {
        assert.equal(extractClientIp(headers({ "x-forwarded-for": " , ", "x-real-ip": "198.51.100.4" })), "198.51.100.4");
    });

    it("prefers x-forwarded-for over x-real-ip", () => {
        const result = extractClientIp(headers({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.4" }));
        assert.equal(result, "203.0.113.7");
    });

    it("treats a blank x-real-ip as absent", () => {
        assert.equal(extractClientIp(headers({ "x-real-ip": "   " })), null);
    });
});

describe("retryAfterSeconds", () => {
    const decision = (resetMs: number): RateLimitDecision => ({
        limited: true,
        limit: 10,
        remaining: 0,
        resetMs,
    });

    it("returns whole seconds until the window resets", () => {
        assert.equal(retryAfterSeconds(decision(10_500), 10_000), 1);
        assert.equal(retryAfterSeconds(decision(12_000), 10_000), 2);
    });

    it("never returns less than 1 for an already-elapsed window", () => {
        assert.equal(retryAfterSeconds(decision(5_000), 10_000), 1);
    });
});
