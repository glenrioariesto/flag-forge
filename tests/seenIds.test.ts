import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SeenIdSet } from "../src/lib/seenIds";

describe("SeenIdSet", () => {
    it("accepts an id once and rejects every repeat", () => {
        const seen = new SeenIdSet(10);
        assert.equal(seen.add("a"), true);
        assert.equal(seen.add("a"), false);
        assert.equal(seen.add("b"), true);
        assert.equal(seen.size, 2);
    });

    it("never grows past its cap", () => {
        const seen = new SeenIdSet(10);
        for (let i = 0; i < 500; i += 1) {
            seen.add(`id-${i}`);
            assert.ok(seen.size <= 10, `size ${seen.size} exceeded cap`);
        }
    });

    it("evicts the oldest ids, not the newest", () => {
        const seen = new SeenIdSet(4);
        for (const id of ["a", "b", "c", "d"]) seen.add(id);
        // Overflow past the cap drops the oldest half.
        seen.add("e");
        assert.equal(seen.has("e"), true, "newest id must survive");
        assert.equal(seen.has("a"), false, "oldest id must be evicted");
    });

    it("clears back to empty", () => {
        const seen = new SeenIdSet(4);
        seen.add("a");
        seen.clear();
        assert.equal(seen.size, 0);
        assert.equal(seen.add("a"), true, "cleared ids are forgettable again");
    });

    it("treats a non-positive cap as 1 rather than misbehaving", () => {
        const seen = new SeenIdSet(0);
        assert.equal(seen.add("a"), true);
        assert.equal(seen.add("b"), true);
        assert.ok(seen.size >= 1);
    });
});
