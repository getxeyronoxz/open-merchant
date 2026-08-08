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
    listRecentProjects: vi.fn<DesktopClient["listRecentProjects"]>().mockResolvedValue([]),
    removeRecentProject: vi.fn<DesktopClient["removeRecentProject"]>(),
  };
}
