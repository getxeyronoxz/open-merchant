/**
 * Pure logic for the Draft Desk: walking the review queue from the keyboard,
 * deciding what that keyboard is allowed to touch, and naming which of the six
 * assistants is mid-flight.
 *
 * Deliberately free of DOM types so it typechecks under both the web and node
 * tsconfigs, and so the behaviour is unit-testable without mounting React —
 * matching how the rest of the workspace logic is verified.
 */

/**
 * Next index after moving `step` places from `current`, wrapping in both
 * directions. Returns -1 when there is nothing to move through.
 *
 * `current` is -1 when no draft is selected yet: stepping forward lands on the
 * head of the queue, and stepping backward wraps to the tail.
 */
export function nextDraftIndex(current: number, length: number, step: 1 | -1): number {
  if (length <= 0) return -1;
  if (current < 0) return step === 1 ? 0 : length - 1;
  return (current + step + length) % length;
}

/**
 * The narrowest description of what a keypress landed on that the scoping rule
 * needs. Deliberately not a DOM type, for the reason `nextDraftIndex` is not.
 */
export interface FocusTarget {
  readonly tagName: string;
  readonly isContentEditable: boolean;
  /** True when the press landed on a tab inside the review queue's tablist. */
  readonly insideTabList: boolean;
  readonly role?: string | undefined;
}

/** What the queue shortcut is allowed to do with one keypress. */
export interface ArrowBehaviour {
  /** Whether this press moves the active draft. */
  readonly steps: boolean;
  /** Whether we may call `preventDefault` — i.e. whether the key is ours. */
  readonly preventDefault: boolean;
}

const TEXT_ENTRY_TAGS: ReadonlySet<string> = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const CONTROL_TAGS: ReadonlySet<string> = new Set(["BUTTON", "A", "SUMMARY"]);

/**
 * What ArrowLeft/ArrowRight should do, given where the press landed.
 *
 * This handler is on `window`, because the queue is meant to be triageable
 * without a click first. The cost of that is that it sees every keypress in
 * the app, and two of the things it used to do were outright dangerous:
 *
 * - `preventDefault()` on every press meant the shell could not be scrolled
 *   with the keyboard at all while the Draft Desk was open.
 * - Pressing left or right while focused on Accept or Discard silently changed
 *   which draft was under review. The next Enter then accepted a draft the
 *   seller had not read.
 *
 * So the shortcut now steps the queue from the page and from the tabs, and
 * stays out of the way everywhere else. Inside the tablist it owns the key,
 * because there the arrow keys genuinely are the tablist's gesture.
 */
export function arrowKeyBehaviour(target: FocusTarget | null): ArrowBehaviour {
  if (target === null) return { steps: true, preventDefault: false };

  if (target.isContentEditable || TEXT_ENTRY_TAGS.has(target.tagName)) {
    return { steps: false, preventDefault: false };
  }

  if (target.insideTabList) return { steps: true, preventDefault: true };

  if (CONTROL_TAGS.has(target.tagName) || target.role === "button" || target.role === "link") {
    return { steps: false, preventDefault: false };
  }

  return { steps: true, preventDefault: false };
}

/** The six assistants the Draft Desk offers. */
export type DraftKind =
  | "plan"
  | "evidence"
  | "competitors"
  | "economics"
  | "sections"
  | "audit";

/** Fixed order, so a state that somehow has two assistants in flight still
 * reports one deterministically rather than whichever the object listed first. */
const DRAFT_KINDS: readonly DraftKind[] = [
  "plan",
  "evidence",
  "competitors",
  "economics",
  "sections",
  "audit",
];

/**
 * Which assistant is running, or null when the lane is idle.
 *
 * The six buttons used to share one `pending` flag, so when any one of them
 * ran, all six read "Working…". The lane then claimed six things were in
 * flight when one was — and the button for the assistant you were actually
 * waiting on looked the same as the five that had not started.
 */
export function runningDraftKind(
  pending: Readonly<Record<DraftKind, boolean>>,
): DraftKind | null {
  return DRAFT_KINDS.find((kind) => pending[kind]) ?? null;
}
