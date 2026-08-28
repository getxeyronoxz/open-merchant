import { afterEach, describe, expect, it, vi } from "vitest";

import { AiProviderError, createAnthropicProvider, createGeminiProvider, createLocalOpenAiProvider, createOpenAiProvider } from "../src/cloud-providers";
import { createMockProvider, hashPrompt, type CompletionRequest, type LlmProvider } from "../src/providers";

describe("hashPrompt", () => {
  it("is stable for identical requests", () => {
    const request = { system: "You are an analyst.", prompt: "Summarize this listing." };
    expect(hashPrompt(request)).toBe(hashPrompt({ ...request }));
  });

  it("differs when system or prompt differ", () => {
    const base = { system: "a", prompt: "b" };
    expect(hashPrompt(base)).not.toBe(hashPrompt({ ...base, prompt: "c" }));
    expect(hashPrompt(base)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("createMockProvider", () => {
  it("returns deterministic completions with provenance fields", async () => {
    const provider = createMockProvider();
    const first = await provider.complete({ system: "system-prompt", prompt: "user-prompt" });
    const second = await provider.complete({ system: "system-prompt", prompt: "user-prompt" });

    expect(first.text).toBe(second.text);
    expect(first.providerId).toBe("mock");
    expect(first.modelId).toBe("mock-deterministic");
    expect(first.promptHash).toBe(second.promptHash);
  });

  it("allows tests to script the reply", async () => {
    const provider = createMockProvider({ reply: "SCRIPTED" });
    const result = await provider.complete({ system: "s", prompt: "p" });
    expect(result.text).toBe("SCRIPTED");
  });
});

// --- HTTP provider contract suite ---------------------------------------------
// Every HTTP-speaking provider must pass this same suite: the roadmap
// requires local-endpoint providers to clear exactly what Anthropic/OpenAI
// clear. Each case stubs globalThis.fetch — no network, no keys, no SDKs.

interface FetchCall {
  url: string;
  init: RequestInit;
}

interface ProviderCase {
  readonly id: string;
  readonly create: () => LlmProvider;
  /** Builds the JSON body the stubbed network returns for a success. */
  readonly successBody: (text: string) => unknown;
  readonly expectUrl: string;
  readonly expectHeaders: Record<string, string>;
  readonly expectRequestBody: (request: CompletionRequest) => unknown;
}

const REQUEST: CompletionRequest = {
  system: "You are an analyst.",
  prompt: "Summarize this listing as JSON.",
};

function stubFetch(handler: (url: string, init: RequestInit) => Response): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      const call = { url: String(url), init };
      calls.push(call);
      return handler(call.url, init);
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const CASES: ProviderCase[] = [
  {
    id: "anthropic",
    create: () => createAnthropicProvider({ apiKey: "test-key", modelId: "claude-test" }),
    successBody: (text) => ({ content: [{ type: "text", text }] }),
    expectUrl: "https://api.anthropic.com/v1/messages",
    expectHeaders: { "x-api-key": "test-key", "anthropic-version": "2023-06-01" },
    expectRequestBody: (request) => ({
      model: "claude-test",
      max_tokens: 4096,
      system: request.system,
      messages: [{ role: "user", content: request.prompt }],
    }),
  },
  {
    id: "openai",
    create: () => createOpenAiProvider({ apiKey: "test-key", modelId: "gpt-test" }),
    successBody: (text) => ({ choices: [{ message: { content: text } }] }),
    expectUrl: "https://api.openai.com/v1/chat/completions",
    expectHeaders: { authorization: "Bearer test-key" },
    expectRequestBody: (request) => ({
      model: "gpt-test",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.prompt },
      ],
    }),
  },
  {
    id: "gemini",
    create: () => createGeminiProvider({ apiKey: "test-key", modelId: "gemini-test" }),
    successBody: (text) => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    expectUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent",
    expectHeaders: { "x-goog-api-key": "test-key" },
    expectRequestBody: (request) => ({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: "user", parts: [{ text: request.prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  },
  {
    id: "local-openai",
    create: () =>
      createLocalOpenAiProvider({
        baseUrl: "http://localhost:11434/v1/",
        modelId: "llama-test",
      }),
    successBody: (text) => ({ choices: [{ message: { content: text } }] }),
    expectUrl: "http://localhost:11434/v1/chat/completions",
    expectHeaders: {},
    expectRequestBody: (request) => ({
      model: "llama-test",
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.prompt },
      ],
    }),
  },
];

describe("HTTP provider contract suite", () => {
  for (const testCase of CASES) {
    describe(`provider: ${testCase.id}`, () => {
      it("sends the expected endpoint, headers, and body; returns provenance-tagged text", async () => {
        const calls = stubFetch(
          () =>
            new Response(JSON.stringify(testCase.successBody("PROCESSED")), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
        );
        const result = await testCase.create().complete(REQUEST);

        expect(result.text).toBe("PROCESSED");
        expect(result.providerId).toBe(testCase.id);
        expect(result.modelId).toMatch(/test$/u);
        expect(result.promptHash).toBe(hashPrompt(REQUEST));

        expect(calls).toHaveLength(1);
        expect(calls[0]?.url).toBe(testCase.expectUrl);
        expect(calls[0]?.init.method).toBe("POST");
        const sentHeaders = new Headers(calls[0]?.init.headers);
        for (const [name, value] of Object.entries(testCase.expectHeaders)) {
          expect(sentHeaders.get(name)).toBe(value);
        }
        expect(calls[0]?.init.body).toBeDefined();
        expect(JSON.parse(String(calls[0]?.init.body))).toEqual(
          testCase.expectRequestBody(REQUEST),
        );
      });

      it("maps HTTP error responses to AiProviderError with the status", async () => {
        stubFetch(
          () =>
            new Response(JSON.stringify({ error: "nope" }), {
              status: 401,
              headers: { "content-type": "application/json" },
            }),
        );
        await expect(testCase.create().complete(REQUEST)).rejects.toThrow(AiProviderError);
        await expect(testCase.create().complete(REQUEST)).rejects.toThrow(/401/u);
      });

      it("rejects empty completions with AiProviderError", async () => {
        stubFetch(
          () =>
            new Response(JSON.stringify(testCase.successBody("")), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
        );
        await expect(testCase.create().complete(REQUEST)).rejects.toThrow(AiProviderError);
      });
    });
  }

  it("local provider sends no authorization header when no key is given", async () => {
    const calls = stubFetch(
      () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await createLocalOpenAiProvider({
      baseUrl: "http://localhost:1234/v1",
      modelId: "m",
    }).complete(REQUEST);
    const sentHeaders = new Headers(calls[0]?.init.headers);
    expect(sentHeaders.get("authorization")).toBeNull();
  });

  it("local provider rejects non-http base URLs before any network call", async () => {
    expect(() => createLocalOpenAiProvider({ baseUrl: "ftp://example.com", modelId: "m" })).toThrow(
      AiProviderError,
    );
  });
});
