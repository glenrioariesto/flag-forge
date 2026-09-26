import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    getLocalFallbackReply,
    buildFallbackCompletion,
} from "../src/lib/aiFallback";

describe("getLocalFallbackReply", () => {
    it("mentions the country in uppercase", () => {
        for (let i = 0; i < 20; i++) {
            const reply = getLocalFallbackReply("jp", "laser", "hello");
            assert.match(reply, /JP/);
        }
    });

    it("defaults to ID when country is empty", () => {
        const reply = getLocalFallbackReply("", "cannon", "hi");
        assert.match(reply, /ID/);
    });

    it("keeps replies short (<= 50 words)", () => {
        for (let i = 0; i < 30; i++) {
            const words = getLocalFallbackReply("BR", "rocket", "go go go")
                .split(/\s+/).length;
            assert.ok(words <= 50, `too long: ${words} words`);
        }
    });

    it("truncates very long user messages instead of echoing fully", () => {
        const long = "x".repeat(200);
        for (let i = 0; i < 20; i++) {
            assert.ok(!getLocalFallbackReply("ID", "cannon", long).includes(long));
        }
    });
});

describe("buildFallbackCompletion", () => {
    it("matches OpenAI choice shape with isFallback flag", () => {
        const res = buildFallbackCompletion("KR", "cannon", "fight!");
        assert.equal(res.isFallback, true);
        assert.equal(res.choices.length, 1);
        assert.equal(res.choices[0].message.role, "assistant");
        assert.match(res.choices[0].message.content, /KR/);
    });
});
