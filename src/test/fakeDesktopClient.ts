import { vi, type Mock } from "vitest";

import type { DesktopClient } from "../types";

type FakeDesktopClient = {
  [K in keyof DesktopClient]: Mock<DesktopClient[K]>;
};

export function createFakeDesktopClient(): FakeDesktopClient {
  return {
    chooseDirectory: vi.fn<DesktopClient["chooseDirectory"]>().mockResolvedValue(null),
    createProject: vi.fn<DesktopClient["createProject"]>(),
    openProject: vi.fn<DesktopClient["openProject"]>(),
    saveManifest: vi.fn<DesktopClient["saveManifest"]>(),
    loadEvidence: vi.fn<DesktopClient["loadEvidence"]>().mockResolvedValue([]),
    saveEvidence: vi.fn<DesktopClient["saveEvidence"]>(),
    loadCompetitors: vi.fn<DesktopClient["loadCompetitors"]>().mockResolvedValue([]),
    saveCompetitors: vi.fn<DesktopClient["saveCompetitors"]>(),
    competitorStatistics: vi.fn<DesktopClient["competitorStatistics"]>().mockResolvedValue({ validPriceCount: 0, minimum: null, maximum: null, average: null, median: null }),
    loadAssumptions: vi.fn<DesktopClient["loadAssumptions"]>().mockResolvedValue({ schemaVersion: 1, currency: "INR", acquisitionCost: "0.00", shippingCost: "0.00", marketplaceFeeRate: "0.00", paymentFeeRate: "0.00", otherCosts: "0.00", scenarioPrices: { low: null, base: null, high: null } }),
    saveAssumptions: vi.fn<DesktopClient["saveAssumptions"]>(),
    calculateAndSaveScenarios: vi.fn<DesktopClient["calculateAndSaveScenarios"]>().mockResolvedValue([]),
    generateReport: vi.fn<DesktopClient["generateReport"]>().mockResolvedValue(""),
    listRecentProjects: vi.fn<DesktopClient["listRecentProjects"]>().mockResolvedValue([]),
    removeRecentProject: vi.fn<DesktopClient["removeRecentProject"]>(),
  };
}
