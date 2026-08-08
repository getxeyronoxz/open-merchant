import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("identifies the product as a workspace, not a chatbot", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Open Merchant" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Local commerce research workspace"),
    ).toBeInTheDocument();
  });
});
