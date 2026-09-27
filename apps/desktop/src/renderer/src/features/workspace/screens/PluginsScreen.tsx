import { useState } from "react";

import { ErrorState } from "@open-merchant/ui";

import { useDraftInbox } from "../DraftInboxProvider";
import { useConnectorFetch, usePluginCatalog, usePluginSource, useSetPluginEnabled } from "../queries";
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
    </section>
  );
}
