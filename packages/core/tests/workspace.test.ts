import { describe, expect, it } from "vitest";

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
});
