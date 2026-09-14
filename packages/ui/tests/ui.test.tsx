import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AppError } from "@open-merchant/shared";

import { Button } from "../src/Button";
import { errorFrom } from "../src/ErrorState";

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
});