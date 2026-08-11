import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReportScreen } from "./ReportScreen";
import type { ReportSections } from "../../types";

const emptySections: ReportSections = {
  schemaVersion: 1,
  decisionSummary: "",
  marketObservations: [],
  risks: [],
  opportunities: [],
};

describe("ReportScreen", () => {
  it("saves explicit report notes before generating Markdown", async () => {
    const user = userEvent.setup();
    const saveSections = vi.fn().mockResolvedValue(undefined);
    render(
      <ReportScreen
        onGenerate={vi.fn().mockResolvedValue("# Report")}
        onSaveSections={saveSections}
        sections={emptySections}
      />,
    );

    await user.type(screen.getByLabelText("Decision summary"), "Validate supplier quotes next.");
    await user.type(screen.getByLabelText("Market observations"), "Prices cluster around INR 4,000.");
    await user.type(screen.getByLabelText("Risks"), "Evidence sample is small.");
    await user.type(screen.getByLabelText("Opportunities"), "Target enthusiasts.");
    await user.click(screen.getByRole("button", { name: "Save report notes" }));

    expect(saveSections).toHaveBeenCalledWith({
      schemaVersion: 1,
      decisionSummary: "Validate supplier quotes next.",
      marketObservations: ["Prices cluster around INR 4,000."],
      risks: ["Evidence sample is small."],
      opportunities: ["Target enthusiasts."],
    });
    expect(screen.getByRole("status", { name: "Report notes status" })).toHaveTextContent("Report notes saved");
  });

  it("keeps save and generation actions independent while they run", async () => {
    const user = userEvent.setup();
    let finishSave!: () => void;
    let finishGenerate!: (markdown: string) => void;
    const saveSections = vi.fn().mockReturnValue(new Promise<void>((resolve) => { finishSave = resolve; }));
    const generate = vi.fn().mockReturnValue(new Promise<string>((resolve) => { finishGenerate = resolve; }));
    render(<ReportScreen onGenerate={generate} onSaveSections={saveSections} sections={emptySections} />);

    await user.type(screen.getByLabelText("Decision summary"), "Keep this report draft.");
    await user.click(screen.getByRole("button", { name: "Save report notes" }));
    expect(screen.getByRole("button", { name: "Saving report notes…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generate Markdown report" })).not.toBeDisabled();
    expect(screen.getByRole("status", { name: "Report notes status" })).toHaveTextContent("Saving report notes");
    await user.click(screen.getByRole("button", { name: "Generate Markdown report" }));
    expect(screen.getByRole("button", { name: "Generating report…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving report notes…" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Report generation status" })).toHaveTextContent("Generating report");
    expect(generate).not.toHaveBeenCalled();
    await act(async () => finishSave());
    expect(await screen.findByRole("status", { name: "Report notes status" })).toHaveTextContent("Report notes saved");
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    await act(async () => finishGenerate("# Opportunity report"));
    expect(await screen.findByRole("heading", { name: "Opportunity report" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Report generation status" })).toHaveTextContent("Report generated");
  });

  it("keeps edits made while report notes are saving", async () => {
    const user = userEvent.setup();
    let finishSave!: () => void;
    const saveSections = vi.fn().mockReturnValue(new Promise<void>((resolve) => { finishSave = resolve; }));
    render(<ReportScreen onGenerate={vi.fn()} onSaveSections={saveSections} sections={emptySections} />);

    await user.type(screen.getByLabelText("Decision summary"), "Submitted summary");
    await user.click(screen.getByRole("button", { name: "Save report notes" }));
    await user.clear(screen.getByLabelText("Decision summary"));
    await user.type(screen.getByLabelText("Decision summary"), "Newer unsaved summary");
    await act(async () => finishSave());

    await waitFor(() => expect(screen.getByRole("button", { name: "Save report notes" })).not.toBeDisabled());
    expect(screen.getByLabelText("Decision summary")).toHaveValue("Newer unsaved summary");
    expect(screen.getByRole("status", { name: "Report notes status" })).toBeEmptyDOMElement();
  });

  it("preserves the report draft after generation fails", async () => {
    const user = userEvent.setup();
    render(
      <ReportScreen
        onGenerate={vi.fn().mockRejectedValue(new Error("Report generation was interrupted."))}
        onSaveSections={vi.fn()}
        sections={emptySections}
      />,
    );

    await user.type(screen.getByLabelText("Decision summary"), "Do not lose this draft.");
    await user.click(screen.getByRole("button", { name: "Generate Markdown report" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Report generation was interrupted.");
    expect(screen.getByLabelText("Decision summary")).toHaveValue("Do not lose this draft.");
    expect(screen.getByRole("status", { name: "Report generation status" })).toHaveTextContent("Generation failed");
  });
});
