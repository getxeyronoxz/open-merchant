import { useEffect, useState } from "react";

import { ErrorState, Field } from "@open-merchant/ui";

import {
  useAiConfig,
  useSaveAiConfig,
  useTestAi,
} from "../queries";

/**
 * AI settings: bring your own key. Keys are sealed with OS-backed
 * encryption before storage and are never displayed or exported again —
 * the UI only learns whether a key exists.
 */
export function AiSettingsScreen() {
  const configQuery = useAiConfig();
  const save = useSaveAiConfig();
  const test = useTestAi();

  const [providerId, setProviderId] = useState<"anthropic" | "openai">("anthropic");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (configQuery.data) {
      setProviderId(
        configQuery.data.activeProvider === "openai" ? "openai" : "anthropic",
      );
      setModelId(configQuery.data.models[configQuery.data.activeProvider ?? "anthropic"] ?? "");
    }
  }, [configQuery.data]);

  if (configQuery.isPending) {
    return (
      <p className="om-loading">
        <span className="om-spinner" /> Loading AI settings…
      </p>
    );
  }
  if (configQuery.isError) {
    return <ErrorState error={configQuery.error} onRetry={() => configQuery.refetch()} />;
  }

  const config = configQuery.data;
  const hasKey = Boolean(config.hasKeys[providerId]);

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="om-eyebrow">AI settings</p>
        <h1 className="om-section-title">Bring your own model</h1>
        <p className="om-section-sub">
          The assistants draft; you decide. Your API key is encrypted with this machine's OS
          credentials and is never written into project folders.
        </p>
      </header>

      {!config.encryptionAvailable ? (
        <div className="om-error-state" role="status">
          This system does not expose secure credential storage, so API keys cannot be saved and
          the AI assistants stay off. Everything else in Open Merchant works without them.
        </div>
      ) : null}

      <form
        className="om-card screen__form"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({
            providerId,
            modelId,
            apiKey: apiKey.trim().length > 0 ? apiKey.trim() : null,
          });
        }}
      >
        <div className="ai-providers" role="radiogroup" aria-label="AI provider">
          {(["anthropic", "openai"] as const).map((id) => (
            <button
              aria-pressed={providerId === id}
              className={`om-card ai-provider${providerId === id ? " is-active" : ""}`}
              key={id}
              onClick={() => {
                setProviderId(id);
                setModelId(config.models[id] ?? "");
              }}
              type="button"
            >
              <strong>{id === "anthropic" ? "Anthropic" : "OpenAI"}</strong>
              <span className="om-data">{config.hasKeys[id] ? "key saved" : "no key yet"}</span>
            </button>
          ))}
        </div>

        <Field label="Model ID">
          <input
            className="om-input om-input--mono"
            onChange={(event) => setModelId(event.target.value)}
            placeholder={config.models[providerId]}
            required
            value={modelId}
          />
        </Field>
        <Field
          hint={hasKey ? "A key is already stored. Leave empty to keep it." : undefined}
          label="API key"
        >
          <input
            autoComplete="off"
            className="om-input om-input--mono"
            onChange={(event) => setApiKey(event.target.value)}
            type="password"
            value={apiKey}
          />
        </Field>

        <div className="screen__form-foot">
          <button
            className="om-button om-button--secondary"
            disabled={!hasKey || test.isPending}
            onClick={() => test.mutate(providerId)}
            type="button"
          >
            {test.isPending ? "Testing…" : "Test connection"}
          </button>
          <button className="om-button om-button--primary" disabled={save.isPending} type="submit">
            {save.isPending ? "Saving…" : hasKey ? "Update settings" : "Save settings"}
          </button>
        </div>

        {test.data ? (
          <p className="om-badge om-badge--accent" role="status">
            Provider replied: {test.data.reply}
          </p>
        ) : null}
        {save.isSuccess && !test.data ? (
          <p className="om-badge om-badge--accent" role="status">
            Settings saved
          </p>
        ) : null}
        {save.isError ? <ErrorState error={save.error} /> : null}
        {test.isError ? <ErrorState error={test.error} onRetry={() => test.mutate(providerId)} /> : null}
      </form>
    </section>
  );
}
