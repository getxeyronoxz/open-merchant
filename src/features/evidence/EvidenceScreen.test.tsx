import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EvidenceScreen } from "./EvidenceScreen";
import type { EvidenceSource } from "../../types";

const existingSource: EvidenceSource = {
  schemaVersion: 1,
  id: "S-001",
  url: "https://example.com/existing",
  title: "Existing source",
  notes: "",
  observations: [],
  observedAt: "2026-08-11T12:00:00Z",
  createdAt: "2026-08-11T12:00:00Z",
  updatedAt: "2026-08-11T12:00:00Z",
};

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

  it("keeps edits made while a source save is pending", async () => {
    const user = userEvent.setup();
    let finishSave!: () => void;
    const saveEvidence = vi.fn().mockReturnValue(new Promise<void>((resolve) => { finishSave = resolve; }));
    render(<EvidenceScreen evidence={[]} onSave={saveEvidence} />);

    await user.click(screen.getByRole("button", { name: "Add source" }));
    await user.type(screen.getByLabelText("Source URL"), "https://example.com/keyboard");
    await user.type(screen.getByLabelText("Source title"), "Submitted title");
    await user.click(screen.getByRole("button", { name: "Save source" }));
    await user.clear(screen.getByLabelText("Source title"));
    await user.type(screen.getByLabelText("Source title"), "Newer unsaved title");
    await act(async () => finishSave());

    await waitFor(() => expect(screen.getByRole("button", { name: "Save source" })).not.toBeDisabled());
    expect(screen.getByLabelText("Source title")).toHaveValue("Newer unsaved title");
  });

  it("prevents an editor save while a source removal is pending", async () => {
    const user = userEvent.setup();
    let finishRemoval!: () => void;
    const saveEvidence = vi.fn().mockReturnValue(new Promise<void>((resolve) => { finishRemoval = resolve; }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<EvidenceScreen evidence={[existingSource]} onSave={saveEvidence} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Source title"));
    await user.type(screen.getByLabelText("Source title"), "Unsaved source edit");
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("button", { name: "Save source" })).toBeDisabled();
    expect(saveEvidence).toHaveBeenCalledTimes(1);
    await act(async () => finishRemoval());
    expect(screen.getByRole("status")).toHaveTextContent("Source removed · editor changes not saved");
    expect(screen.getByLabelText("Source title")).toHaveValue("Unsaved source edit");
    confirm.mockRestore();
  });
});
