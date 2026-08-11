import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EconomicsScreen } from "./EconomicsScreen";
import type { CostAssumptions, EconomicsScenario } from "../../types";

const emptyAssumptions: CostAssumptions = { schemaVersion: 1, currency: "INR", acquisitionCost: "0.00", shippingCost: "0.00", marketplaceFeeRate: "0.00", paymentFeeRate: "0.00", otherCosts: "0.00", scenarioPrices: { low: null, base: null, high: null } };

const baseScenario: EconomicsScenario = {
  scenario: "base",
  sellingPrice: "4000.00",
  acquisitionCost: "1800.00",
  shippingCost: "120.00",
  marketplaceFeeRate: "12.00",
  marketplaceFee: "480.00",
  paymentFeeRate: "2.00",
  paymentFee: "80.00",
  otherCosts: "80.00",
  totalCost: "2560.00",
  grossProfit: "1440.00",
  grossMarginPercent: "36.00",
};

describe("EconomicsScreen", () => {
  it("persists shared costs and three scenario prices", async () => {
    const user = userEvent.setup(); const save = vi.fn().mockResolvedValue(undefined);
    render(<EconomicsScreen assumptions={emptyAssumptions} onSave={save} />);
    await user.clear(screen.getByLabelText("Acquisition cost")); await user.type(screen.getByLabelText("Acquisition cost"), "3200");
    await user.clear(screen.getByLabelText("Shipping and logistics")); await user.type(screen.getByLabelText("Shipping and logistics"), "350");
    await user.type(screen.getByLabelText("Base selling price"), "7499"); await user.click(screen.getByRole("button", { name: "Save assumptions" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ acquisitionCost: "3200.00", shippingCost: "350.00", scenarioPrices: expect.objectContaining({ base: "7499.00" }) }));
  });

  it("keeps saving and calculation actions independent while they run", async () => {
    const user = userEvent.setup();
    let finishSave!: () => void;
    let finishCalculation!: () => void;
    const save = vi.fn().mockReturnValue(new Promise<void>((resolve) => { finishSave = resolve; }));
    const calculate = vi.fn().mockReturnValue(new Promise<void>((resolve) => { finishCalculation = resolve; }));
    render(<EconomicsScreen assumptions={emptyAssumptions} onCalculate={calculate} onSave={save} />);

    await user.click(screen.getByRole("button", { name: "Save assumptions" }));
    expect(screen.getByRole("button", { name: "Saving assumptions…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Calculate and save scenarios" })).not.toBeDisabled();
    expect(screen.getByRole("status", { name: "Assumptions status" })).toHaveTextContent("Saving assumptions");
    await user.click(screen.getByRole("button", { name: "Calculate and save scenarios" }));
    expect(screen.getByRole("button", { name: "Calculating…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving assumptions…" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Calculation status" })).toHaveTextContent("Calculating scenarios");
    expect(calculate).not.toHaveBeenCalled();
    await act(async () => finishSave());
    expect(await screen.findByRole("status", { name: "Assumptions status" })).toHaveTextContent("Assumptions saved");
    await waitFor(() => expect(calculate).toHaveBeenCalledTimes(1));
    await act(async () => finishCalculation());
    expect(await screen.findByRole("status", { name: "Calculation status" })).toHaveTextContent("Scenarios calculated");
  });

  it("keeps edits made while assumptions are saving", async () => {
    const user = userEvent.setup();
    let finishSave!: () => void;
    const save = vi.fn().mockReturnValue(new Promise<void>((resolve) => { finishSave = resolve; }));
    render(<EconomicsScreen assumptions={emptyAssumptions} onSave={save} />);

    await user.click(screen.getByRole("button", { name: "Save assumptions" }));
    await user.clear(screen.getByLabelText("Acquisition cost"));
    await user.type(screen.getByLabelText("Acquisition cost"), "2500");
    expect(screen.getByRole("button", { name: "Saving assumptions…" })).toBeDisabled();
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => finishSave());

    await waitFor(() => expect(screen.getByRole("button", { name: "Save assumptions" })).not.toBeDisabled());
    expect(screen.getByLabelText("Acquisition cost")).toHaveValue("2500");
    expect(screen.getByRole("status", { name: "Assumptions status" })).toBeEmptyDOMElement();
  });

  it("preserves assumptions and reports a calculation failure", async () => {
    const user = userEvent.setup();
    const calculate = vi.fn().mockRejectedValue(new Error("Scenario generation failed."));
    render(<EconomicsScreen assumptions={emptyAssumptions} onCalculate={calculate} onSave={vi.fn()} />);

    await user.type(screen.getByLabelText("Base selling price"), "4000");
    await user.click(screen.getByRole("button", { name: "Calculate and save scenarios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Scenario generation failed.");
    expect(screen.getByLabelText("Base selling price")).toHaveValue("4000");
    expect(screen.getByRole("status", { name: "Calculation status" })).toHaveTextContent("Calculation failed");
  });

  it("presents returned scenario values without recalculating them in the interface", () => {
    render(<EconomicsScreen assumptions={emptyAssumptions} onSave={vi.fn()} scenarios={[baseScenario]} />);

    expect(screen.getByText("₹4,000.00")).toBeInTheDocument();
    expect(screen.getByText("₹2,560.00")).toBeInTheDocument();
    expect(screen.getByText("₹1,440.00")).toBeInTheDocument();
    expect(screen.getByText("36.00%")).toBeInTheDocument();
  });

  it("presents large deterministic values without binary-float precision loss", () => {
    render(<EconomicsScreen assumptions={emptyAssumptions} onSave={vi.fn()} scenarios={[{ ...baseScenario, sellingPrice: "9007199254740993.01", grossProfit: "9007199254740993.01" }]} />);
    expect(screen.getAllByText("₹9,00,71,99,25,47,40,993.01")).toHaveLength(2);
  });
});
