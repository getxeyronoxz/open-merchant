import { useState } from "react";

import { ErrorState } from "@open-merchant/ui";

import { usePluginCatalog, usePluginSource, useSetPluginEnabled } from "../queries";
import { PluginsPanel } from "./PluginsPanel";

/**
 * The plugin surface. Every plugin starts disabled and its source is one click
 * away, so nothing a stranger wrote runs before the seller has read it.
 */
export function PluginsScreen() {
  const catalog = usePluginCatalog();
  const setEnabled = useSetPluginEnabled();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const source = usePluginSource(selectedId);

  if (catalog.isLoading) {
    return <section className="screen" />;
  }
  if (catalog.isError) {
    return <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />;
  }
  if (!catalog.data) {
    return <section className="screen" />;
  }

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="om-eyebrow">Plugins</p>
        <h1 className="om-section-title">Local, inspectable extensions</h1>
        <p className="om-section-sub">
          A plugin is a folder of data, not a program this app runs. Report sections and CSV
          dialects are plain text; a connector names an external command that runs on your machine
          and can only ever propose drafts. There is no marketplace and nothing updates itself.
        </p>
      </header>

      <PluginsPanel
        catalog={catalog.data}
        source={
          selectedId && source.data ? { pluginId: selectedId, text: source.data.source } : null
        }
        onSelect={setSelectedId}
        onToggle={(pluginId, enabled) => setEnabled.mutate({ pluginId, enabled })}
      />
    </section>
  );
}
