import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { RecentsStore } from "../src/main/recents";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("RecentsStore", () => {
  it("upserts, reorders by recency, removes, and persists to disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "om-recents-"));
    tempDirs.push(dir);
    const store = new RecentsStore(dir);

    await store.upsert("Alpha", "C:/r/alpha");
    await store.upsert("Beta", "C:/r/beta");
    await store.upsert("Gamma", "C:/r/gamma");
    // Reopening Alpha makes it most recent.
    await store.upsert("Alpha", "C:/r/alpha");

    const listed = await store.list();
    expect(listed[0]?.name).toBe("Alpha");
    expect(listed).toHaveLength(3);

    await store.remove("C:/r/beta");
    expect((await store.list()).map((project) => project.name)).toEqual(["Alpha", "Gamma"]);

    // A brand-new store reads the same persisted file.
    expect((await new RecentsStore(dir).list()).map((project) => project.name)).toEqual([
      "Alpha",
      "Gamma",
    ]);
  });

  it("returns an empty list when nothing was stored yet", async () => {
    const dir = await mkdtemp(join(tmpdir(), "om-recents-empty-"));
    tempDirs.push(dir);
    expect(await new RecentsStore(dir).list()).toEqual([]);
  });
});
