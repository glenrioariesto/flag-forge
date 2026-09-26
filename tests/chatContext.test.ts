import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractContext } from "../src/lib/chatContext";

const SYSTEM =
    "You are the anthropomorphized flag of JP. You are currently in a battle royale game. You have a laser weapon.";

describe("extractContext", () => {
    it("returns defaults for non-array input", () => {
        assert.deepEqual(extractContext(undefined), {
            country: "ID",
            weapon: "cannon",
            userMessage: "",
        });
    });

    it("parses country, weapon and last user message", () => {
        const ctx = extractContext([
            { role: "system", content: SYSTEM },
            { role: "user", content: "hello" },
            { role: "assistant", content: "hi!" },
            { role: "user", content: "attack!" },
        ]);
        assert.deepEqual(ctx, {
            country: "JP",
            weapon: "laser",
            userMessage: "attack!",
        });
    });

    it("falls back per-field when parts are missing", () => {
        const ctx = extractContext([{ role: "user", content: "go" }]);
        assert.equal(ctx.country, "ID");
        assert.equal(ctx.weapon, "cannon");
        assert.equal(ctx.userMessage, "go");
    });
});
