import type { PluginCatalog } from "@open-merchant/shared";
import { EmptyState } from "@open-merchant/ui";

export interface PluginsPanelProps {
  readonly catalog: PluginCatalog;
  /** The source of the plugin the seller has selected, or null when none is. */
  readonly source: { pluginId: string; text: string } | null;
  readonly onSelect: (pluginId: string) => void;
  readonly onToggle: (pluginId: string, enabled: boolean) => void;
}

/**
 * The plugin surface, rendered as data. Nothing here runs plugin code: a
 * plugin contributes static text, a column mapping, or the name of a command
 * the connector client owns. `network: true` is shown as a disclosure the
 * seller accepts, never as a restriction this screen claims to enforce.
 */
export function PluginsPanel({ catalog, source, onSelect, onToggle }: PluginsPanelProps) {
  return (
    <>
      <section className="om-card" aria-label="Installed plugins">
        <p className="om-eyebrow">Plugins</p>

        {catalog.plugins.length === 0 && catalog.broken.length === 0 ? (
          <EmptyState title="No plugins installed">
            <p className="om-field__hint">
              Add a folder under this app&apos;s <code>plugins</code> directory, each holding a{" "}
              <code>manifest.json</code>. Plugins start disabled, and you read their source before
              turning one on.
            </p>
          </EmptyState>
        ) : (
          <ul className="om-list">
            {catalog.plugins.map((plugin) => {
              const { manifest } = plugin;
              const reachesNetwork =
                manifest.kind === "connector" && manifest.capabilities.network;
              const isSelected = source?.pluginId === manifest.id;
              return (
                <li className="om-list__row" key={manifest.id}>
                  <div>
                    <p className="om-list__title">
                      <strong>{manifest.name}</strong>{" "}
                      <span className="om-badge">{manifest.kind}</span>
                    </p>
                    <p className="om-field__hint">
                      {manifest.id} · {manifest.version} · {manifest.author}
                    </p>
                    {reachesNetwork ? (
                      <p className="om-field__hint">This plugin may reach the internet.</p>
                    ) : null}
                  </div>
                  <div className="om-list__actions">
                    <button
                      aria-pressed={isSelected}
                      className="om-button om-button--ghost"
                      onClick={() => onSelect(manifest.id)}
                      type="button"
                    >
                      View source
                    </button>
                    <button
                      className="om-button"
                      onClick={() => onToggle(manifest.id, !plugin.enabled)}
                      type="button"
                    >
                      {plugin.enabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {source ? (
          <pre className="om-code" aria-label={`Source of ${source.pluginId}`}>
            {source.text}
          </pre>
        ) : null}
      </section>

      {catalog.broken.length > 0 ? (
        <section className="om-card" aria-label="Plugins that were refused">
          <p className="om-eyebrow">Refused</p>
          <p className="om-field__hint">
            These were not loaded. Nothing was skipped silently — each one is listed with the
            reason it was refused.
          </p>
          <ul className="om-list">
            {catalog.broken.map((entry) => (
              <li className="om-list__row" key={entry.directoryName}>
                <div>
                  <p className="om-list__title">
                    <strong>{entry.directoryName}</strong>
                  </p>
                  <p className="om-field__hint">{entry.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
