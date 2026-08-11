import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ArtifactsScreen } from "./ArtifactsScreen";
import { createFakeDesktopClient } from "../../test/fakeDesktopClient";

describe("ArtifactsScreen", () => {
  it("selects a known artifact and shows its text", async () => {
    const user = userEvent.setup();
    const client = createFakeDesktopClient();
    client.listArtifacts.mockResolvedValue([{ relativePath: "reports/opportunity-report.md", kind: "markdown", generated: true, exists: true }]);
    client.readArtifact.mockResolvedValue("# Mechanical Keyboards India");
    render(<ArtifactsScreen client={client} projectRoot="C:/Research/keyboards" />);
    await user.click(await screen.findByText("opportunity-report.md"));
    expect(await screen.findByText("# Mechanical Keyboards India")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /opportunity-report.md/ })).toHaveAttribute("aria-current", "true");
  });

  it("shows a report-generation run in History", async () => {
    const user = userEvent.setup();
    const client = createFakeDesktopClient();
    client.listRuns.mockResolvedValue([{ schemaVersion: 1, runId: "RUN-001", operation: "reportGenerated", startedAt: "2026-08-08T12:00:00Z", completedAt: "2026-08-08T12:00:01Z", status: "succeeded", appVersion: "0.1.0", inputArtifacts: [], outputArtifacts: [{ path: "reports/opportunity-report.md", sha256: "a".repeat(64) }], sourceIds: [], errorSummary: null }]);
    render(<ArtifactsScreen client={client} projectRoot="C:/Research/keyboards" />);
    await user.click(screen.getByRole("tab", { name: "History" }));
    expect(await screen.findByText("Report generated")).toBeInTheDocument();
    expect(screen.getByText("opportunity-report.md")).toBeInTheDocument();
  });

  it("shows a recovery message for an interrupted report run", async () => {
    const user = userEvent.setup();
    const client = createFakeDesktopClient();
    client.listRuns.mockResolvedValue([{
      schemaVersion: 1,
      runId: "RUN-002",
      operation: "reportGenerated",
      startedAt: "2026-08-09T12:00:00Z",
      completedAt: "2026-08-09T12:00:00Z",
      status: "failed",
      appVersion: "0.1.0",
      inputArtifacts: [],
      outputArtifacts: [],
      sourceIds: [],
      errorSummary: "Previous report generation was interrupted before completion. Review the workspace artifacts, then generate the report again.",
    }]);
    render(<ArtifactsScreen client={client} projectRoot="C:/Research/keyboards" />);
    await user.click(screen.getByRole("tab", { name: "History" }));
    expect(await screen.findByText("Report interrupted")).toBeInTheDocument();
    expect(screen.getByText(/Previous report generation was interrupted/)).toBeInTheDocument();
  });

  it("announces artifact loading and exposes the selected tab and file", async () => {
    const user = userEvent.setup();
    const client = createFakeDesktopClient();
    let finishRead!: (content: string) => void;
    client.listArtifacts.mockResolvedValue([{ relativePath: "reports/opportunity-report.md", kind: "markdown", generated: true, exists: true }]);
    client.readArtifact.mockReturnValue(new Promise((resolve) => { finishRead = resolve; }));
    render(<ArtifactsScreen client={client} projectRoot="C:/Research/keyboards" />);

    expect(await screen.findByRole("tab", { name: "Artifacts" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: /opportunity-report.md/ }));
    expect(screen.getByRole("status", { name: "Artifact status" })).toHaveTextContent("Loading artifact");
    expect(screen.getByRole("button", { name: /opportunity-report.md/ })).toHaveAttribute("aria-current", "true");
    finishRead("# Loaded report");
    expect(await screen.findByText("# Loaded report")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("No run history yet")).toBeInTheDocument();
  });
});
