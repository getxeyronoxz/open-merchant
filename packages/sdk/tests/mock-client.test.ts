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

  it("saves and reloads the full workspace loop in memory", async () => {
    const mock = createMockDesktopClient();
    const created = await mock.createProject({
      parentDirectory: "C:/research",
      name: "Keyboards",
      objective: "Decide market entry",
      currency: "INR",
    });
    const root = created.snapshot.root;

    await mock.saveEvidence(root, [
      {
        id: "S-001",
        url: "https://example.com/listing",
        title: "Marketplace listing",
        notes: "",
        observations: [],
        observedAt: "2026-09-05T08:00:00.000Z",
        createdAt: "2026-09-05T08:00:00.000Z",
        updatedAt: "2026-09-05T08:00:00.000Z",
      },
    ]);
    expect((await mock.loadEvidence(root)).sources).toHaveLength(1);

    await mock.saveCompetitors(root, [
      {
        id: "C-001",
        product: "Keyboard",
        brand: "Brand",
        price: "549.25",
        currency: "INR",
        marketplace: "Example Bazaar",
        url: "https://example.com",
        sourceId: null,
        notes: "",
        observedAt: "2026-09-05T08:00:00.000Z",
      },
    ]);
    const competitors = await mock.loadCompetitors(root);
    expect(competitors.competitors).toHaveLength(1);
    const stats = await mock.competitorStatistics(root);
    expect(stats.statistics.validPriceCount).toBe(1);

    await mock.saveAssumptions(root, {
      currency: "INR",
      acquisitionCost: "500.00",
      shippingCost: "75.50",
      marketplaceFeeRate: "0.00",
      paymentFeeRate: "0.00",
      otherCosts: "20.00",
      scenarioPrices: { low: "899.99", base: "1099.99", high: "1499.99" },
    });
    expect((await mock.loadAssumptions(root)).assumptions.acquisitionCost).toBe("500.00");
    const scenarios = await mock.calculateScenarios(root);
    expect(scenarios.scenarios.map((entry) => entry.scenario)).toEqual(["low", "base", "high"]);

    await mock.saveReportSections(root, {
      decisionSummary: "Enter with a limited batch.",
      marketObservations: ["Demand clusters."],
      risks: ["Duties."],
      opportunities: ["Bundles."],
    });
    expect((await mock.loadReportSections(root)).sections.decisionSummary).toContain("limited");
    const report = await mock.generateReport(root);
    expect(report.markdown).toContain("# Keyboards");
    expect((await mock.loadGeneratedReport(root)).markdown).toContain("# Keyboards");
  });

  it("captures snapshots and reports monitor, journal, and portfolio state", async () => {
    const mock = createMockDesktopClient();
    const created = await mock.createProject({
      parentDirectory: "C:/research",
      name: "Keyboards",
      objective: "Decide market entry",
      currency: "INR",
    });
    const root = created.snapshot.root;
    await mock.saveCompetitors(root, [
      {
        id: "C-001",
        product: "Keyboard",
        brand: "Brand",
        price: "749.00",
        currency: "INR",
        marketplace: "Example Bazaar",
        url: "https://example.com",
        sourceId: null,
        notes: "",
        observedAt: "2026-09-05T08:00:00.000Z",
      },
    ]);
    await mock.saveAssumptions(root, {
      currency: "INR",
      acquisitionCost: "500.00",
      shippingCost: "75.50",
      marketplaceFeeRate: "0.00",
      paymentFeeRate: "0.00",
      otherCosts: "20.00",
      scenarioPrices: { low: "899.99", base: "1099.99", high: "1499.99" },
      marginThresholdPercent: "20.00",
    });
    const captured = await mock.captureMarketSnapshot(root, "weekly");
    expect(captured.snapshot.listingCount).toBe(1);
    expect((await mock.listMarketSnapshots(root)).snapshots).toHaveLength(1);
    expect((await mock.listingPriceHistory(root)).history.length).toBeGreaterThan(0);
    // The mock only flags margins once scenarios exist — calculate first,
    // mirroring the real workspace order (assumptions → scenarios → monitor).
    await mock.calculateScenarios(root);
    const monitor = await mock.marginMonitor(root);
    expect(monitor.monitor.flags.length).toBeGreaterThan(0);
    const journal = await mock.decisionJournal(root);
    expect(journal.journal.staleAfterDays).toBe(30);
    const portfolio = await mock.portfolioOverview();
    expect(portfolio.projects.length).toBeGreaterThan(0);
    const artifacts = await mock.listArtifacts(root);
    expect(artifacts.artifacts.length).toBeGreaterThan(0);
    const runs = await mock.listRuns(root);
    expect(Array.isArray(runs.runs)).toBe(true);
    const provenance = await mock.listProvenance(root);
    expect(Array.isArray(provenance.provenance)).toBe(true);
  });

  it("exports and imports CSV with row-level reporting", async () => {
    const mock = createMockDesktopClient();
    const created = await mock.createProject({
      parentDirectory: "C:/research",
      name: "Keyboards",
      objective: "Decide market entry",
      currency: "INR",
    });
    const root = created.snapshot.root;
    const exported = await mock.exportCsv(root, "competitors");
    expect(exported.csv).toContain("product");
    const parsed = await mock.parseCsv("product,price\nKeyboard,499.00\n,10.00\n");
    expect(parsed.rowCount).toBe(2);
    const imported = await mock.importCompetitorsCsv(root, "product,price\nKeyboard,499.00\n,10.00\n");
    expect(imported.imported).toBe(1);
    expect(imported.skipped).toBe(1);
    expect(imported.errors[0]?.row).toBe(3);
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

  it("exposes the update surface as a no-op in the mock", async () => {
    const mock = createMockDesktopClient();
    await expect(mock.installUpdate()).resolves.toEqual({ quitting: false });
  });

  it("lists a disabled sample report-section plugin by default", async () => {
    const mock = createMockDesktopClient();

    const catalog = await mock.listPlugins();

    expect(catalog.broken).toEqual([]);
    expect(catalog.plugins).toHaveLength(1);
    expect(catalog.plugins[0]?.manifest.kind).toBe("report-section");
    expect(catalog.plugins[0]?.enabled).toBe(false);
  });

  it("returns a plugin's source and toggles its enabled state", async () => {
    const mock = createMockDesktopClient();
    const catalog = await mock.listPlugins();
    const pluginId = catalog.plugins[0]?.manifest.id ?? "";

    const source = await mock.readPluginSource(pluginId);
    expect(source.source).toContain("MOQ");

    const enabled = await mock.setPluginEnabled(pluginId, true);
    expect(enabled.plugin.enabled).toBe(true);

    const reloaded = await mock.listPlugins();
    expect(reloaded.plugins[0]?.enabled).toBe(true);
  });

  it("refuses to read the source of an unknown plugin", async () => {
    const mock = createMockDesktopClient();
    await expect(mock.readPluginSource("nope")).rejects.toThrow(/nope/);
  });
});

describe("mock connector fetch", () => {
  it("returns connector drafts and writes nothing to the project", async () => {
    const mock = createMockDesktopClient();
    const created = await mock.createProject({
      name: "P",
      objective: "O",
      currency: "INR",
      parentDirectory: "C:/research",
    });
    const root = created.snapshot.root;

    const result = await mock.fetchFromConnector(root, "sample-market", "keyboard");

    expect(result.drafts.length).toBeGreaterThan(0);
    expect(result.drafts[0]?.origin.kind).toBe("connector");
    expect((await mock.loadEvidence(root)).sources).toEqual([]);
    expect((await mock.loadCompetitors(root)).competitors).toEqual([]);
  });

  it("stamps each draft origin with the connector id and a response hash", async () => {
    const mock = createMockDesktopClient();
    const created = await mock.createProject({
      name: "P",
      objective: "O",
      currency: "INR",
      parentDirectory: "C:/research",
    });

    const result = await mock.fetchFromConnector(created.snapshot.root, "sample-market", "keyboard");

    for (const draft of result.drafts) {
      expect(draft.origin).toMatchObject({ kind: "connector", connectorId: "sample-market" });
      if (draft.origin.kind === "connector") {
        expect(draft.origin.rawResponseHash).toMatch(/^[0-9a-f]{64}$/u);
      }
    }
  });
});

describe("createMockDesktopClient currency change", () => {
  async function project() {
    const mock = createMockDesktopClient();
    const created = await mock.createProject({
      parentDirectory: "C:/research",
      name: "Keyboards",
      objective: "Decide market entry",
      currency: "INR",
    });
    return { mock, root: created.snapshot.root };
  }

  it("previews a change without moving the project", async () => {
    const { mock, root } = await project();
    await mock.saveCompetitors(root, [
      {
        id: "C-001",
        product: "Keyboard",
        brand: "Brand",
        price: "549.25",
        currency: "INR",
        marketplace: "Example Bazaar",
        url: "https://example.com",
        sourceId: null,
        notes: "",
        observedAt: "2026-09-05T08:00:00.000Z",
      },
    ]);

    const preview = await mock.currencyPreview(root, "EUR", "0.011");

    expect(preview.fromCurrency).toBe("INR");
    expect(preview.toCurrency).toBe("EUR");
    expect(preview.rate).toBe("0.011");
    // Nothing has moved yet, and the mock must not pretend otherwise.
    expect((await mock.loadCompetitors(root)).competitors[0]?.currency).toBe("INR");
    expect((await mock.openProject({ root })).snapshot.manifest.currency).toBe("INR");
  });

  it("moves the project to the new currency when applied", async () => {
    const { mock, root } = await project();

    const applied = await mock.applyCurrencyChange(root, "EUR", "0.011");

    expect(applied.change.fromCurrency).toBe("INR");
    expect(applied.change.toCurrency).toBe("EUR");
    expect(applied.change.rate).toBe("0.011");
    expect(applied.changedCount).toBe(0);
    expect((await mock.openProject({ root })).snapshot.manifest.currency).toBe("EUR");
  });

  it("refuses a change into the currency the project is already in", async () => {
    const { mock, root } = await project();

    await expect(mock.applyCurrencyChange(root, "INR", "1")).rejects.toBeInstanceOf(AppError);
    expect((await mock.openProject({ root })).snapshot.manifest.currency).toBe("INR");
  });

  it("refuses a rate that is not a positive decimal", async () => {
    const { mock, root } = await project();

    for (const rate of ["0", "0.00", "-1", "abc"]) {
      await expect(mock.applyCurrencyChange(root, "EUR", rate)).rejects.toBeInstanceOf(AppError);
    }
    expect((await mock.openProject({ root })).snapshot.manifest.currency).toBe("INR");
  });
});
