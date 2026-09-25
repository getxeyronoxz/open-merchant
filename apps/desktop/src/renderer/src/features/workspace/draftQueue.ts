/**
 * Pure helper for walking the Draft Desk review queue from the keyboard.
 *
 * Deliberately free of DOM types so it typechecks under both the web and node
 * tsconfigs, and so the wrap-around behaviour is unit-testable without
 * mounting React — matching how the rest of the workspace logic is verified.
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
