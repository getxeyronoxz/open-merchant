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
  });
});
