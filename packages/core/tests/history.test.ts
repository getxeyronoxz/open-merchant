import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { HistoryError, HistoryStore } from "../src/history";

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "om-history-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("HistoryStore", () => {
  it("round-trips scenario and report snapshots keyed by run id", async () => {
    const store = new HistoryStore(await tempDir());
    await store.snapshot("scenarios", "RUN-aaa", '[{"scenario":"base"}]\n');
    await store.snapshot("report", "RUN-aaa", "# Report v1\n");

    expect(await store.readSnapshot("scenarios", "RUN-aaa")).toBe('[{"scenario":"base"}]\n');
    expect(await store.readSnapshot("report", "RUN-aaa")).toBe("# Report v1\n");
  });

  it("keeps separate generations isolated from each other", async () => {
    const store = new HistoryStore(await tempDir());
    await store.snapshot("report", "RUN-1", "v1");
    await store.snapshot("report", "RUN-2", "v2\nchanged");

    expect(await store.readSnapshot("report", "RUN-1")).toBe("v1");
    expect(await store.readSnapshot("report", "RUN-2")).toBe("v2\nchanged");
  });

  it("returns null for a generation that was never captured", async () => {
    const store = new HistoryStore(await tempDir());
    expect(await store.readSnapshot("report", "RUN-unknown")).toBeNull();
  });

  it("rejects unsafe run ids so history cannot escape its directory", async () => {
    const store = new HistoryStore(await tempDir());
    for (const bad of ["../evil", "a/b", "a b", "RUN-id;rm", "", ".."]) {
      await expect(store.snapshot("report", bad, "x")).rejects.toBeInstanceOf(HistoryError);
      await expect(store.readSnapshot("report", bad)).rejects.toBeInstanceOf(HistoryError);
    }
  });

  it("writes inside the nested hidden history directory like the other journals", async () => {
    const dir = await tempDir();
    const store = new HistoryStore(join(dir, ".openmerchant", "history"));
    await store.snapshot("scenarios", "RUN-1", "[]\n");

    const raw = await readFile(
      join(dir, ".openmerchant", "history", "scenarios-RUN-1.json"),
      "utf8",
    );
    expect(raw).toBe("[]\n");
  });
});