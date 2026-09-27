import type { PluginCatalog } from "@open-merchant/shared";
import { EmptyState, Field } from "@open-merchant/ui";

export interface PluginsPanelProps {
  readonly catalog: PluginCatalog;
  /** The source of the plugin the seller has selected, or null when none is. */
  readonly source: { pluginId: string; text: string } | null;
  readonly onSelect: (pluginId: string) => void;
  readonly onToggle: (pluginId: string, enabled: boolean) => void;
  /** Free text handed to the connector. There is no manifest-defined input form. */
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly onFetch: (pluginId: string) => void;
  /** The connector currently running, or null when none is. */
  readonly fetchingPluginId: string | null;
}

/**
 * The plugin surface, rendered as data. Nothing here runs plugin code: a
 * plugin contributes static text, a column mapping, or the name of a command
 * the connector client owns. `network: true` is shown as a disclosure the
 * seller accepts, never as a restriction this screen claims to enforce.
 */
/**
 * The single source panel every row's button controls. One region for all rows
 * because only one plugin's source is ever shown at a time.
 */
const SOURCE_REGION_ID = "om-plugin-source";

export function PluginsPanel({
  catalog,
  source,
  onSelect,
  onToggle,
  query,
  onQueryChange,
  onFetch,
  fetchingPluginId,
}: PluginsPanelProps) {
  const { directory } = catalog;
  const enabledConnectors = catalog.plugins.filter(
    (plugin) => plugin.enabled && plugin.manifest.kind === "connector",
  );
  const canFetch = query.trim().length > 0 && fetchingPluginId === null;

  return (
    <>
      <section className="om-card" aria-label="Installed plugins">
        <p className="om-eyebrow">Plugins</p>

        {catalog.plugins.length === 0 && catalog.broken.length === 0 ? (
          <EmptyState title="No plugins installed">
            <p className="om-field__hint">
              Put a plugin folder in this directory, each holding a <code>manifest.json</code>.
              Plugins start disabled, and you read their source before turning one on.
            </p>
            {/* The path is shown, not described. It follows the app's package
                name and so is not something a seller can be expected to guess —
                and a plugin dropped in the wrong place looks exactly like a
                plugin that was ignored. */}
            <p className="om-field__hint">
              <code>{directory}</code>
            </p>
          </EmptyState>
        ) : (
          <ul className="om-list">
            {catalog.plugins.map((plugin) => {
              const { manifest } = plugin;
              const reachesNetwork =
                manifest.kind === "connector" && manifest.capabilities.network;
              const isSelected = source?.pluginId === manifest.id;
              const isFetching = fetchingPluginId === manifest.id;
              const canRunThis = manifest.kind === "connector" && plugin.enabled;
              return (
                <li className="om-list__row" key={manifest.id}>
                  <div>
                    <p className="om-list__title">
                      <strong>{manifest.name}</strong>{" "}
                      <span className="om-badge">{manifest.kind}</span>
                    </p>
                    <p className="om-field__hint">
                      {manifest.id} · {manifest.version} · {manifest.author} · needs Open Merchant{" "}
                      {manifest.minAppVersion}+
                    </p>
                    {reachesNetwork ? (
                      <p className="om-field__hint">This plugin may reach the internet.</p>
                    ) : null}
                  </div>
                  <div className="om-list__actions">
                    <button
                      aria-controls={SOURCE_REGION_ID}
                      aria-expanded={isSelected}
                      className="om-button om-button--ghost"
                      onClick={() => onSelect(manifest.id)}
                      type="button"
                    >
                      View source
                    </button>
                    {canRunThis ? (
                      <button
                        className="om-button om-button--secondary"
                        disabled={!canFetch}
                        onClick={() => onFetch(manifest.id)}
                        type="button"
                      >
                        {isFetching ? "Fetching…" : "Fetch drafts"}
                      </button>
                    ) : null}
                    <button
                      className={`om-button ${plugin.enabled ? "om-button--danger" : "om-button--primary"}`}
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
          <pre className="om-code" id={SOURCE_REGION_ID} aria-label={`Source of ${source.pluginId}`}>
            {source.text}
          </pre>
        ) : null}
      </section>

      {enabledConnectors.length > 0 ? (
        <section className="om-card" aria-label="Fetch from a connector">
          <p className="om-eyebrow">Fetch</p>
          <Field
            label="What should it look for?"
            hint="The connector runs as a command on this machine, as you. What comes back lands on the Draft Desk as drafts you accept or discard one by one — nothing is written to the project until you do."
          >
            <input
              className="om-input"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="keyboard"
              type="text"
              value={query}
            />
          </Field>
        </section>
      ) : null}

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
