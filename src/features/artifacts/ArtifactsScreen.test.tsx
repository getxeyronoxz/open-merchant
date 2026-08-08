import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ArtifactsScreen } from "./ArtifactsScreen";
import { createFakeDesktopClient } from "../../test/fakeDesktopClient";

describe("ArtifactsScreen", () => {
  it("selects a known artifact and shows its text", async () => {
    const user = userEvent.setup();
    const client = createFakeDesktopClient();
    client.listArtifacts.mockResolvedValue([{ relativePath: "reports/opportunity-report.md", kind: "markdown", generated: true, exists: true }]);
    client.readArtifact.mockResolvedValue("# Mechanical Keyboards India");
    render(<ArtifactsScreen client={client} projectRoot="C:/Research/keyboards" />);
    await user.click(await screen.findByText("opportunity-report.md"));
    expect(await screen.findByText("# Mechanical Keyboards India")).toBeInTheDocument();
  });
});
