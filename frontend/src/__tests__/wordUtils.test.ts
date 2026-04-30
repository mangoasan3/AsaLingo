import { describe, it, expect } from "vitest";
import { getWordId } from "../utils/word";

describe("getWordId", () => {
  it("returns id when present", () => {
    expect(getWordId({ id: "abc123" })).toBe("abc123");
  });

  it("falls back to _id when id is absent", () => {
    expect(getWordId({ _id: "mongo456" })).toBe("mongo456");
  });

  it("prefers id over _id when both exist", () => {
    expect(getWordId({ id: "primary", _id: "fallback" })).toBe("primary");
  });

  it("returns empty string for null or undefined", () => {
    expect(getWordId(null)).toBe("");
    expect(getWordId(undefined)).toBe("");
  });

  it("returns empty string when both id and _id are absent", () => {
    expect(getWordId({})).toBe("");
  });
});
