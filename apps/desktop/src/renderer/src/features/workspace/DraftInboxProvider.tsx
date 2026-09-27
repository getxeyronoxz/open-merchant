import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { enqueueDrafts, removeDraft, type DraftRecord, type NewDraft } from "./draftInbox";

/**
 * The review queue, shared by the whole workspace.
 *
 * It used to live inside the Draft Desk's own state, which meant a draft
 * produced somewhere else — a connector run from the Plugins screen — had
 * nowhere to go. The queue is session-scoped on purpose: drafts are unaccepted
 * proposals, and an app restart should not resurrect one nobody ever looked at.
 */

export interface DraftInbox {
  readonly drafts: readonly DraftRecord[];
  readonly activeId: string | null;
  readonly setActiveId: (id: string | null) => void;
  readonly enqueue: (draft: NewDraft | DraftRecord) => void;
  readonly enqueueMany: (drafts: readonly DraftRecord[]) => void;
  readonly discard: (id?: string | null) => void;
}

const DraftInboxContext = createContext<DraftInbox | null>(null);

export function DraftInboxProvider({ children }: { readonly children: ReactNode }) {
  const [drafts, setDrafts] = useState<readonly DraftRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const enqueueMany = useCallback((incoming: readonly DraftRecord[]) => {
    if (incoming.length === 0) return;
    setDrafts((current) => enqueueDrafts(current, incoming));
    // Show what just arrived; a fetch the seller cannot see is not a fetch.
    setActiveId(incoming[0]?.id ?? null);
  }, []);

  const enqueue = useCallback(
    (draft: NewDraft | DraftRecord) => {
      // A draft made here gets its identity and time from here; one that
      // arrived from a connector already carries both.
      const withId: DraftRecord =
        "id" in draft
          ? (draft as DraftRecord)
          : ({ ...draft, id: localDraftId(), createdAt: new Date().toISOString() } as DraftRecord);
      enqueueMany([withId]);
    },
    [enqueueMany],
  );

  const discard = useCallback(
    (id?: string | null) => {
      // No id means "the one on the desk", which is what the Discard button means.
      const target = id ?? activeId;
      if (!target) return;
      setDrafts((current) => removeDraft(current, target));
      setActiveId((current) => (current === target ? null : current));
    },
    [activeId],
  );

  const value = useMemo<DraftInbox>(
    () => ({ drafts, activeId, setActiveId, enqueue, enqueueMany, discard }),
    [drafts, activeId, enqueue, enqueueMany, discard],
  );

  return <DraftInboxContext.Provider value={value}>{children}</DraftInboxContext.Provider>;
}

export function useDraftInbox(): DraftInbox {
  const value = useContext(DraftInboxContext);
  if (!value) throw new Error("useDraftInbox must be used inside a DraftInboxProvider");
  return value;
}

let draftCounter = 0;

/** Ids for drafts this app generated itself; connector ids come with the fetch. */
function localDraftId(): string {
  draftCounter += 1;
  return `DRAFT-local-${Date.now()}-${draftCounter}`;
}
