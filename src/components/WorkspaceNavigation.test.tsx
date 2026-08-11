import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceNavigation, type WorkspaceSection } from "./WorkspaceNavigation";

function NavigationHarness({ onSelect }: { onSelect: (section: WorkspaceSection) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <WorkspaceNavigation
      activeSection="Competitors"
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      onSelect={onSelect}
    />
  );
}

describe("WorkspaceNavigation", () => {
  it("keeps the current section and every destination accessible while collapsed", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<NavigationHarness onSelect={onSelect} />);

    const current = screen.getByRole("button", { name: "Competitors" });
    expect(current).toHaveAttribute("aria-current", "page");

    const toggle = screen.getByRole("button", { name: "Collapse navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);

    expect(screen.getByRole("button", { name: "Expand navigation" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await user.click(screen.getByRole("button", { name: "Economics" }));
    expect(onSelect).toHaveBeenCalledWith("Economics");
  });
});
