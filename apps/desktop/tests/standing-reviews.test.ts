import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";

import { AppError, type ReviewDisposition, type RunRecord } from "@open-merchant/shared";

import { MerchantService } from "../src/main/service";

/**
 * Standing reviews, end to end through the real service: the queue is derived
 * from artifacts on disk, and a snooze is a journal append.
 *
 * The two properties worth defending are that a snooze actually hides the
 * review, and that it hides it *only* — the journal must gain exactly one run
 * and touch nothing else in the project.
 */

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "om-reviews-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function only<T>(items: T[]): T {
  expect(items).toHaveLength(1);
  return items[0] as T;
}

function service(): MerchantService {
  return new MerchantService("9.9.9-test");
}

async function makeProject(name: string): Promise<{ root: string; parent: string }> {
  const parent = await tempDir();
  const created = await service().createProject({
    parentDirectory: parent,
    name,
    objective: "Decide whether this opportunity is worth pursuing.",
    currency: "INR",
  });
  return { root: created.root, parent };
}

/** Ensures the project has one evidence source, observed `days` ago. */
async function staleEvidence(root: string, days: number): Promise<void> {
  const { WorkspaceStore } = await import("@open-merchant/core");
  const store = await WorkspaceStore.open(root);
  const observedAt = new Date(Date.now() - days * 86_400_000).toISOString();
  const existing = await store.loadEvidence();
  await store.saveEvidence(
    existing.length > 0
      ? existing.map((source) => ({ ...source, observedAt, updatedAt: observedAt }))
      : [
          {
            id: "S-001",
            url: "https://example.com/market",
            title: "Market listing page",
            notes: "",
            observations: [],
            observedAt,
            createdAt: observedAt,
            updatedAt: observedAt,
          },
        ],
  );
}

async function readRuns(root: string): Promise<RunRecord[]> {
  const raw = await readFile(join(root, ".openmerchant", "runs.jsonl"), "utf8");
  return raw
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as RunRecord);
}

describe("standing reviews queue", () => {
  it("derives reviews across every project it is given", async () => {
    const a = await makeProject("Quiet");
    const b = await makeProject("Aging");
    await staleEvidence(b.root, 90);

    const reviews = await service().standingReviews([
      { name: "Quiet", path: a.root },
      { name: "Aging", path: b.root },
    ]);

    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.projectName).toBe("Aging");
    expect(reviews[0]?.kind).toBe("stale-evidence");
  });

  it("says nothing about a brand new project", async () => {
    const a = await makeProject("Fresh");

    expect(await service().standingReviews([{ name: "Fresh", path: a.root }])).toEqual([]);
  });

  it("omits a project it cannot open instead of failing the whole queue", async () => {
    const good = await makeProject("Readable");
    await staleEvidence(good.root, 90);
    const missing = await tempDir();

    const reviews = await service().standingReviews([
      { name: "Missing", path: join(missing, "not-a-project") },
      { name: "Readable", path: good.root },
    ]);

    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.projectName).toBe("Readable");
  });
});

describe("disposeReview", () => {
  it("appends exactly one run and touches nothing else", async () => {
    const project = await makeProject("Aging");
    await staleEvidence(project.root, 90);
    const before = await readRuns(project.root);
    const runsPath = join(project.root, ".openmerchant", "runs.jsonl");

    const disposition = await service().disposeReview(
      project.root,
      "stale-evidence:S-001",
      "snoozed",
    );

    const after = await readRuns(project.root);
    expect(after).toHaveLength(before.length + 1);
    const appended = only(after.filter((run) => run.operation === "reviewSnoozed"));
    expect(appended.status).toBe("succeeded");
    expect(appended.review?.reviewKey).toBe("stale-evidence:S-001");
    // What the caller was told is what the journal actually holds.
    expect(appended.review).toEqual(disposition);
    expect(appended.inputArtifacts).toEqual([]);
    expect(appended.outputArtifacts).toEqual([]);
    // The project bytes outside the journal are untouched.
    const manifest = await readFile(join(project.root, ".openmerchant", "manifest.json"), "utf8");
    expect(manifest).toContain("Aging");
    expect(runsPath).toContain("runs.jsonl");
  });

  it("hides the review on the next read", async () => {
    const project = await makeProject("Aging");
    await staleEvidence(project.root, 90);
    const reviews = () => service().standingReviews([{ name: "Aging", path: project.root }]);
    expect(await reviews()).toHaveLength(1);

    await service().disposeReview(project.root, "stale-evidence:S-001", "snoozed");

    expect(await reviews()).toEqual([]);
  });

  it("hides a dismissed review", async () => {
    const project = await makeProject("Aging");
    await staleEvidence(project.root, 90);
    const reviews = () => service().standingReviews([{ name: "Aging", path: project.root }]);

    await service().disposeReview(project.root, "stale-evidence:S-001", "dismissed");

    expect(await reviews()).toEqual([]);
    const runs = await readRuns(project.root);
    expect(only(runs.filter((run) => run.operation === "reviewDismissed")).status).toBe("succeeded");
  });

  it("records the occurrence it silenced, taken from the derived queue", async () => {
    const project = await makeProject("Aging");
    await staleEvidence(project.root, 90);
    const before = only(
      await service().standingReviews([{ name: "Aging", path: project.root }]),
    );

    const disposition: ReviewDisposition = await service().disposeReview(
      project.root,
      "stale-evidence:S-001",
      "snoozed",
    );

    expect(disposition.reviewDueAt).toBe(before.dueAt);
  });

  it("snoozes for a week", async () => {
    const project = await makeProject("Aging");
    await staleEvidence(project.root, 90);

    const disposition = await service().disposeReview(
      project.root,
      "stale-evidence:S-001",
      "snoozed",
    );

    const days = (Date.parse(disposition.until ?? "") - Date.parse(disposition.recordedAt)) / 86_400_000;
    expect(days).toBeCloseTo(7, 1);
  });

  it("refuses a key that is not currently showing, and writes nothing", async () => {
    const project = await makeProject("Fresh");
    const before = await readRuns(project.root);

    await expect(
      service().disposeReview(project.root, "stale-evidence:S-001", "snoozed"),
    ).rejects.toBeInstanceOf(AppError);

    expect(await readRuns(project.root)).toHaveLength(before.length);
  });

  it("does not let one project's snooze silence another's", async () => {
    const a = await makeProject("Aging A");
    const b = await makeProject("Aging B");
    await staleEvidence(a.root, 90);
    await staleEvidence(b.root, 90);

    await service().disposeReview(a.root, "stale-evidence:S-001", "snoozed");
    const reviews = await service().standingReviews([
      { name: "Aging A", path: a.root },
      { name: "Aging B", path: b.root },
    ]);

    expect(reviews.map((review) => review.projectName)).toEqual(["Aging B"]);
  });
});
