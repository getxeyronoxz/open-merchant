import { describe, expect, it } from "vitest";

import { createMockProvider, hashPrompt } from "../src/providers";

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
