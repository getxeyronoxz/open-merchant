import { describe, expect, it } from "vitest";

import { AppError } from "@open-merchant/shared";

import { createMockDesktopClient } from "../src/mock";

describe("createMockDesktopClient", () => {
  it("creates, lists, and reopens a project through the typed client", async () => {
    const mock = createMockDesktopClient();
    const created = await mock.createProject({
      parentDirectory: "C:/research",
      name: "Keyboards",
      objective: "Decide market entry",
      currency: "INR",
    });
    expect(created.snapshot.manifest.currency).toBe("INR");

    const recents = await mock.listRecents();
    expect(recents.projects).toHaveLength(1);

    const reopened = await mock.openProject({ root: created.snapshot.root });
    expect(reopened.snapshot.manifest.name).toBe("Keyboards");
  });

  it("rejects unknown roots and duplicate names with coded errors", async () => {
    const mock = createMockDesktopClient();
    await expect(mock.openProject({ root: "C:/nowhere" })).rejects.toMatchObject({ code: "not-a-project" });

    await mock.createProject({
      parentDirectory: "C:/research",
      name: "Keyboards",
      objective: "x",
      currency: "INR",
    });
    const duplicate = mock.createProject({
      parentDirectory: "C:/research",
      name: "Keyboards",
      objective: "y",
      currency: "INR",
    });
    await expect(duplicate).rejects.toBeInstanceOf(AppError);
  });

  it("exposes app identity without touching Electron", async () => {
    const mock = createMockDesktopClient({ version: "9.9.9-test" });
    const info = await mock.appInfo();
    expect(info).toEqual({ appName: "Open Merchant", appVersion: "9.9.9-test", platform: "mock" });
  });

  it("keeps generation snapshots readable through history/read", async () => {
    const mock = createMockDesktopClient();
    const created = await mock.createProject({
      parentDirectory: "C:/research",
      name: "Keyboards",
      objective: "Decide market entry",
      currency: "INR",
    });
    const root = created.snapshot.root;

    await mock.saveAssumptions(root, {
      currency: "INR",
      acquisitionCost: "500.00",
      shippingCost: "75.50",
      marketplaceFeeRate: "12.50",
      paymentFeeRate: "2.35",
      otherCosts: "20.00",
      scenarioPrices: { low: "899.99", base: "1099.99", high: "1499.99" },
    });

    expect(await mock.readHistory(root, "scenarios", "RUN-mock-0001")).toEqual({ text: null });

    await mock.calculateScenarios(root);
    const scenarios = await mock.readHistory(root, "scenarios", "RUN-mock-0000");
    expect(scenarios.text).toContain('"scenario": "base"');

    await mock.generateReport(root);
    const report = await mock.readHistory(root, "report", "RUN-mock-0001");
    expect(report.text).toContain("# Keyboards");
  });
});
