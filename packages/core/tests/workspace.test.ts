import { describe, expect, it } from "vitest";

import { nextSequentialId } from "../src/ids";
import { projectFolderName } from "../src/workspace";

describe("projectFolderName", () => {
  it("slugifies titles the way the legacy engine did", () => {
    expect(projectFolderName("Mechanical Keyboards: India!")).toBe("mechanical-keyboards-india");
    expect(projectFolderName("   spaced   out   ")).toBe("spaced-out");
    expect(projectFolderName("Über cool")).toBe("ber-cool");
  });

  it("never returns an empty slug", () => {
    expect(projectFolderName("😀")).toBe("project");
  });

  it("collapses separators and trims edge dashes", () => {
    expect(projectFolderName("  --Keyboards__INDIA--  ")).toBe("keyboards-india");
    expect(projectFolderName("a   b")).toBe("a-b");
    expect(projectFolderName("Deep   Flow")).toBe("deep-flow");
  });

  it("keeps digits and lowercases ascii letters", () => {
    expect(projectFolderName("65% Gang 2026")).toBe("65-gang-2026");
  });
});

describe("nextSequentialId", () => {
  it("starts at 001 on an empty workspace", () => {
    expect(nextSequentialId("S", [])).toBe("S-001");
    expect(nextSequentialId("C", [])).toBe("C-001");
  });

  it("increments past the highest existing id, ignoring foreign prefixes", () => {
    expect(nextSequentialId("S", ["S-001", "S-009", "C-100"])).toBe("S-010");
    expect(nextSequentialId("C", ["C-001", "C-002", "S-050"])).toBe("C-003");
  });

  it("ignores malformed ids instead of crashing", () => {
    expect(nextSequentialId("S", ["nope", "S-abc", ""])).toBe("S-001");
  });
});
