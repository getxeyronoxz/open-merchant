import { describe, expect, it } from "vitest";

import { describeUpdate } from "../src/main/update-notice";

/**
 * What the app says about its own updates.
 *
 * These sentences matter more than they look. The contract has always carried
 * five states but only two were ever emitted, so "you are up to date", "the
 * check failed", and "there is no release yet" were all the same silence. A
 * seller whose update check had been failing for a week had no way to notice,
 * and no way to tell that apart from already having the newest build.
 */

const CURRENT = "1.0.0-beta.1";

describe("describeUpdate", () => {
  it("names the version when there is nothing newer", () => {
    // "Not updated" should be a claim the app can back up, not an absence of one.
    const notice = describeUpdate({ state: "not-available" }, CURRENT);

    expect(notice.message).toContain(CURRENT);
    expect(notice.message).toMatch(/newest/iu);
    expect(notice.isProblem).toBe(false);
  });

  it("says a failed check is a problem, and says why", () => {
    const notice = describeUpdate(
      { state: "error", detail: "getaddrinfo ENOTFOUND github.com" },
      CURRENT,
    );

    expect(notice.isProblem).toBe(true);
    expect(notice.message).toContain("getaddrinfo ENOTFOUND github.com");
    // Still names what you are on: the person needs both facts.
    expect(notice.message).toContain(CURRENT);
  });

  it("never reports a failed check as good news", () => {
    // The bug this guards: a check that silently failed reads exactly like an
    // up-to-date app, so a seller cannot tell they are missing fixes.
    const upToDate = describeUpdate({ state: "not-available" }, CURRENT);
    const failed = describeUpdate({ state: "error" }, CURRENT);

    expect(failed.isProblem).not.toBe(upToDate.isProblem);
    expect(failed.message).not.toBe(upToDate.message);
  });

  it("still says something when the failure carries no reason", () => {
    const notice = describeUpdate({ state: "error" }, CURRENT);

    expect(notice.isProblem).toBe(true);
    expect(notice.message.length).toBeGreaterThan(0);
    expect(notice.message).toContain(CURRENT);
  });

  it("offers a restart only when an install is actually waiting", () => {
    expect(describeUpdate({ state: "downloaded", version: "1.0.0" }, CURRENT).offersRestart).toBe(true);
    for (const state of ["checking", "available", "not-available", "error"] as const) {
      expect(describeUpdate({ state }, CURRENT).offersRestart).toBe(false);
    }
  });

  it("names the incoming version when one is known", () => {
    expect(describeUpdate({ state: "downloaded", version: "1.0.0-beta.2" }, CURRENT).message).toContain(
      "1.0.0-beta.2",
    );
  });

  it("copes with a version field the feed did not fill in", () => {
    // electron-updater does not always report one, and a template printing
    // "undefined" is worse than a plain sentence.
    const notice = describeUpdate({ state: "downloaded" }, CURRENT);

    expect(notice.message).not.toContain("undefined");
    expect(notice.offersRestart).toBe(true);
  });

  it("does not offer a restart while merely checking", () => {
    const notice = describeUpdate({ state: "checking" }, CURRENT);

    expect(notice.offersRestart).toBe(false);
    expect(notice.isProblem).toBe(false);
  });
});
