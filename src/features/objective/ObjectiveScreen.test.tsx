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

  it("announces a failed save and retries without losing the edited objective", async () => {
    vi.useFakeTimers();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("The project file is unavailable."))
      .mockResolvedValueOnce(mechanicalKeyboardSnapshot);
    render(<ObjectiveScreen snapshot={mechanicalKeyboardSnapshot} onSave={save} />);

    fireEvent.change(screen.getByLabelText("Research objective"), {
      target: { value: "Keep this edited objective" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Saving");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByRole("status")).toHaveTextContent("Failed");
    expect(screen.getByRole("alert")).toHaveTextContent("The project file is unavailable.");
    expect(screen.getByLabelText("Research objective")).toHaveValue("Keep this edited objective");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    vi.useRealTimers();
  });
});
