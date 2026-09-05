import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Competitor } from "@open-merchant/shared";

import { MARKET_SNAPSHOTS_DIR, resolveSnapshotFile } from "../src/layout";
import { newSnapshotId } from "../src/snapshots";
import { WorkspaceError, WorkspaceStore } from "../src/store";

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "open-merchant-snapshots-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function competitor(id: string, price: string | null, product = "65% hot-swap keyboard"): Competitor {
  return {
    id,
    product,
    brand: "Brand",
    price,
    currency: "INR",
    marketplace: "Example Bazaar",
    url: "https://example.com",
    sourceId: null,
    notes: "",
    observedAt: "2026-09-05T09:00:00.000Z",
  };
}

async function projectWithCompetitors(competitors: Competitor[]): Promise<WorkspaceStore> {
  const parent = await tempDir();
  const store = await WorkspaceStore.create({
    parentDirectory: parent,
    name: "Snapshot Project",
    objective: "Decide market entry",
    currency: "INR",
  });
  await store.saveCompetitors(competitors);
  return store;
}

describe("market snapshots", () => {
  it("captures an immutable snapshot with exact statistics and files on disk", async () => {
    const store = await projectWithCompetitors([competitor("C-001", "499.00"), competitor("C-002", "599.50")]);
    const { snapshot, fingerprint } = await store.captureMarketSnapshot("first scan");

    expect(snapshot.id).toMatch(/^SNAP-\d{8}T\d{6}Z-[0-9a-f]{4}$/u);
    expect(snapshot.listingCount).toBe(2);
    expect(snapshot.statistics.minimum).toBe("499.00");
    expect(snapshot.statistics.average).toBe("549.25");
    expect(snapshot.statistics.median).toBe("549.25");
    expect(fingerprint.path).toBe(`${MARKET_SNAPSHOTS_DIR}/${snapshot.id}.json`);

    const file = await stat(join(store.root, MARKET_SNAPSHOTS_DIR, `${snapshot.id}.json`));
    expect(file.isFile()).toBe(true);
  });

  it("lists snapshots newest first and diffs them", async () => {
    const store = await projectWithCompetitors([competitor("C-001", "499.00")]);
    const first = await store.captureMarketSnapshot("first", undefined, "2026-09-01T10:00:00.000Z");
    await store.saveCompetitors([competitor("C-001", "549.00"), competitor("C-003", "699.00", "75% gasket keyboard")]);
    const second = await store.captureMarketSnapshot("second", undefined, "2026-09-05T10:00:00.000Z");

    const snapshots = await store.listMarketSnapshots();
    expect(snapshots.map((snapshot) => snapshot.id)).toEqual([second.snapshot.id, first.snapshot.id]);

    const diff = await store.snapshotDiff(first.snapshot.id, second.snapshot.id);
    expect(diff.added.map((listing) => listing.id)).toEqual(["C-003"]);
    expect(diff.removed).toEqual([]);
    expect(diff.priceChanges).toEqual([
      {
        key: "brand | 65% hot-swap keyboard | example bazaar",
        product: "65% hot-swap keyboard",
        brand: "Brand",
        marketplace: "Example Bazaar",
        fromPrice: "499.00",
        toPrice: "549.00",
      },
    ]);
  });

  it("builds per-listing price history oldest first", async () => {
    const store = await projectWithCompetitors([competitor("C-001", "499.00")]);
    await store.captureMarketSnapshot("first", undefined, "2026-09-01T10:00:00.000Z");
    await store.saveCompetitors([competitor("C-001", "549.00")]);
    await store.captureMarketSnapshot("second", undefined, "2026-09-05T10:00:00.000Z");

    const history = await store.listingPriceHistory();
    expect(history).toHaveLength(1);
    const entry = history[0] as (typeof history)[number];
    expect(entry.points.map((point) => point.price)).toEqual(["499.00", "549.00"]);
  });

  it("rejects malformed snapshot files loudly", async () => {
    const store = await projectWithCompetitors([]);
    await store.captureMarketSnapshot("good");
    const dir = join(store.root, MARKET_SNAPSHOTS_DIR);
    const id = newSnapshotId();
    await writeFile(join(dir, `${id}.json`), "{ not valid");

    await expect(store.listMarketSnapshots()).rejects.toThrow(WorkspaceError);
  });

  it("reports unknown snapshot ids on diff", async () => {
    const store = await projectWithCompetitors([]);
    const { snapshot } = await store.captureMarketSnapshot("only");
    await expect(store.snapshotDiff(snapshot.id, "SNAP-20260905T000000Z-beef")).rejects.toThrow(
      WorkspaceError,
    );
  });

  it("guards snapshot file resolution against hostile ids and traversal", async () => {
    const parent = await tempDir();
    await expect(resolveSnapshotFile(parent, "../escape")).rejects.toThrow(/Unsafe snapshot id/u);
    await expect(resolveSnapshotFile(parent, "SNAP-1")).rejects.toThrow(/Unsafe snapshot id/u);
    const resolved = await resolveSnapshotFile(parent, "SNAP-20260905T081234Z-4f2a");
    expect(resolved).toContain("snapshots");
    expect(resolved).toContain("SNAP-20260905T081234Z-4f2a.json");
  });
});