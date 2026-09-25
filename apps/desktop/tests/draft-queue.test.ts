import { describe, expect, it } from "vitest";

import { nextDraftIndex } from "../src/renderer/src/features/workspace/draftQueue";

describe("Draft Desk queue keyboard navigation", () => {
  it("returns -1 when the queue is empty so no draft is selected", () => {
    expect(nextDraftIndex(-1, 0, 1)).toBe(-1);
    expect(nextDraftIndex(0, 0, -1)).toBe(-1);
  });

  it("lands on the first draft when nothing is selected yet", () => {
    // From the left edge a rightward step must still land on the head, and a
    // leftward step must wrap to the tail rather than go out of bounds.
    expect(nextDraftIndex(-1, 3, 1)).toBe(0);
    expect(nextDraftIndex(-1, 3, -1)).toBe(2);
  });

  it("moves forward and backward through the queue", () => {
    expect(nextDraftIndex(0, 3, 1)).toBe(1);
    expect(nextDraftIndex(1, 3, 1)).toBe(2);
    expect(nextDraftIndex(2, 3, -1)).toBe(1);
  });

  it("wraps in both directions instead of falling off the end", () => {
    expect(nextDraftIndex(2, 3, 1)).toBe(0);
    expect(nextDraftIndex(0, 3, -1)).toBe(2);
  });

  it("stays put on a single queued draft from either direction", () => {
    expect(nextDraftIndex(0, 1, 1)).toBe(0);
    expect(nextDraftIndex(0, 1, -1)).toBe(0);
  });

  it("never returns an out-of-range index for any reachable position", () => {
    for (let length = 1; length <= 6; length += 1) {
      for (let current = -1; current < length; current += 1) {
        for (const step of [1, -1] as const) {
          const index = nextDraftIndex(current, length, step);
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(length);
        }
      }
    }
  });
});
