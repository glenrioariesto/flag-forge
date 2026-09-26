import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { flagUrl } from "../src/lib/flagUrl";

describe("flagUrl", () => {
  it("builds the CDN url for the requested resolution", () => {
    assert.equal(flagUrl("ID", 160, 120), "https://flagcdn.com/160x120/id.png");
    assert.equal(flagUrl("BR", 24, 18), "https://flagcdn.com/24x18/br.png");
  });

  it("normalizes the country code to lowercase", () => {
    assert.equal(flagUrl("us", 24, 18), flagUrl("US", 24, 18));
  });

  it("keeps resolution a caller decision (sprite vs thumbnail differ)", () => {
    assert.notEqual(flagUrl("ID", 160, 120), flagUrl("ID", 24, 18));
  });
});
