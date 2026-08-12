import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import openMerchantMark from "./assets/open-merchant-mark.svg";
import { createFakeDesktopClient } from "./test/fakeDesktopClient";

describe("App", () => {
  it("identifies the product as a workspace, not a chatbot", () => {
    const client = createFakeDesktopClient();
    client.listRecentProjects.mockReturnValue(new Promise(() => undefined));
    render(<App client={client} />);

    expect(
      screen.getByRole("heading", { name: "Open Merchant" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Local commerce research workspace/),
    ).toBeInTheDocument();
  });

  it("uses the shared product mark in the home header", () => {
    const client = createFakeDesktopClient();
    client.listRecentProjects.mockReturnValue(new Promise(() => undefined));
    render(<App client={client} />);

    const productName = screen.getByRole("heading", { name: "Open Merchant" });
    expect(productName.querySelector("img")).toHaveAttribute(
      "src",
      openMerchantMark,
    );
  });
});
