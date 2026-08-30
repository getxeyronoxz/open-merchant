import { describe, expect, it } from "vitest";

import { diffLines } from "../src/renderer/src/lib/diff";

describe("diffLines", () => {
  it("returns identical lines for equal texts", () => {
    const { before, after } = diffLines("a\nb\nc", "a\nb\nc");
    expect(before.every((line) => line.kind === "same")).toBe(true);
    expect(before).toEqual(after);
  });

  it("marks an inserted line as added on the after side", () => {
    const { before, after } = diffLines("a\nc", "a\nb\nc");
    expect(after.find((line) => line.text === "b")?.kind).toBe("add");
    expect(before.filter((line) => line.kind === "del")).toEqual([]);
  });

  it("marks a removed line as deleted on the before side", () => {
    const { before, after } = diffLines("a\nb\nc", "a\nc");
    expect(before.find((line) => line.text === "b")?.kind).toBe("del");
    expect(after.filter((line) => line.kind === "add")).toEqual([]);
  });

  it("keeps both columns the same height via skip rows", () => {
    const { before, after } = diffLines("one\n", "one\ntwo\nthree");
    expect(before.length).toBe(after.length);
    expect(before.length).toBeGreaterThanOrEqual(3);
  });

  it("normalizes CRLF so Windows-written reports diff cleanly", () => {
    const { before, after } = diffLines("a\r\nb\r\n", "a\r\nb\r\nc");
    expect(after.map((line) => line.text)).toContain("c");
    expect(before.map((line) => line.text)).not.toContain("c");
  });

  it("handles an empty after side (everything removed)", () => {
    const { before, after } = diffLines("x\ny", "");
    expect(before.filter((line) => line.kind === "del")).toHaveLength(2);
    expect(after.filter((line) => line.kind === "del")).toEqual([]);
    expect(before.length).toBe(after.length);
  });
});