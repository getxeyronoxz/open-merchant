import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EvidenceScreen } from "./EvidenceScreen";

describe("EvidenceScreen", () => {
  it("adds an evidence record and persists it", async () => {
    const user = userEvent.setup();
    const saveEvidence = vi.fn().mockResolvedValue(undefined);
    render(<EvidenceScreen evidence={[]} onSave={saveEvidence} />);

    await user.click(screen.getByRole("button", { name: "Add source" }));
    await user.type(screen.getByLabelText("Source URL"), "https://example.com/keyboard");
    await user.type(screen.getByLabelText("Source title"), "Keyboard listing");
    await user.click(screen.getByRole("button", { name: "Save source" }));

    expect(saveEvidence).toHaveBeenCalledWith([
      expect.objectContaining({ id: "S-001", title: "Keyboard listing" }),
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("Source saved");
  });

  it("opens the existing editor from the empty state", async () => {
    const user = userEvent.setup();
    render(<EvidenceScreen evidence={[]} onSave={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add first source" }));
    expect(screen.getByLabelText("Source URL")).toBeInTheDocument();
  });

  it("announces save progress and preserves the source draft after failure", async () => {
    const user = userEvent.setup();
    let rejectSave!: (reason: Error) => void;
    const saveEvidence = vi.fn().mockReturnValue(
      new Promise<void>((_, reject) => {
        rejectSave = reject;
      }),
    );
    render(<EvidenceScreen evidence={[]} onSave={saveEvidence} />);

    await user.click(screen.getByRole("button", { name: "Add source" }));
    await user.type(screen.getByLabelText("Source URL"), "https://example.com/keyboard");
    await user.type(screen.getByLabelText("Source title"), "Keep this draft");
    await user.click(screen.getByRole("button", { name: "Save source" }));

    expect(screen.getByRole("button", { name: "Saving source…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Saving source");
    rejectSave(new Error("Workspace is temporarily unavailable."));

    expect(await screen.findByRole("alert")).toHaveTextContent("Workspace is temporarily unavailable.");
    expect(screen.getByLabelText("Source title")).toHaveValue("Keep this draft");
    expect(screen.getByRole("button", { name: "Save source" })).not.toBeDisabled();
  });
});
