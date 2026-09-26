import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCountryCode } from "../src/lib/country";

describe("extractCountryCode", () => {
    it("parses plain 2-letter codes (case-insensitive)", () => {
        assert.equal(extractCountryCode("ID"), "ID");
        assert.equal(extractCountryCode("id"), "ID");
        assert.equal(extractCountryCode("  us "), "US");
    });

    it("resolves aliases before the generic rule", () => {
        assert.equal(extractCountryCode("INDONESIA"), "ID");
        assert.equal(extractCountryCode("INDO"), "ID");
        assert.equal(extractCountryCode("USA"), "US");
        assert.equal(extractCountryCode("JAPAN"), "JP");
        assert.equal(extractCountryCode("KOREA"), "KR");
        assert.equal(extractCountryCode("BRAZIL"), "BR");
    });

    it("rejects empty / non-letter / overlong / unknown-code input", () => {
        assert.equal(extractCountryCode(""), null);
        assert.equal(extractCountryCode("!!!"), null);
        assert.equal(extractCountryCode("A"), null);
        assert.equal(extractCountryCode("HELLO"), null);
        assert.equal(extractCountryCode("ZZ"), null);
    });
});
