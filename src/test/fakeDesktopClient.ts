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
    listRecentProjects: vi.fn<DesktopClient["listRecentProjects"]>().mockResolvedValue([]),
    removeRecentProject: vi.fn<DesktopClient["removeRecentProject"]>(),
  };
}
