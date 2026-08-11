import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CompetitorsScreen } from "./CompetitorsScreen";
import type { Competitor, EvidenceSource } from "../../types";

const linkedEvidence: EvidenceSource = {
  schemaVersion: 1,
  id: "S-001",
  url: "https://example.com/listing",
  title: "Amazon listing",
  notes: "",
  observations: [],
  observedAt: "2026-08-11T12:00:00Z",
  createdAt: "2026-08-11T12:00:00Z",
  updatedAt: "2026-08-11T12:00:00Z",
};

const linkedCompetitor: Competitor = {
  schemaVersion: 1,
  id: "C-001",
  product: "Keychron K2",
  brand: "Keychron",
  price: "7499.00",
  currency: "INR",
  marketplace: "Amazon",
  url: "https://example.com/listing",
  sourceId: "S-001",
  notes: "",
  observedAt: "2026-08-11T12:00:00Z",
};

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
    expect(screen.getByRole("status")).toHaveTextContent("Competitor saved");
  });

  it("shows deterministic price statistics from the backend result", () => {
    render(<CompetitorsScreen currency="INR" competitors={[]} evidence={[]} onSave={vi.fn()} statistics={{ validPriceCount: 3, minimum: "4999.00", maximum: "8999.00", average: "6999.00", median: "6999.00" }} />);
    expect(screen.getByText("₹4,999.00")).toBeInTheDocument();
    expect(screen.getByText("₹8,999.00")).toBeInTheDocument();
    expect(screen.getAllByText("₹6,999.00")).toHaveLength(2);
  });

  it("shows linked evidence context without changing backend statistics", () => {
    render(
      <CompetitorsScreen
        competitors={[linkedCompetitor]}
        currency="INR"
        evidence={[linkedEvidence]}
        onSave={vi.fn()}
        statistics={{ validPriceCount: 1, minimum: "7499.00", maximum: "7499.00", average: "7499.00", median: "7499.00" }}
      />,
    );

    expect(screen.getByText("S-001 · Amazon listing")).toBeInTheDocument();
    expect(screen.getAllByText("₹7,499.00")).toHaveLength(5);
  });

  it("opens the existing editor from the empty state", async () => {
    const user = userEvent.setup();
    render(<CompetitorsScreen currency="INR" competitors={[]} evidence={[]} onSave={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add first competitor" }));
    expect(screen.getByLabelText("Product")).toBeInTheDocument();
  });

  it("announces save progress and preserves the competitor draft after failure", async () => {
    const user = userEvent.setup();
    let rejectSave!: (reason: Error) => void;
    const save = vi.fn().mockReturnValue(
      new Promise<void>((_, reject) => {
        rejectSave = reject;
      }),
    );
    render(<CompetitorsScreen currency="INR" competitors={[]} evidence={[]} onSave={save} />);

    await user.click(screen.getByRole("button", { name: "Add competitor" }));
    await user.type(screen.getByLabelText("Product"), "Keep this competitor");
    await user.click(screen.getByRole("button", { name: "Save competitor" }));

    expect(screen.getByRole("button", { name: "Saving competitor…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Saving competitor");
    rejectSave(new Error("Competitor file is locked."));

    expect(await screen.findByRole("alert")).toHaveTextContent("Competitor file is locked.");
    expect(screen.getByLabelText("Product")).toHaveValue("Keep this competitor");
    expect(screen.getByRole("button", { name: "Save competitor" })).not.toBeDisabled();
  });
});
