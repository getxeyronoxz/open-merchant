import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AppError } from "@open-merchant/shared";

import { Button } from "../src/Button";
import { EmptyState } from "../src/EmptyState";
import { ErrorState, errorFrom } from "../src/ErrorState";
import { Field } from "../src/Field";
import { LedgerRow } from "../src/LedgerRow";

describe("errorFrom", () => {
  it("keeps AppError instances intact", () => {
    const error = new AppError({
      code: "ai-provider-error",
      message: "Provider busy",
      detail: "raw body",
    });
    expect(errorFrom(error)).toEqual({
      code: "ai-provider-error",
      message: "Provider busy",
      detail: "raw body",
    });
  });

  it("accepts already-serialized contract errors", () => {
    const serialized = { code: "not-a-project", message: "No project folder" };
    expect(errorFrom(serialized)).toEqual(serialized);
  });

  it("rejects payloads that do not satisfy the contract", () => {
    // Missing code.
    expect(errorFrom({ message: "no code here" }).code).toBe("storage-error");
    // A code outside the enum would be a contract violation, not a truth.
    expect(errorFrom({ code: "made-up-code", message: "x" }).code).toBe("storage-error");
  });

  it("wraps Error instances with the storage fallback code", () => {
    const result = errorFrom(new Error("EACCES: permission denied"));
    expect(result.code).toBe("storage-error");
    expect(result.message).toBe("EACCES: permission denied");
  });

  it("stringifies exotic throwables without crashing", () => {
    expect(errorFrom(42).message).toBe("42");
    expect(errorFrom(null).code).toBe("storage-error");
    expect(errorFrom(undefined).code).toBe("storage-error");
  });
});

describe("Button", () => {
  it("defaults to the secondary variant and an explicit button type", () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);
    expect(html).toContain('class="om-button om-button--secondary"');
    expect(html).toContain('type="button"');
    expect(html).toContain("Save");
  });

  it("maps every variant to its design-system class", () => {
    for (const [variant, expected] of [
      ["primary", "om-button--primary"],
      ["secondary", "om-button--secondary"],
      ["ghost", "om-button--ghost"],
      ["danger", "om-button--danger"],
    ] as const) {
      const html = renderToStaticMarkup(<Button variant={variant}>x</Button>);
      expect(html).toContain(`class="om-button ${expected}"`);
    }
  });

  it("appends a caller className without dropping the base classes", () => {
    const html = renderToStaticMarkup(<Button className="home__new">x</Button>);
    expect(html).toContain("om-button om-button--secondary home__new");
  });

  it("forwards native button props such as disabled and onClick handlers", () => {
    const html = renderToStaticMarkup(
      <Button disabled onClick={() => undefined} title="Save now" variant="primary">
        Save
      </Button>,
    );
    expect(html).toContain("om-button--primary");
    expect(html).toContain("disabled");
    expect(html).toContain('title="Save now"');
  });
});

describe("EmptyState", () => {
  it("renders the invitation title and any action children", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="No decisions yet">
        <button type="button">Start</button>
      </EmptyState>,
    );
    expect(html).toContain("om-empty");
    expect(html).toContain("No decisions yet");
    expect(html).toContain("Start");
  });
});

describe("ErrorState", () => {
  it("shows the coded message, the code, and the retry action", () => {
    const html = renderToStaticMarkup(
      <ErrorState error={new AppError({ code: "not-found", message: "Missing file" })} onRetry={() => undefined}>
        <span>extra</span>
      </ErrorState>,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Missing file");
    expect(html).toContain("code: not-found");
    expect(html).toContain("Try again");
    expect(html).toContain("extra");
  });

  it("normalizes unknown throwables instead of crashing", () => {
    const html = renderToStaticMarkup(<ErrorState error={42} />);
    expect(html).toContain("42");
    expect(html).toContain("code: storage-error");
    expect(html).not.toContain("Try again");
  });
});

describe("Field", () => {
  it("wraps the control with its label and optional hint", () => {
    const html = renderToStaticMarkup(
      <Field hint="One entry per line." label="Risks">
        <textarea />
      </Field>,
    );
    expect(html).toContain("om-field");
    expect(html).toContain("Risks");
    expect(html).toContain("One entry per line.");
    expect(html).toContain("<textarea");
  });

  it("omits the hint element when no hint is given", () => {
    const html = renderToStaticMarkup(
      <Field label="Title">
        <input />
      </Field>,
    );
    expect(html).toContain("Title");
    expect(html).not.toContain("om-field__hint");
  });
});

describe("LedgerRow", () => {
  it("renders label, leader, and tabular value", () => {
    const html = renderToStaticMarkup(<LedgerRow label="Market reference" value="749.00" />);
    expect(html).toContain("om-ledger__row");
    expect(html).toContain("Market reference");
    expect(html).toContain("749.00");
  });

  it("tones brass and muted values without changing the label", () => {
    const brass = renderToStaticMarkup(<LedgerRow label="Margin" tone="brass" value="20.49%" />);
    expect(brass).toContain("om-ledger__value--brass");
    const muted = renderToStaticMarkup(<LedgerRow label="Margin" tone="muted" value="—" />);
    expect(muted).toContain("om-ledger__value--muted");
  });
});