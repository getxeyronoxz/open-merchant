import { describe, expect, it } from "vitest";

import type { UpdateStatus } from "@open-merchant/shared";

import { hasUpdateStory, updateBannerMode } from "./updateBannerMode";

/**
 * What the update strip says, and how loudly.
 *
 * The whole reason this exists: "you are on the newest release" and "we could
 * not reach the feed" used to be the same silence. Now they are different
 * sentences, and a failed check is escalated rather than rendered quietly —
 * a problem you have to go looking for is a problem you will not find.
 */

const CURRENT = "1.0.0-beta.1";

const status = (over: Partial<UpdateStatus> = {}): UpdateStatus => ({
  state: "not-available",
  ...over,
});

describe("updateBannerMode", () => {
  it("is quiet when everything is fine", () => {
    const mode = updateBannerMode(status(), CURRENT);

    expect(mode.tone).toBe("quiet");
    expect(mode.message).toContain(CURRENT);
    expect(mode.urgent).toBe(false);
  });

  it("escalates a failed check, because that is not being up to date", () => {
    // The distinction the old UI could not make. A quiet render here is the bug.
    const mode = updateBannerMode(status({ state: "error", detail: "network unreachable" }), CURRENT);

    expect(mode.tone).not.toBe("quiet");
    expect(mode.urgent).toBe(true);
    expect(mode.message).toContain("network unreachable");
  });

  it("is loudest when an install is actually waiting", () => {
    const downloaded = updateBannerMode(status({ state: "downloaded", version: "1.0.0" }), CURRENT);
    const available = updateBannerMode(status({ state: "available", version: "1.0.0" }), CURRENT);

    expect(downloaded.urgent).toBe(true);
    expect(downloaded.offersRestart).toBe(true);
    expect(available.urgent).toBe(true);
    // Downloading is not yet actionable, so it must not offer a restart that
    // would do nothing.
    expect(available.offersRestart).toBe(false);
  });

  it("never shows an empty message", () => {
    for (const state of ["checking", "available", "not-available", "downloaded", "error"] as const) {
      expect(updateBannerMode(status({ state }), CURRENT).message.length).toBeGreaterThan(0);
    }
  });

  it("does not print undefined when the feed omits a version", () => {
    const mode = updateBannerMode(status({ state: "downloaded" }), CURRENT);

    expect(mode.message).not.toContain("undefined");
  });

  it("names what you have on during a check, so the strip is never empty-handed", () => {
    const mode = updateBannerMode(status({ state: "checking" }), CURRENT);

    expect(mode.message.length).toBeGreaterThan(0);
    expect(mode.urgent).toBe(false);
  });
});

describe("hasUpdateStory", () => {
  it("says nothing at all in a build with no updater", () => {
    // A development checkout reports Electron's version as the app's, so the
    // alternative was a strip announcing "you are on 39.8.10, the newest
    // release" about software that is not Open Merchant.
    expect(hasUpdateStory({ state: "unavailable" })).toBe(false);
    expect(hasUpdateStory(null)).toBe(false);
  });

  it("speaks for every real state", () => {
    for (const state of ["checking", "available", "not-available", "downloaded", "error"] as const) {
      expect(hasUpdateStory({ state })).toBe(true);
    }
  });
});
