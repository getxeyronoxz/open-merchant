import type { UpdateStatus } from "@open-merchant/shared";

/**
 * How loudly the update strip should speak, and what it should say.
 *
 * Pure so the decision can be tested without a renderer. The rule that matters
 * is the escalation: a check that failed is not the same fact as a check that
 * succeeded and found nothing, and rendering both quietly is how a seller ends
 * up months behind without ever being told.
 */

export type UpdateTone = "quiet" | "active" | "urgent";

export interface UpdateBannerMode {
  readonly message: string;
  readonly tone: UpdateTone;
  /** True when a restart would actually install something. */
  readonly offersRestart: boolean;
  /** True for anything the seller should deal with rather than read past. */
  readonly urgent: boolean;
}

/**
 * True when the build has an updater and therefore has something to say.
 *
 * A type guard rather than a plain boolean so callers narrow to a non-null
 * status, which a predicate on a function returning `boolean` does not give.
 */
export function hasUpdateStory(status: UpdateStatus | null): status is UpdateStatus {
  return status !== null && status.state !== "unavailable";
}

export function updateBannerMode(status: UpdateStatus, currentVersion: string): UpdateBannerMode {
  const newer = status.version === undefined ? "a newer version" : `version ${status.version}`;

  switch (status.state) {
    case "downloaded":
      return {
        message: `Open Merchant ${status.version ?? "a newer version"} is ready. Restart now, or keep working — it installs when you quit.`,
        tone: "urgent",
        offersRestart: true,
        urgent: true,
      };
    case "available":
      return {
        message: `Open Merchant ${newer} is downloading. It installs when you quit.`,
        tone: "urgent",
        offersRestart: false,
        urgent: true,
      };
    case "error":
      return {
        message: `Could not check for updates: ${status.detail ?? "the update feed did not respond"}. You are on ${currentVersion}.`,
        tone: "urgent",
        offersRestart: false,
        // Not the same as being up to date, and never rendered as though it were.
        urgent: true,
      };
    case "checking":
      return {
        message: `Checking for updates… you are on ${currentVersion}.`,
        tone: "quiet",
        offersRestart: false,
        urgent: false,
      };
    case "not-available":
    default:
      return {
        message: `You are on ${currentVersion}, the newest release.`,
        tone: "quiet",
        offersRestart: false,
        urgent: false,
      };
  }
}
