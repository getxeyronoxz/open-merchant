import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EconomicsScreen } from "./EconomicsScreen";
import type { CostAssumptions } from "../../types";

const emptyAssumptions: CostAssumptions = { schemaVersion: 1, currency: "INR", acquisitionCost: "0.00", shippingCost: "0.00", marketplaceFeeRate: "0.00", paymentFeeRate: "0.00", otherCosts: "0.00", scenarioPrices: { low: null, base: null, high: null } };

describe("EconomicsScreen", () => {
  it("persists shared costs and three scenario prices", async () => {
    const user = userEvent.setup(); const save = vi.fn().mockResolvedValue(undefined);
    render(<EconomicsScreen assumptions={emptyAssumptions} onSave={save} />);
    await user.clear(screen.getByLabelText("Acquisition cost")); await user.type(screen.getByLabelText("Acquisition cost"), "3200");
    await user.clear(screen.getByLabelText("Shipping and logistics")); await user.type(screen.getByLabelText("Shipping and logistics"), "350");
    await user.type(screen.getByLabelText("Base selling price"), "7499"); await user.click(screen.getByRole("button", { name: "Save assumptions" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ acquisitionCost: "3200.00", shippingCost: "350.00", scenarioPrices: expect.objectContaining({ base: "7499.00" }) }));
  });

  it("announces when assumptions are saved", async () => {
    const user = userEvent.setup();
    render(<EconomicsScreen assumptions={emptyAssumptions} onSave={vi.fn().mockResolvedValue(undefined)} />);

    await user.click(screen.getByRole("button", { name: "Save assumptions" }));
    expect(await screen.findByText("Saved")).toHaveAttribute("aria-live", "polite");
  });
});
