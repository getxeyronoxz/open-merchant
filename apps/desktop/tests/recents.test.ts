import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
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

  it("caps the list at the most recent 20 projects", async () => {
    const dir = await mkdtemp(join(tmpdir(), "om-recents-cap-"));
    tempDirs.push(dir);
    const store = new RecentsStore(dir);
    for (let index = 0; index < 25; index += 1) {
      await store.upsert(`Project ${index}`, `C:/r/p-${index}`);
    }
    const listed = await store.list();
    expect(listed).toHaveLength(20);
    // The oldest entries were dropped; the newest survive.
    expect(listed[0]?.name).toBe("Project 24");
    expect(listed[19]?.name).toBe("Project 5");
  });

  it("quarantines a malformed recents file instead of silently destroying it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "om-recents-corrupt-"));
    tempDirs.push(dir);
    await writeFile(join(dir, "recent-projects.json"), "{ not json", "utf8");
    const store = new RecentsStore(dir);
    expect(await store.list()).toEqual([]);
    // The malformed file survives beside the fresh list, never overwritten.
    const quarantined = (await readdir(dir)).filter((name) =>
      name.startsWith("recent-projects.json.corrupt-"),
    );
    expect(quarantined).toHaveLength(1);
    // A subsequent upsert produces a valid list and leaves the backup alone.
    await store.upsert("Alpha", "C:/r/alpha");
    expect((await store.list()).map((project) => project.name)).toEqual(["Alpha"]);
    expect(
      (await readdir(dir)).filter((name) => name.startsWith("recent-projects.json.corrupt-")),
    ).toHaveLength(1);
  });
});
