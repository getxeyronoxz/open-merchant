import { hashPrompt, type CompletionRequest, type CompletionResult, type LlmProvider } from "./providers";

/**
 * BYO-key cloud providers implemented over their plain HTTP APIs — no
 * vendor SDKs, no version roulette. Each provider is a small adapter that
 * returns the model's raw text; structured outputs are validated by agents.
 */

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new AiProviderError(
      `Network request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AiProviderError(`Provider returned ${response.status}: ${detail.slice(0, 400)}`);
  }
  return response.json() as Promise<unknown>;
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
  const normalized = options.baseUrl.trim().replace(/\/+$/u, "");
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
