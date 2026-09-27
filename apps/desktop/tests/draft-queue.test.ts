import { describe, expect, it } from "vitest";

import {
  arrowKeyBehaviour,
  nextDraftIndex,
  runningDraftKind,
  type FocusTarget,
} from "../src/renderer/src/features/workspace/draftQueue";

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

/** The queue shortcut runs on window, so the only question is what it is allowed to touch. */
describe("Draft Desk arrow-key scoping", () => {
  const target = (over: Partial<FocusTarget> = {}): FocusTarget => ({
    tagName: "DIV",
    isContentEditable: false,
    insideTabList: false,
    ...over,
  });

  it("never steps the queue while the seller is typing", () => {
    // Typing must win. A field that swallows arrows is a field you can type in.
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(arrowKeyBehaviour(target({ tagName })).steps).toBe(false);
    }
    expect(arrowKeyBehaviour(target({ isContentEditable: true })).steps).toBe(false);
  });

  it("never steps the queue from a button, because arrows there are not a queue gesture", () => {
    // The bug this exists to prevent: focus on Accept, press left or right to
    // scroll, and the draft under review silently changes underneath you. The
    // next Enter then accepts a draft nobody read.
    for (const tagName of ["BUTTON", "A", "SUMMARY"]) {
      expect(arrowKeyBehaviour(target({ tagName })).steps).toBe(false);
    }
    expect(arrowKeyBehaviour(target({ role: "button" })).steps).toBe(false);
  });

  it("never stops the page from scrolling with the arrow keys", () => {
    // preventDefault on a window-level arrow handler is why the shell could
    // not be scrolled with the keyboard at all.
    expect(arrowKeyBehaviour(target({ tagName: "BODY" })).preventDefault).toBe(false);
    expect(arrowKeyBehaviour(target()).preventDefault).toBe(false);
    expect(arrowKeyBehaviour(target({ tagName: "ARTICLE" })).preventDefault).toBe(false);
  });

  it("still steps the queue from the tabs, and owns the key there", () => {
    // Inside the tablist the arrow keys *are* the tablist's own gesture, so
    // preventing the default is correct: it is what stops the page scrolling
    // out from under a focus move.
    const behaviour = arrowKeyBehaviour(target({ tagName: "BUTTON", insideTabList: true }));
    expect(behaviour.steps).toBe(true);
    expect(behaviour.preventDefault).toBe(true);
  });

  it("still steps the queue from the page, so triage needs no click first", () => {
    expect(arrowKeyBehaviour(target({ tagName: "BODY" })).steps).toBe(true);
    expect(arrowKeyBehaviour(null).steps).toBe(true);
  });
});

/** Six assistants, one lane: exactly one of them can be mid-flight. */
describe("runningDraftKind", () => {
  const idle = {
    plan: false,
    evidence: false,
    competitors: false,
    economics: false,
    sections: false,
    audit: false,
  };

  it("is null when nothing is in flight", () => {
    expect(runningDraftKind(idle)).toBeNull();
  });

  it("names the one assistant that is running", () => {
    // Every button used to read "Working…" at once, so the lane said six
    // things were happening when one was.
    for (const kind of ["plan", "evidence", "competitors", "economics", "sections", "audit"] as const) {
      expect(runningDraftKind({ ...idle, [kind]: true })).toBe(kind);
    }
  });

  it("reports one assistant even if state says two", () => {
    // The lane serialises, but a bad state must still not make the UI claim
    // everything is running at once.
    expect(runningDraftKind({ ...idle, sections: true, audit: true })).toBe("sections");
  });
});
