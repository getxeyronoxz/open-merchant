import { randomBytes } from "node:crypto";

import {
  marketSnapshotSchema,
  type Competitor,
  type ListingPriceHistory,
  type MarketSnapshot,
  type SnapshotDiff,
  type SnapshotPriceChange,
} from "@open-merchant/shared";

import { competitorStatistics } from "./statistics";

/**
 * Market snapshots (phase 2): immutable, timestamped captures of the whole
 * competitor listing set. Snapshots are append-only — history and diffs are
 * derived from the sequence, never stored separately. Listing identity across
 * snapshots is the brand/product/marketplace triple, since competitor IDs are
 * reassigned when listings are re-added.
 */

/** Compact UTC stamp: SNAP-20260905T081234Z-4f2a. */
export function newSnapshotId(now = new Date()): string {
  const pad = (value: number, length: number): string => String(value).padStart(length, "0");
  const stamp =
    `${pad(now.getUTCFullYear(), 4)}${pad(now.getUTCMonth() + 1, 2)}${pad(now.getUTCDate(), 2)}` +
    `T${pad(now.getUTCHours(), 2)}${pad(now.getUTCMinutes(), 2)}${pad(now.getUTCSeconds(), 2)}Z`;
  return `SNAP-${stamp}-${randomBytes(2).toString("hex")}`;
}

export function buildMarketSnapshot(
  competitors: Competitor[],
  id: string,
  capturedAt: string,
  note: string,
): MarketSnapshot {
  return marketSnapshotSchema.parse({
    id,
    capturedAt,
    note,
    listingCount: competitors.length,
    statistics: competitorStatistics(competitors),
    listings: competitors,
  });
}

/** Listings are identified across snapshots by brand | product | marketplace. */
export function listingKey(competitor: Pick<Competitor, "brand" | "product" | "marketplace">): string {
  return [competitor.brand, competitor.product, competitor.marketplace]
    .map((value) => value.trim().toLowerCase())
    .join(" | ");
}

export function diffSnapshots(from: MarketSnapshot, to: MarketSnapshot): SnapshotDiff {
  const fromByKey = new Map(from.listings.map((listing) => [listingKey(listing), listing]));
  const toByKey = new Map(to.listings.map((listing) => [listingKey(listing), listing]));

  const added = to.listings.filter((listing) => !fromByKey.has(listingKey(listing)));
  const removed = from.listings.filter((listing) => !toByKey.has(listingKey(listing)));

  const priceChanges: SnapshotPriceChange[] = [];
  for (const [key, next] of toByKey) {
    const previous = fromByKey.get(key);
    if (!previous || previous.price === next.price) continue;
    priceChanges.push({
      key,
      product: next.product,
      brand: next.brand,
      marketplace: next.marketplace,
      fromPrice: previous.price,
      toPrice: next.price,
    });
  }
  priceChanges.sort((a, b) => a.key.localeCompare(b.key));

  return { fromId: from.id, toId: to.id, added, removed, priceChanges };
}

/** Per-listing price points across snapshots, oldest first. */
export function listingPriceHistories(snapshotsAsc: readonly MarketSnapshot[]): ListingPriceHistory[] {
  const byKey = new Map<string, ListingPriceHistory>();
  for (const snapshot of snapshotsAsc) {
    for (const listing of snapshot.listings) {
      const key = listingKey(listing);
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          key,
          product: listing.product,
          brand: listing.brand,
          marketplace: listing.marketplace,
          points: [],
        };
        byKey.set(key, entry);
      }
      entry.points.push({
        snapshotId: snapshot.id,
        capturedAt: snapshot.capturedAt,
        price: listing.price,
      });
    }
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}