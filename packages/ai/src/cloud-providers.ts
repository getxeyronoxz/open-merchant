import { hashPrompt, type CompletionRequest, type CompletionResult, type LlmProvider } from "./providers";

/**
 * BYO-key cloud providers implemented over their plain HTTP APIs — no
 * vendor SDKs, no version roulette. Each provider is a small adapter that
 * returns the model's raw text; structured outputs are validated by agents.
 */

export class AiProviderError extends Error {
  readonly status?: number;
  readonly raw?: string;

  constructor(message: string, options?: { status?: number; raw?: string }) {
    super(message);
    this.name = "AiProviderError";
    this.status = options?.status;
    this.raw = options?.raw;
  }
}

/** Human-readable framing for the HTTP statuses providers actually return. */
function providerErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "The provider rejected the API key (HTTP 401). Check the key in AI settings.";
  }
  if (status === 404) {
    return "The provider does not recognize this model ID (HTTP 404). Check the Model ID in AI settings.";
  }
  if (status === 429) {
    return "The provider is rate-limiting this key (HTTP 429). Wait a moment and try again.";
  }
  if (status >= 500) {
    return `The provider is temporarily unavailable (HTTP ${status}) — often a temporary load spike. Try again in a moment.`;
  }
  return `The provider rejected the request (HTTP ${status}).`;
}

/**
 * Transient statuses worth an automatic second chance — provider load
 * spikes (5xx) and rate limits (429). Permanent failures (bad key, unknown
 * model, bad request) are never retried: retrying those is just noise.
 */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 600];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (attempt === MAX_ATTEMPTS - 1) {
        throw new AiProviderError(
          `Network request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      await sleep(RETRY_DELAYS_MS[attempt] as number);
      continue;
    }
    if (response.ok) return response.json() as Promise<unknown>;
    const raw = (await response.text().catch(() => "")).slice(0, 400);
    if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS - 1) {
      throw new AiProviderError(providerErrorMessage(response.status), {
        status: response.status,
        raw,
      });
    }
    // Honor Retry-After when the provider sends one; otherwise back off.
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const delayMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds * 1000, 10_000)
        : (RETRY_DELAYS_MS[attempt] as number);
    await sleep(delayMs);
  }
  // Unreachable: every loop iteration either returns, retries, or throws.
  throw new AiProviderError("The provider did not respond.");
}

export interface AnthropicOptions {
  readonly apiKey: string;
  readonly modelId: string;
}

export function createAnthropicProvider(options: AnthropicOptions): LlmProvider {
  const id = "anthropic";
  return {
    id,
    modelId: options.modelId,
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const payload = (await postJson(
        // Verified current 2026-09-12 against platform.claude.com/docs —
        // POST /v1/messages remains the primary Messages API and
        // "2023-06-01" the only GA anthropic-version header value.
        "https://api.anthropic.com/v1/messages",
        {
          "x-api-key": options.apiKey,
          "anthropic-version": "2023-06-01",
        },
        {
          model: options.modelId,
          max_tokens: 4096,
          system: request.system,
          messages: [{ role: "user", content: request.prompt }],
        },
      )) as { content?: { type: string; text?: string }[] };

      const text = (payload.content ?? [])
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("");
      if (!text) throw new AiProviderError("Anthropic returned an empty completion");

      return {
        text,
        providerId: id,
        modelId: options.modelId,
        promptHash: hashPrompt(request),
      };
    },
  };
}

export interface OpenAiOptions {
  readonly apiKey: string;
  readonly modelId: string;
}

export function createOpenAiProvider(options: OpenAiOptions): LlmProvider {
  const id = "openai";
  return {
    id,
    modelId: options.modelId,
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const payload = (await postJson(
        // Verified current 2026-09-12 against developers.openai.com —
        // /v1/chat/completions is still a supported, non-deprecated
        // endpoint (the Responses API is the newer alternative; the v1
        // backwards-compatibility policy explicitly covers chat/completions).
        "https://api.openai.com/v1/chat/completions",
        { authorization: `Bearer ${options.apiKey}` },
        {
          model: options.modelId,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.prompt },
          ],
        },
      )) as { choices?: { message?: { content?: string } }[] };

      const text = payload.choices?.[0]?.message?.content ?? "";
      if (!text) throw new AiProviderError("OpenAI returned an empty completion");

      return {
        text,
        providerId: id,
        modelId: options.modelId,
        promptHash: hashPrompt(request),
      };
    },
  };
}

export interface GeminiOptions {
  readonly apiKey: string;
  readonly modelId: string;
}

export function createGeminiProvider(options: GeminiOptions): LlmProvider {
  const id = "gemini";
  return {
    id,
    modelId: options.modelId,
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const payload = (await postJson(
        // Verified current 2026-09-12 against ai.google.dev — v1beta
        // generateContent is still the documented text-generation endpoint
        // and the x-goog-api-key header is the supported auth style (the
        // ?key= query alternative would leak the key into URL logs).
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.modelId)}:generateContent`,
        { "x-goog-api-key": options.apiKey },
        {
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: "user", parts: [{ text: request.prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        },
      )) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };

      const text = (payload.candidates?.[0]?.content?.parts ?? [])
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("");
      if (!text) throw new AiProviderError("Gemini returned an empty completion");

      return {
        text,
        providerId: id,
        modelId: options.modelId,
        promptHash: hashPrompt(request),
      };
    },
  };
}

export interface LocalOpenAiOptions {
  /** OpenAI-compatible base URL, e.g. http://localhost:11434/v1 (Ollama). */
  readonly baseUrl: string;
  readonly modelId: string;
  /** Local servers usually need none; sent only when present. */
  readonly apiKey?: string;
}

export function createLocalOpenAiProvider(options: LocalOpenAiOptions): LlmProvider {
  const id = "local-openai";
  // Trim trailing slashes without a regex: CodeQL flags /\/+$/u as a
  // polynomial regular expression on uncontrolled input (user-provided URL).
  let normalized = options.baseUrl.trim();
  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  if (!/^https?:\/\//u.test(normalized)) {
    throw new AiProviderError(
      `Local endpoint URL must start with http:// or https:// — got "${options.baseUrl}"`,
    );
  }
  const headers: Record<string, string> = {};
  if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;
  return {
    id,
    modelId: options.modelId,
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const payload = (await postJson(`${normalized}/chat/completions`, headers, {
        model: options.modelId,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.prompt },
        ],
      })) as { choices?: { message?: { content?: string } }[] };

      const text = payload.choices?.[0]?.message?.content ?? "";
      if (!text) throw new AiProviderError("The local endpoint returned an empty completion");

      return {
        text,
        providerId: id,
        modelId: options.modelId,
        promptHash: hashPrompt(request),
      };
    },
  };
}
