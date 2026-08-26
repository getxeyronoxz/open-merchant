import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { LlmProvider } from "@open-merchant/ai";
import { createAnthropicProvider, createOpenAiProvider } from "@open-merchant/ai";
import { AppError } from "@open-merchant/shared";
import { z } from "zod";

/**
 * BYO-key configuration. API keys are encrypted with the OS-backed Electron
 * safeStorage before touching disk and are never returned over IPC — the
 * renderer only ever learns whether a key exists. Nothing AI-related is
 * ever written into project folders.
 */

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4o",
};

const storedSchema = z.object({
  activeProvider: z.enum(["anthropic", "openai"]).nullable().default(null),
  providers: z
    .object({
      anthropic: z.object({ model: z.string(), keyEncrypted: z.string().optional() }).partial().default({}),
      openai: z.object({ model: z.string(), keyEncrypted: z.string().optional() }).partial().default({}),
    })
    .default({}),
});

type Stored = z.infer<typeof storedSchema>;

interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export interface PublicAiConfig {
  readonly activeProvider: string | null;
  readonly models: Record<string, string>;
  readonly hasKeys: Record<string, boolean>;
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
    for (const id of ["anthropic", "openai"] as const) {
      models[id] = stored.providers[id]?.model ?? DEFAULT_MODELS[id] ?? "";
      hasKeys[id] = Boolean(stored.providers[id]?.keyEncrypted);
    }
    return {
      activeProvider: stored.activeProvider,
      models,
      hasKeys,
      encryptionAvailable: this.safeStorage.isEncryptionAvailable(),
    };
  }

  async save(input: {
    providerId: "anthropic" | "openai";
    modelId: string;
    apiKey: string | null;
  }): Promise<void> {
    const stored = await this.readStored();
    const entry = stored.providers[input.providerId] ?? {};
    entry.model = input.modelId.trim() || DEFAULT_MODELS[input.providerId] || "";

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
  async getProvider(providerId: "anthropic" | "openai"): Promise<LlmProvider> {
    const stored = await this.readStored();
    const entry = stored.providers[providerId];
    const apiKey = entry?.keyEncrypted
      ? this.safeStorage.decryptString(Buffer.from(entry.keyEncrypted, "base64"))
      : undefined;
    if (!apiKey) {
      throw new AppError({
        code: "ai-not-configured",
        message: `No API key saved for ${providerId}. Add one in AI settings.`,
      });
    }
    const modelId = entry?.model ?? DEFAULT_MODELS[providerId] ?? "";
    return providerId === "anthropic"
      ? createAnthropicProvider({ apiKey, modelId })
      : createOpenAiProvider({ apiKey, modelId });
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
