import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CompetitorsScreen } from "./CompetitorsScreen";

describe("CompetitorsScreen", () => {
  it("adds and persists a priced competitor", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(<CompetitorsScreen currency="INR" competitors={[]} evidence={[]} onSave={save} />);
    await user.click(screen.getByRole("button", { name: "Add competitor" }));
    await user.type(screen.getByLabelText("Product"), "Keychron K2");
    await user.type(screen.getByLabelText("Brand"), "Keychron");
    await user.type(screen.getByLabelText("Price"), "7499");
    await user.click(screen.getByRole("button", { name: "Save competitor" }));
    expect(save).toHaveBeenCalledWith([expect.objectContaining({ id: "C-001", price: "7499.00", currency: "INR" })]);
  });
});
