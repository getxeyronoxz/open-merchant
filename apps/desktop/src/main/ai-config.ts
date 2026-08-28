import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { LlmProvider } from "@open-merchant/ai";
import {
  createAnthropicProvider,
  createGeminiProvider,
  createLocalOpenAiProvider,
  createOpenAiProvider,
} from "@open-merchant/ai";
import type { ProviderId } from "@open-merchant/shared";
import { AppError, providerIdSchema } from "@open-merchant/shared";
import { z } from "zod";

/**
 * BYO-key configuration. API keys are encrypted with the OS-backed Electron
 * safeStorage before touching disk and are never returned over IPC — the
 * renderer only ever learns whether a key exists. Local endpoints (Ollama,
 * LM Studio) need no key at all, only a base URL. Nothing AI-related is
 * ever written into project folders.
 */

const PROVIDER_IDS = providerIdSchema.options;

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
  "local-openai": "llama3.1",
};

const DEFAULT_BASE_URLS: Record<string, string> = {
  "local-openai": "http://localhost:11434/v1",
};

const providerEntrySchema = z
  .object({
    model: z.string().optional(),
    keyEncrypted: z.string().optional(),
    baseUrl: z.string().optional(),
  })
  .partial()
  .default({});

const storedSchema = z.object({
  activeProvider: providerIdSchema.nullable().default(null),
  providers: z.record(z.string(), providerEntrySchema).default({}),
});

type Stored = z.infer<typeof storedSchema>;

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export interface PublicAiConfig {
  readonly activeProvider: string | null;
  readonly models: Record<string, string>;
  readonly hasKeys: Record<string, boolean>;
  readonly baseUrls: Record<string, string>;
  readonly encryptionAvailable: boolean;
}

export class AiConfigStore {
  private readonly filePath: string;

  constructor(
    userDataDirectory: string,
    private readonly safeStorage: SafeStorageLike,
  ) {
    this.filePath = join(userDataDirectory, "ai-config.json");
  }

  private async readStored(): Promise<Stored> {
    try {
      return storedSchema.parse(JSON.parse(await readFile(this.filePath, "utf8")));
    } catch {
      return storedSchema.parse({});
    }
  }

  private async writeStored(stored: Stored): Promise<void> {
    await writeFile(this.filePath, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
  }

  async publicConfig(): Promise<PublicAiConfig> {
    const stored = await this.readStored();
    const models: Record<string, string> = {};
    const hasKeys: Record<string, boolean> = {};
    const baseUrls: Record<string, string> = {};
    for (const id of PROVIDER_IDS) {
      const entry = stored.providers[id];
      models[id] = entry?.model ?? DEFAULT_MODELS[id] ?? "";
      hasKeys[id] = Boolean(entry?.keyEncrypted);
      baseUrls[id] = entry?.baseUrl ?? DEFAULT_BASE_URLS[id] ?? "";
    }
    return {
      activeProvider: stored.activeProvider,
      models,
      hasKeys,
      baseUrls,
      encryptionAvailable: this.safeStorage.isEncryptionAvailable(),
    };
  }

  async save(input: {
    providerId: ProviderId;
    modelId: string;
    apiKey: string | null;
    baseUrl?: string | null;
  }): Promise<void> {
    const stored = await this.readStored();
    const entry = stored.providers[input.providerId] ?? {};
    entry.model = input.modelId.trim() || DEFAULT_MODELS[input.providerId] || "";

    if (input.providerId === "local-openai") {
      entry.baseUrl = input.baseUrl?.trim() || DEFAULT_BASE_URLS["local-openai"];
    } else if (input.baseUrl) {
      entry.baseUrl = input.baseUrl.trim();
    }

    if (input.apiKey !== null) {
      if (!this.safeStorage.isEncryptionAvailable()) {
        throw new AppError({
          code: "ai-not-configured",
          message: "This system cannot securely store API keys, so none was saved.",
        });
      }
      entry.keyEncrypted = this.safeStorage.encryptString(input.apiKey).toString("base64");
    }

    stored.providers[input.providerId] = entry;
    stored.activeProvider = input.providerId;
    await this.writeStored(stored);
  }

  /** Builds a live provider for the given id; throws coded errors if unusable. */
  async getProvider(providerId: ProviderId): Promise<LlmProvider> {
    const stored = await this.readStored();
    const entry = stored.providers[providerId];
    const modelId = entry?.model ?? DEFAULT_MODELS[providerId] ?? "";

    if (providerId === "local-openai") {
      return createLocalOpenAiProvider({
        baseUrl: entry?.baseUrl ?? DEFAULT_BASE_URLS["local-openai"] ?? "",
        modelId,
        apiKey: entry?.keyEncrypted
          ? this.safeStorage.decryptString(Buffer.from(entry.keyEncrypted, "base64"))
          : undefined,
      });
    }

    const apiKey = entry?.keyEncrypted
      ? this.safeStorage.decryptString(Buffer.from(entry.keyEncrypted, "base64"))
      : undefined;
    if (!apiKey) {
      throw new AppError({
        code: "ai-not-configured",
        message: `No API key saved for ${providerId}. Add one in AI settings.`,
      });
    }

    switch (providerId) {
      case "anthropic":
        return createAnthropicProvider({ apiKey, modelId });
      case "openai":
        return createOpenAiProvider({ apiKey, modelId });
      case "gemini":
        return createGeminiProvider({ apiKey, modelId });
    }
  }

  async getActiveProvider(): Promise<LlmProvider> {
    const stored = await this.readStored();
    if (!stored.activeProvider) {
      throw new AppError({
        code: "ai-not-configured",
        message: "Choose an AI provider in settings before using the assistant.",
      });
    }
    return this.getProvider(stored.activeProvider);
  }
}
