import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ObjectiveScreen } from "./ObjectiveScreen";
import { mechanicalKeyboardSnapshot } from "../../test/fixtures";

describe("ObjectiveScreen", () => {
  it("debounces objective persistence and shows saved status", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(mechanicalKeyboardSnapshot);
    render(<ObjectiveScreen snapshot={mechanicalKeyboardSnapshot} onSave={save} />);

    fireEvent.change(screen.getByLabelText("Research objective"), {
      target: { value: "Updated objective" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ objective: "Updated objective" }),
    );
    expect(screen.getByText("Saved")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
