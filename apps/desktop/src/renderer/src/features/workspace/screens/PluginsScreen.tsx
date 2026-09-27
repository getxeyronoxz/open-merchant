import { useState } from "react";

import type { McpHostConfig } from "@open-merchant/shared";

import { ErrorState } from "@open-merchant/ui";

import { useDraftInbox } from "../DraftInboxProvider";
import {
  useConnectorFetch,
  useMcpServer,
  usePluginCatalog,
  usePluginSource,
  useSetPluginEnabled,
} from "../queries";
import { PluginsPanel } from "./PluginsPanel";

/**
 * The plugin surface. Every plugin starts disabled and its declared source is
 * one click away, so nothing a stranger wrote is turned on before the seller has
 * seen what the manifest says it is.
 *
 * A connector can also be run from here. The result goes to the Draft Desk and
 * nowhere else — accepting a draft is still a separate, deliberate act.
 */
export function PluginsScreen({ root }: { readonly root: string }) {
  const catalog = usePluginCatalog();
  const setEnabled = useSetPluginEnabled();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const source = usePluginSource(selectedId);
  const [query, setQuery] = useState("");
  const [fetchingPluginId, setFetchingPluginId] = useState<string | null>(null);
  const fetchConnector = useConnectorFetch();
  const { enqueueMany } = useDraftInbox();
  const mcp = useMcpServer(root);

  if (catalog.isLoading) {
    return <section className="screen" />;
  }
  if (catalog.isError) {
    return <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />;
  }
  if (!catalog.data) {
    return <section className="screen" />;
  }

  const runFetch = (pluginId: string) => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    setFetchingPluginId(pluginId);
    fetchConnector.mutate(
      { root, pluginId, query: trimmed },
      {
        onSuccess: (result) => enqueueMany(result.drafts),
        // Release the row whatever happened; a refusal is shown on the desk.
        onSettled: () => setFetchingPluginId(null),
      },
    );
  };

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="om-eyebrow">Plugins</p>
        <h1 className="om-section-title">Local, inspectable extensions</h1>
        <p className="om-section-sub">
          A plugin is a folder of data, not a program this app runs. Report sections and CSV
          dialects are plain text. A connector names an external command that runs on your machine
          as itself — this app will only ever accept drafts from it, never a write. There is no
          marketplace and nothing updates itself.
        </p>
      </header>

      {fetchConnector.isError ? (
        <p className="om-field__hint" role="alert">
          {fetchConnector.error instanceof Error
            ? fetchConnector.error.message
            : "The connector did not run."}{" "}
          Nothing was written to the project.
        </p>
      ) : null}

      <PluginsPanel
        catalog={catalog.data}
        source={
          selectedId && source.data ? { pluginId: selectedId, text: source.data.source } : null
        }
        onSelect={(pluginId) =>
          // A disclosure that could only ever open. Clicking the plugin whose
          // source is already showing closes it again, which is what the
          // button's expanded/collapsed state now claims.
          setSelectedId((current) => (current === pluginId ? null : pluginId))
        }
        onToggle={(pluginId, enabled) => setEnabled.mutate({ pluginId, enabled })}
        query={query}
        onQueryChange={setQuery}
        onFetch={runFetch}
        fetchingPluginId={fetchingPluginId}
      />

      <McpLaneCard
        available={mcp.data?.available ?? false}
        command={mcp.data?.command ?? ""}
        configs={mcp.data?.configs ?? []}
      />
    </section>
  );
}

/**
 * The read-only lane, pointed at from the same screen as the write-ish one.
 *
 * The server ships inside the app, but the path to it is not something a seller
 * should have to work out — on Windows it sits under `Program Files`, and an MCP
 * host needs that exact path plus the project folder as an argument. So the app
 * resolves it and hands over a config to paste, rather than describing where to
 * look.
 */
function McpLaneCard({
  available,
  command,
  configs,
}: {
  available: boolean;
  command: string;
  configs: readonly McpHostConfig[];
}) {
  // A single snippet would be a guess. Hosts disagree on the top-level key, the
  // transport spelling, and whether the command is a string or an array, so the
  // seller picks the host they actually run rather than being handed something
  // that silently will not be read.
  const [hostId, setHostId] = useState(configs[0]?.id ?? "");
  const host = configs.find((entry) => entry.id === hostId) ?? configs[0];

  return (
    <section className="om-card" aria-label="Read-only MCP lane">
      <p className="om-eyebrow">Let your AI read the record</p>
      <p className="om-field__hint">
        Open Merchant ships a local MCP server your AI assistant can spawn, so it can read this
        project&apos;s evidence, competitors, scenarios, and reports. It cannot write: every write is
        refused, and every read is recorded in the project&apos;s run log. Nothing leaves your
        machine.
      </p>
      {available && host !== undefined ? (
        <>
          <p className="om-field__hint">
            Add it to the host you use. It points at <code>{command}</code> and opens this project.
          </p>
          {configs.length > 1 ? (
            <div className="om-field" role="group" aria-label="Which app are you adding this to?">
              <span className="om-field__label" id="om-mcp-host-label">
                I use
              </span>
              <div className="draft-desk__actions">
                {configs.map((entry) => (
                  <button
                    aria-pressed={entry.id === host.id}
                    className={`om-button ${entry.id === host.id ? "om-button--primary" : "om-button--secondary"}`}
                    key={entry.id}
                    onClick={() => setHostId(entry.id)}
                    type="button"
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <p className="om-field__hint">
            Paste this into {host.fileHint}:
          </p>
          <pre className="om-code" aria-label={`${host.label} configuration`}>
            {host.snippet}
          </pre>
          {host.cli === "" ? null : (
            <>
              <p className="om-field__hint">
                Or skip the file entirely and run this instead:
              </p>
              <pre className="om-code" aria-label={`${host.label} command`}>
                {host.cli}
              </pre>
            </>
          )}
          <p className="om-field__hint">
            Other hosts speak the same protocol but name the settings differently — the shape above
            is the one {host.label} reads. If yours differs, it needs <code>command</code> and the
            project folder as its first argument.
          </p>
        </>
      ) : (
        <p className="om-field__hint">
          The server is not present in this build. A published install always includes it; a
          development checkout does not, because the server is staged at build time.
        </p>
      )}
    </section>
  );
}
