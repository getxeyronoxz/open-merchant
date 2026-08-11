import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import App from "../../App";
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

    expect(await screen.findByText("Mechanical Keyboards India")).toBeInTheDocument();
    const expandNavigation = screen.getByRole("button", { name: "Expand navigation" });
    expect(expandNavigation).toHaveAttribute("aria-expanded", "false");
    await user.click(expandNavigation);
    expect(screen.getByRole("button", { name: "Collapse navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(client.createProject).toHaveBeenCalledWith({
      parentDirectory: "C:/Research",
      name: "Mechanical Keyboards India",
      objective: "Assess the India opportunity",
      currency: "INR",
    });
  });

  it("keeps project actions available while announcing the action in progress", async () => {
    const user = userEvent.setup();
    const client = createFakeDesktopClient();
    let finishCreate!: (snapshot: typeof mechanicalKeyboardSnapshot) => void;
    client.chooseDirectory.mockResolvedValue("C:/Research");
    client.createProject.mockReturnValue(
      new Promise((resolve) => {
        finishCreate = resolve;
      }),
    );

    render(<App client={client} />);
    await user.click(screen.getByRole("button", { name: "Create project" }));
    await user.type(screen.getByLabelText("Project name"), "Mechanical Keyboards India");
    await user.type(screen.getByLabelText("Research objective"), "Assess the India opportunity");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(screen.getByRole("button", { name: "Creating workspace…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open project folder" })).not.toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Creating workspace");

    finishCreate(mechanicalKeyboardSnapshot);
    expect(await screen.findByText("Mechanical Keyboards India")).toBeInTheDocument();
  });

  it("announces opening a project without disabling project creation", async () => {
    const user = userEvent.setup();
    const client = createFakeDesktopClient();
    let finishOpen!: (snapshot: typeof mechanicalKeyboardSnapshot) => void;
    client.chooseDirectory.mockResolvedValue("C:/Research/mechanical-keyboards-india");
    client.openProject.mockReturnValue(
      new Promise((resolve) => {
        finishOpen = resolve;
      }),
    );

    render(<App client={client} />);
    await user.click(screen.getByRole("button", { name: "Open project folder" }));

    expect(screen.getByRole("button", { name: "Opening project…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create project" })).not.toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Opening project");

    finishOpen(mechanicalKeyboardSnapshot);
    expect(await screen.findByText("Mechanical Keyboards India")).toBeInTheDocument();
  });
});
