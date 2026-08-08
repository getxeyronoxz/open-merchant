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

  it("shows deterministic price statistics from the backend result", () => {
    render(<CompetitorsScreen currency="INR" competitors={[]} evidence={[]} onSave={vi.fn()} statistics={{ validPriceCount: 3, minimum: "4999.00", maximum: "8999.00", average: "6999.00", median: "6999.00" }} />);
    expect(screen.getByText("₹4,999.00")).toBeInTheDocument();
    expect(screen.getByText("₹8,999.00")).toBeInTheDocument();
    expect(screen.getAllByText("₹6,999.00")).toHaveLength(2);
  });
});
