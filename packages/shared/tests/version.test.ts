import { describe, expect, it } from "vitest";

import { compareVersions, satisfiesMinimum } from "../src/version";

/**
 * Plugin manifests declare `minAppVersion`, and the point of that field is to
 * stop a plugin loading against a build it was never written for. Comparing
 * those two strings naively is how that promise quietly stops being kept:
 * "1.0.0-beta.1" sorts after "1.0.0" as text, so a beta build would claim to
 * satisfy a requirement written for the release. The rules here are semantic
 * versioning's, restricted to the shape the manifest schema accepts
 * (`major.minor.patch` with an optional prerelease).
 */

describe("compareVersions", () => {
  it("orders by major, then minor, then patch", () => {
    expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(compareVersions("1.0.2", "1.0.10")).toBeLessThan(0);
  });

  it("compares patch numerically, not as text", () => {
    // The failure this exists to prevent: as strings "1.0.9" > "1.0.10".
    expect(compareVersions("1.0.9", "1.0.10")).toBeLessThan(0);
  });

  it("treats a prerelease as older than the release it leads to", () => {
    // 1.0.0-beta.1 is genuinely older than 1.0.0, so a beta build must NOT
    // satisfy a plugin that requires 1.0.0.
    expect(compareVersions("1.0.0-beta.1", "1.0.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "1.0.0-beta.1")).toBeGreaterThan(0);
  });

  it("orders prerelease identifiers left to right", () => {
    expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBeLessThan(0);
    expect(compareVersions("1.0.0-alpha.1", "1.0.0-alpha.2")).toBeLessThan(0);
    expect(compareVersions("1.0.0-alpha.9", "1.0.0-alpha.10")).toBeLessThan(0);
  });

  it("treats a longer prerelease as higher when the prefix matches", () => {
    expect(compareVersions("1.0.0-alpha", "1.0.0-alpha.1")).toBeLessThan(0);
  });

  it("sorts numeric prerelease identifiers below alphanumeric ones", () => {
    // Semver: numeric identifiers always have lower precedence.
    expect(compareVersions("1.0.0-1", "1.0.0-alpha")).toBeLessThan(0);
  });

  it("reports equal versions as equal", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.0-beta.1", "1.0.0-beta.1")).toBe(0);
  });

  it("is antisymmetric for every pair it is given", () => {
    const versions = [
      "0.0.1",
      "0.1.0",
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-beta.1",
      "1.0.0",
      "1.0.9",
      "1.0.10",
      "1.2.0",
      "2.0.0",
    ];
    for (const a of versions) {
      for (const b of versions) {
        const forward = Math.sign(compareVersions(a, b));
        const backward = Math.sign(compareVersions(b, a));
        // Summed rather than negated: (-0) + (+0) is +0, so this compares the
        // signs without tripping over the floating-point zero.
        expect(forward + backward).toBe(0);
        if (forward === 0) expect(a).toBe(b);
      }
    }
  });
});

describe("satisfiesMinimum", () => {
  it("accepts a build at or above the declared minimum", () => {
    expect(satisfiesMinimum("1.0.0", "1.0.0")).toBe(true);
    expect(satisfiesMinimum("1.0.1", "1.0.0")).toBe(true);
    expect(satisfiesMinimum("1.1.0", "1.0.9")).toBe(true);
  });

  it("refuses a build below the declared minimum", () => {
    expect(satisfiesMinimum("0.9.9", "1.0.0")).toBe(false);
    expect(satisfiesMinimum("1.0.0", "1.0.1")).toBe(false);
  });

  it("refuses a beta build against a plugin that requires the release", () => {
    // The whole reason this is not a string comparison.
    expect(satisfiesMinimum("1.0.0-beta.1", "1.0.0")).toBe(false);
  });

  it("accepts a beta build against a plugin that requires that beta", () => {
    expect(satisfiesMinimum("1.0.0-beta.1", "1.0.0-beta.1")).toBe(true);
    expect(satisfiesMinimum("1.0.0-beta.2", "1.0.0-beta.1")).toBe(true);
  });

  it("refuses rather than guesses when either version is unparseable", () => {
    // A manifest this app cannot read is not a manifest to be lenient about.
    expect(satisfiesMinimum("1.0.0", "not-a-version")).toBe(false);
    expect(satisfiesMinimum("not-a-version", "1.0.0")).toBe(false);
  });
});
