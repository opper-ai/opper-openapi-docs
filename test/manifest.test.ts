import { describe, it, expect } from "vitest";
import { sha256 } from "../src/manifest.js";

describe("sha256", () => {
  it("produces consistent hashes", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
  });

  it("produces different hashes for different inputs", () => {
    expect(sha256("hello")).not.toBe(sha256("world"));
  });

  it("produces 64-character hex strings", () => {
    const hash = sha256("test");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
