import { LedgerRow } from "@open-merchant/ui";

import type { GenerationOrigin } from "@open-merchant/shared";

export interface DraftOriginPanelProps {
  readonly origin: GenerationOrigin;
}

/** Digests are 64 characters. Show enough to recognise, keep all of it reachable. */
const SHORT_HASH = 12;

/**
 * Provenance for one draft, and only what actually produced it.
 *
 * A connector draft must never be dressed up as an AI draft: it came from a
 * local program, not a model, and it has a response digest where an AI draft
 * has a prompt hash. Rendering the wrong row here would be the one lie this
 * screen cannot afford — the panel is the record of who to ask when a number
 * turns out to be wrong.
 */
export function DraftOriginPanel({ origin }: DraftOriginPanelProps) {
  return (
    <div className="draft-desk__origin" aria-label="Draft provenance">
      {origin.kind === "connector" ? (
        <>
          <LedgerRow label="Connector" value={origin.connectorId} />
          <LedgerRow label="Plugin" value={origin.pluginId} tone="muted" />
          <LedgerRow label="Fetched at" value={origin.fetchedAt} />
          <LedgerRow
            label="Raw response hash"
            value={origin.rawResponseHash.slice(0, SHORT_HASH)}
            title={origin.rawResponseHash}
            tone="muted"
          />
        </>
      ) : null}
      {origin.kind === "agent" ? (
        <>
          <LedgerRow label="Agent" value={origin.agentId} />
          <LedgerRow
            label="Provider / model"
            value={`${origin.providerId} · ${origin.modelId}`}
          />
          <LedgerRow
            label="Prompt hash"
            value={origin.promptHash.slice(0, SHORT_HASH)}
            title={origin.promptHash}
            tone="muted"
          />
        </>
      ) : null}
      {origin.kind === "user" ? <LedgerRow label="Source" value="You" /> : null}
    </div>
  );
}
