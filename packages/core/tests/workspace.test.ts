import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  MANIFEST_RELATIVE_PATH,
  WorkspaceError,
  createProjectFolder,
  projectFolderName,
} from "../src/workspace";

const tempDirs: string[] = [];

async function tempParent(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "open-merchant-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("projectFolderName", () => {
  it("slugifies titles the way the legacy engine did", () => {
    expect(projectFolderName("Mechanical Keyboards: India!")).toBe("mechanical-keyboards-india");
    expect(projectFolderName("   spaced   out   ")).toBe("spaced-out");
  });

  it("never returns an empty slug", () => {
    expect(projectFolderName("😀")).toBe("project");
  });
});

describe("createProjectFolder", () => {
  it("writes a valid v2 manifest into a fresh folder", async () => {
    const parent = await tempParent();
    const created = await createProjectFolder({
      parentDirectory: parent,
      name: "Keyboards India",
      objective: "Decide market entry",
      currency: "INR",
    });
    expect(created.manifest.name).toBe("Keyboards India");
    expect(created.root).toBe(join(parent, "keyboards-india"));

    const raw = await readFile(join(created.root, MANIFEST_RELATIVE_PATH), "utf8");
    expect(JSON.parse(raw)).toEqual(created.manifest);
  });

  it("refuses to overwrite an existing project folder", async () => {
    const parent = await tempParent();
    await createProjectFolder({
      parentDirectory: parent,
      name: "Keyboards",
      objective: "one",
      currency: "INR",
    });
    await expect(
      createProjectFolder({ parentDirectory: parent, name: "Keyboards", objective: "two", currency: "INR" }),
    ).rejects.toBeInstanceOf(WorkspaceError);
  });
});
