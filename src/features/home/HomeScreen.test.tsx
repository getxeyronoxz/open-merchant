import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import App from "../../App";
import openMerchantMark from "../../assets/open-merchant-mark.svg";
import { createFakeDesktopClient } from "../../test/fakeDesktopClient";
import { mechanicalKeyboardSnapshot } from "../../test/fixtures";

describe("HomeScreen", () => {
  it("creates a project and enters the workspace", async () => {
    const user = userEvent.setup();
    const client = createFakeDesktopClient();
    client.chooseDirectory.mockResolvedValue("C:/Research");
    client.createProject.mockResolvedValue(mechanicalKeyboardSnapshot);

    render(<App client={client} />);
    await user.click(screen.getByRole("button", { name: "Create project" }));
    await user.type(
      screen.getByLabelText("Project name"),
      "Mechanical Keyboards India",
    );
    await user.type(
      screen.getByLabelText("Research objective"),
      "Assess the India opportunity",
    );
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(await screen.findByRole("button", { name: /Objective/ })).toBeInTheDocument();
    expect(screen.getByText("C:/Research/mechanical-keyboards-india")).toBeInTheDocument();
    expect(client.createProject).toHaveBeenCalledWith({
      parentDirectory: "C:/Research",
      name: "Mechanical Keyboards India",
      objective: "Assess the India opportunity",
      currency: "INR",
    });
  });

  it("keeps local project context visible while navigating the workspace", async () => {
    const user = userEvent.setup();
    const client = createFakeDesktopClient();
    client.chooseDirectory.mockResolvedValue("C:/Research");
    client.createProject.mockResolvedValue(mechanicalKeyboardSnapshot);

    render(<App client={client} />);
    await user.click(screen.getByRole("button", { name: "Create project" }));
    await user.type(screen.getByLabelText("Project name"), "Mechanical Keyboards India");
    await user.type(screen.getByLabelText("Research objective"), "Assess the India opportunity");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(await screen.findByText("Local workspace")).toBeInTheDocument();
    expect(screen.getByText("C:/Research/mechanical-keyboards-india")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mechanical Keyboards India", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Open Merchant").closest(".brand-lockup")?.querySelector("img")).toHaveAttribute(
      "src",
      openMerchantMark,
    );

    await user.click(screen.getByRole("button", { name: /Evidence/ }));
    expect(screen.getByRole("heading", { name: "Keep the source behind every claim" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Evidence/ })).toHaveAttribute("aria-current", "page");
  });
});
