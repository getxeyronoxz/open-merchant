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
    expect(screen.getByText("Objective")).toBeInTheDocument();
    expect(client.createProject).toHaveBeenCalledWith({
      parentDirectory: "C:/Research",
      name: "Mechanical Keyboards India",
      objective: "Assess the India opportunity",
      currency: "INR",
    });
  });
});
