/**
 * Semantic version comparison, restricted to the shape the plugin manifest
 * schema accepts: `major.minor.patch` with an optional prerelease, no build
 * metadata.
 *
 * This exists because `minAppVersion` is a promise the plugin surface makes —
 * "this plugin was written for a build at least this new" — and comparing the
 * two values as text quietly stops keeping it. `"1.0.0-beta.1"` sorts *after*
 * `"1.0.0"` alphabetically, so a string compare would let a beta build load a
 * plugin that declares it needs the release, which is exactly the case the
 * field exists to refuse.
 *
 * No dependency: the accepted grammar is small and fixed, the rules are short,
 * and a wrong answer here decides whether third-party code runs.
 */

/** The one shape this module will read. Mirrors the manifest schema's regex. */
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/u;

interface ParsedVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  /** Dot-separated prerelease identifiers, empty for a final release. */
  readonly prerelease: readonly string[];
}

function parse(value: string): ParsedVersion | null {
  const match = VERSION_PATTERN.exec(value);
  if (match === null) return null;
  const [, major, minor, patch, prerelease] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease === undefined || prerelease === "" ? [] : prerelease.split("."),
  };
}

const isNumeric = (identifier: string): boolean => /^\d+$/u.test(identifier);

/**
 * Order two prerelease identifier lists by semantic versioning's rules:
 * numeric identifiers below alphanumeric ones, numeric compared as numbers,
 * and a longer list higher when every shared identifier is equal.
 */
function comparePrerelease(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i];
    const right = b[i];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    if (left === right) continue;

    const leftNumeric = isNumeric(left);
    const rightNumeric = isNumeric(right);
    if (leftNumeric && rightNumeric) {
      const difference = Number(left) - Number(right);
      if (difference !== 0) return difference < 0 ? -1 : 1;
      continue;
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return left < right ? -1 : 1;
  }
  return 0;
}

/**
 * Negative when `a` precedes `b`, positive when it follows, 0 when equal.
 * An unparseable version sorts before every parseable one, so an unreadable
 * value can never pass a minimum.
 */
export function compareVersions(a: string, b: string): number {
  const left = parse(a);
  const right = parse(b);
  if (left === null || right === null) {
    if (left === null && right === null) return 0;
    return left === null ? -1 : 1;
  }

  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }

  // A prerelease precedes the release it leads to: 1.0.0-beta.1 < 1.0.0.
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) return 0;
    return left.prerelease.length === 0 ? 1 : -1;
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

/**
 * Whether a build at `appVersion` is new enough for something that declares it
 * needs `minimum` or newer. False when either side cannot be read.
 */
export function satisfiesMinimum(appVersion: string, minimum: string): boolean {
  const app = parse(appVersion);
  const floor = parse(minimum);
  if (app === null || floor === null) return false;
  return compareVersions(appVersion, minimum) >= 0;
}
