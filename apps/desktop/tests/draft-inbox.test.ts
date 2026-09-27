import { describe, expect, it } from "vitest";

import type { GenerationOrigin } from "@open-merchant/shared";

import {
  enqueueDrafts,
  removeDraft,
  type DraftRecord,
} from "../src/renderer/src/features/workspace/draftInbox";

const AI: GenerationOrigin = {
  kind: "agent",
  agentId: "planner",
  providerId: "anthropic",
  modelId: "claude",
  promptHash: "a".repeat(64),
};

const CONNECTOR: GenerationOrigin = {
  kind: "connector",
  connectorId: "sample-market",
  pluginId: "sample-market",
  fetchedAt: "2026-09-25T12:00:00.000Z",
  rawResponseHash: "b".repeat(64),
};

function plan(id: string, origin: GenerationOrigin = AI): DraftRecord {
  return {
    id,
    kind: "plan",
    origin,
    createdAt: "2026-09-25T12:00:00.000Z",
    value: { steps: [{ title: "Map listings", why: "Ground pricing" }] },
  };
}

function evidenceDraft(id: string): DraftRecord {
  return {
    id,
    kind: "evidence",
    origin: CONNECTOR,
    createdAt: "2026-09-25T12:00:00.000Z",
    value: {
      id: "S-001",
      url: "https://example.com/market",
      title: "Sample",
      notes: "",
      observations: [],
      observedAt: "2026-09-25T12:00:00.000Z",
      createdAt: "2026-09-25T12:00:00.000Z",
      updatedAt: "2026-09-25T12:00:00.000Z",
    },
  };
}

describe("enqueueDrafts", () => {
  it("puts a whole fetch at the head, keeping the order the connector returned", () => {
    const existing = [plan("DRAFT-1")];
    const incoming = [evidenceDraft("DRAFT-2"), evidenceDraft("DRAFT-3")];

    const next = enqueueDrafts(existing, incoming);

    expect(next.map((draft) => draft.id)).toEqual(["DRAFT-2", "DRAFT-3", "DRAFT-1"]);
  });

  it("ignores a draft id that is already queued, so one fetch cannot double up", () => {
    const existing = [evidenceDraft("DRAFT-2")];

    const next = enqueueDrafts(existing, [evidenceDraft("DRAFT-2"), evidenceDraft("DRAFT-9")]);

    expect(next.map((draft) => draft.id)).toEqual(["DRAFT-9", "DRAFT-2"]);
  });

  it("drops duplicates inside a single batch too", () => {
    const next = enqueueDrafts([], [evidenceDraft("DRAFT-2"), evidenceDraft("DRAFT-2")]);

    expect(next.map((draft) => draft.id)).toEqual(["DRAFT-2"]);
  });

  it("leaves both inputs untouched", () => {
    const existing = [plan("DRAFT-1")];
    const incoming = [evidenceDraft("DRAFT-2")];

    enqueueDrafts(existing, incoming);

    expect(existing.map((draft) => draft.id)).toEqual(["DRAFT-1"]);
    expect(incoming).toHaveLength(1);
  });

  it("adds nothing when the fetch produced no drafts", () => {
    const existing = [plan("DRAFT-1")];

    expect(enqueueDrafts(existing, []).map((draft) => draft.id)).toEqual(["DRAFT-1"]);
  });
});

describe("removeDraft", () => {
  it("removes only the named draft", () => {
    const queue = [plan("DRAFT-1"), evidenceDraft("DRAFT-2"), plan("DRAFT-3")];

    expect(removeDraft(queue, "DRAFT-2").map((draft) => draft.id)).toEqual([
      "DRAFT-1",
      "DRAFT-3",
    ]);
  });

  it("is a no-op for an id that is not queued", () => {
    const queue = [plan("DRAFT-1")];

    expect(removeDraft(queue, "DRAFT-nope").map((draft) => draft.id)).toEqual(["DRAFT-1"]);
  });

  it("does not mutate the queue it was given", () => {
    const queue = [plan("DRAFT-1"), evidenceDraft("DRAFT-2")];

    removeDraft(queue, "DRAFT-1");

    expect(queue).toHaveLength(2);
  });
});
