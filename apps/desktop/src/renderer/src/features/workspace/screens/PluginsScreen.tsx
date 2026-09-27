import { useState } from "react";

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
        configExample={mcp.data?.configExample ?? ""}
        command={mcp.data?.command ?? ""}
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
  configExample,
  command,
}: {
  available: boolean;
  configExample: string;
  command: string;
}) {
  return (
    <section className="om-card" aria-label="Read-only MCP lane">
      <p className="om-eyebrow">Let your AI read the record</p>
      <p className="om-field__hint">
        Open Merchant ships a local MCP server your AI assistant can spawn, so it can read this
        project&apos;s evidence, competitors, scenarios, and reports. It cannot write: every write is
        refused, and every read is recorded in the project&apos;s run log. Nothing leaves your machine.
      </p>
      {available ? (
        <>
          <p className="om-field__hint">
            Paste this into your MCP host&apos;s config to open this project. It points at{" "}
            <code>{command}</code>.
          </p>
          <pre className="om-code" aria-label="MCP host configuration">
            {configExample}
          </pre>
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
