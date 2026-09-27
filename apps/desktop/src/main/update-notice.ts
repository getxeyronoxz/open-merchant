import type { UpdateStatus } from "@open-merchant/shared";

/**
 * What the app tells you about its own updates.
 *
 * The contract has always carried five states — checking, available,
 * not-available, downloaded, error — but only two were ever emitted, so
 * "you are up to date", "we could not reach the feed", and "there is no
 * release yet" all looked identical: silence. That is not a cosmetic
 * problem. A seller whose app is silently failing to check has no way to
 * know they are missing fixes, and no way to tell that apart from having
 * the newest build.
 *
 * So every state gets a sentence a person can act on, and the three
 * "nothing is happening" states are kept deliberately distinct.
 */

export interface UpdateNotice {
  /** One line, already written for a person. */
  readonly message: string;
  /** True only when an install is actually waiting. */
  readonly offersRestart: boolean;
  /** True when the reason is that we could not find out, not that all is well. */
  readonly isProblem: boolean;
}

export function describeUpdate(status: UpdateStatus, currentVersion: string): UpdateNotice {
  switch (status.state) {
    case "downloaded":
      return {
        message: `Open Merchant ${status.version ?? "a newer version"} is ready to install. Restart now, or keep working — it installs when you quit.`,
        offersRestart: true,
        isProblem: false,
      };
    case "available":
      return {
        message: `Open Merchant ${status.version ?? "a newer version"} is downloading. It installs when you quit.`,
        offersRestart: false,
        isProblem: false,
      };
    case "checking":
      return { message: "Checking for updates…", offersRestart: false, isProblem: false };
    case "not-available":
      // Named as the good news it is, and with the version, so "not updated"
      // is a claim the app can back up rather than an absence of one.
      return {
        message: `You are on ${currentVersion}, the newest release.`,
        offersRestart: false,
        isProblem: false,
      };
    case "error":
    default:
      return {
        message: `Could not check for updates: ${status.detail ?? "the update feed did not respond"}. You are on ${currentVersion}.`,
        offersRestart: false,
        // The distinction that matters: this is not "you are up to date".
        isProblem: true,
      };
  }
}
