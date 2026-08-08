import { render, screen } from "@testing-library/react";
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
  });
});
