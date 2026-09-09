import { describe, expect, it } from "vitest";

import { renderReportHtml } from "../src/print";

describe("print-perfect report HTML", () => {
  it("converts headings, lists, tables, and rules", () => {
    const html = renderReportHtml(
      "# Nova65\n\n## Decision summary\n\n- Risk one\n- Risk two\n\n| Scenario | Price |\n|---|---|\n| Base | 899.99 |\n\n---\n",
      "Test",
    );
    expect(html).toContain("<h1>Nova65</h1>");
    expect(html).toContain("<h2>Decision summary</h2>");
    expect(html).toContain("<li>Risk one</li>");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>Base</td>");
    expect(html).toContain("<hr />");
  });

  it("escapes hostile content before styling", () => {
    const html = renderReportHtml("# <script>alert(1)</script>", "Test");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("styles inline markdown: bold, italics, code, links", () => {
    const html = renderReportHtml("**Strong** *quiet* `code` [link](https://example.com)", "T");
    expect(html).toContain("<strong>Strong</strong>");
    expect(html).toContain("<em>quiet</em>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('<a href="https://example.com">link</a>');
  });
});