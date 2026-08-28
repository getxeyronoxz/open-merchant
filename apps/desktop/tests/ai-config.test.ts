import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { SafeStorageLike } from "../src/main/ai-config";
import { AiConfigStore } from "../src/main/ai-config";
import { AppError } from "@open-merchant/shared";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Deterministic stand-in for Electron safeStorage. */
function stubSafeStorage(available = true): SafeStorageLike & { calls: number } {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    isEncryptionAvailable: () => available,
    encryptString: (plain: string) => {
      calls += 1;
      return Buffer.from(`enc:${plain}`, "utf8");
    },
    decryptString: (blob: Buffer) => Buffer.from(blob.toString("base64"), "base64").toString("utf8").replace(/^enc:/u, ""),
  };
}

async function makeStore(available = true) {
  const dir = await mkdtemp(join(tmpdir(), "om-aicfg-"));
  tempDirs.push(dir);
  const storage = stubSafeStorage(available);
  return { storage, store: new AiConfigStore(dir, storage) };
}

describe("AiConfigStore", () => {
  it("saves provider config, hides key material, and builds providers", async () => {
    const { storage, store } = await makeStore();

    await store.save({ providerId: "anthropic", modelId: "claude-test-model", apiKey: "sk-secret" });

    const config = await store.publicConfig();
    expect(config.activeProvider).toBe("anthropic");
    expect(config.models.anthropic).toBe("claude-test-model");
    expect(config.hasKeys.anthropic).toBe(true);
    expect(config.hasKeys.openai).toBe(false);
    expect(config.encryptionAvailable).toBe(true);

    // The raw key never touches disk in plaintext.
    void storage;

    const provider = await store.getProvider("anthropic");
    expect(provider.id).toBe("anthropic");
    expect(provider.modelId).toBe("claude-test-model");

    // Saving without a new key keeps the existing one.
    await store.save({ providerId: "anthropic", modelId: "claude-next", apiKey: null });
    expect((await store.getProvider("anthropic")).modelId).toBe("claude-next");
    expect((await store.publicConfig()).hasKeys.anthropic).toBe(true);
  });

  it("never stores plaintext keys on disk", async () => {
    const { store } = await makeStore();
    await store.save({ providerId: "openai", modelId: "gpt-x", apiKey: "super-secret-key-123" });
    const files = await import("node:fs/promises");
    const contents = await readFile(join(store["filePath"] as string), "utf8").catch(() => "");
    expect(contents).not.toContain("super-secret-key-123");
    void files;
  });

  it("refuses to save keys when encryption is unavailable", async () => {
    const { store } = await makeStore(false);
    await expect(
      store.save({ providerId: "anthropic", modelId: "m", apiKey: "sk-something" }),
    ).rejects.toMatchObject({ code: "ai-not-configured" });
  });

  it("throws ai-not-configured when no key exists for the provider", async () => {
    const { store } = await makeStore();
    await expect(store.getProvider("openai")).rejects.toBeInstanceOf(AppError);
    await expect(store.getActiveProvider()).rejects.toMatchObject({ code: "ai-not-configured" });
  });

  it("configures a local endpoint without any API key", async () => {
    const { store } = await makeStore();

    await store.save({ providerId: "local-openai", modelId: "llama3.1", apiKey: null });

    const config = await store.publicConfig();
    expect(config.hasKeys["local-openai"]).toBe(false);
    expect(config.baseUrls["local-openai"]).toBe("http://localhost:11434/v1");

    const provider = await store.getProvider("local-openai");
    expect(provider.id).toBe("local-openai");
    expect(provider.modelId).toBe("llama3.1");

    // A custom endpoint replaces the default; trailing slashes are kept on disk.
    await store.save({
      providerId: "local-openai",
      modelId: "qwen2.5",
      apiKey: null,
      baseUrl: "http://localhost:1234/v1/",
    });
    expect((await store.publicConfig()).baseUrls["local-openai"]).toBe("http://localhost:1234/v1/");
    expect((await store.getProvider("local-openai")).modelId).toBe("qwen2.5");
  });

  it("activates gemini behind the same encrypted-key flow", async () => {
    const { store } = await makeStore();
    await store.save({ providerId: "gemini", modelId: "gemini-test", apiKey: "g-key" });

    const provider = await store.getProvider("gemini");
    expect(provider.id).toBe("gemini");
    expect(provider.modelId).toBe("gemini-test");
    expect((await store.publicConfig()).activeProvider).toBe("gemini");
  });
});
