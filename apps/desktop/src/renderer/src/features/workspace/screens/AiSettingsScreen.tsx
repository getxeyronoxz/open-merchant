import { useEffect, useState } from "react";

import type { ProviderId } from "@open-merchant/shared";
import { ErrorState, Field } from "@open-merchant/ui";

import {
  useAiConfig,
  useSaveAiConfig,
  useTestAi,
} from "../queries";

/**
 * AI settings: bring your own key — or none at all. Cloud keys are sealed
 * with OS-backed encryption before storage and are never displayed or
 * exported again; the UI only learns whether a key exists. Local
 * OpenAI-compatible endpoints (Ollama, LM Studio) run on this machine and
 * need no key, only a base URL.
 */

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "gemini", label: "Google Gemini" },
  { id: "local-openai", label: "Local · Ollama / LM Studio" },
];

export function AiSettingsScreen() {
  const configQuery = useAiConfig();
  const save = useSaveAiConfig();
  const test = useTestAi();

  const [providerId, setProviderId] = useState<ProviderId>("anthropic");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    if (configQuery.data) {
      const config = configQuery.data;
      const active = PROVIDERS.some((provider) => provider.id === config.activeProvider)
        ? (config.activeProvider as ProviderId)
        : "anthropic";
      setProviderId(active);
      setModelId(config.models[active] ?? "");
      setBaseUrl(config.baseUrls[active] ?? "");
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
  const isLocal = providerId === "local-openai";

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
            baseUrl: isLocal ? (baseUrl.trim().length > 0 ? baseUrl.trim() : null) : null,
          });
        }}
      >
        <div className="ai-providers" role="radiogroup" aria-label="AI provider">
          {PROVIDERS.map((provider) => (
            <button
              aria-pressed={providerId === provider.id}
              className={`om-card ai-provider${providerId === provider.id ? " is-active" : ""}`}
              key={provider.id}
              onClick={() => {
                setProviderId(provider.id);
                setModelId(config.models[provider.id] ?? "");
                setBaseUrl(config.baseUrls[provider.id] ?? "");
              }}
              type="button"
            >
              <strong>{provider.label}</strong>
              <span className="om-data">
                {config.hasKeys[provider.id]
                  ? "key saved"
                  : provider.id === "local-openai"
                    ? "no key needed"
                    : "no key yet"}
              </span>
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
        {isLocal ? (
          <Field
            hint="OpenAI-compatible endpoint — Ollama: http://localhost:11434/v1 · LM Studio: http://localhost:1234/v1"
            label="Endpoint base URL"
          >
            <input
              className="om-input om-input--mono"
              inputMode="url"
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={config.baseUrls[providerId] || "http://localhost:11434/v1"}
              value={baseUrl}
            />
          </Field>
        ) : null}
        <Field
          hint={
            hasKey
              ? "A key is already stored. Leave empty to keep it."
              : isLocal
                ? "Optional — most local servers need no key."
                : undefined
          }
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
            disabled={isLocal ? test.isPending : !hasKey || test.isPending}
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
