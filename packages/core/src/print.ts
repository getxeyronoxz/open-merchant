/**
 * File-first pillar (phase 2): print-perfect report HTML. A limited, safe
 * markdown → HTML conversion tuned to the report renderer's own output
 * (headings, paragraphs, lists, tables, links, hr, inline styling) wrapped
 * in a Ledger-styled print document for printToPDF.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/gu, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/gu, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gu, '<a href="$2">$1</a>');
}

const PRINT_STYLES = `
  :root { color: #1c1c18; }
  body { font-family: Georgia, 'Times New Roman', serif; margin: 48px auto; max-width: 720px; line-height: 1.6; }
  h1 { font-size: 28px; border-bottom: 2px solid #b08d2f; padding-bottom: 8px; }
  h2 { font-size: 20px; margin-top: 28px; color: #7a5c14; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #d8d2c0; padding: 6px 10px; text-align: left; }
  th { background: #f4efe0; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  ul { padding-left: 22px; }
  code { font-family: 'Cascadia Mono', Consolas, monospace; background: #f4efe0; padding: 1px 4px; }
  a { color: #7a5c14; }
  hr { border: none; border-top: 1px solid #d8d2c0; margin: 24px 0; }
  p.meta { color: #6b6455; font-size: 13px; }
`;

export function renderReportHtml(markdown: string, title: string): string {
  const lines = markdown.replace(/\r\n/gu, "\n").split("\n");
  const out: string[] = [];
  let listOpen = false;
  let tableRows: string[][] | null = null;
  let paragraph: string[] = [];

  const closeParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listOpen) {
      out.push("</ul>");
      listOpen = false;
    }
  };
  const flushTable = () => {
    if (tableRows === null) return;
    if (tableRows.length > 1) {
      const header = tableRows[0] as string[];
      out.push("<table><thead><tr>");
      for (const cell of header) out.push(`<th>${inlineMarkdown(cell)}</th>`);
      out.push("</tr></thead><tbody>");
      for (const row of tableRows.slice(1)) {
        out.push("<tr>");
        for (const cell of row) out.push(`<td>${inlineMarkdown(cell)}</td>`);
        out.push("</tr>");
      }
      out.push("</tbody></table>");
    }
    tableRows = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      closeParagraph();
      closeList();
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());
      // Separator rows like |---|---:| are structural, skipped.
      if (cells.every((cell) => /^:?-{3,}:?$/u.test(cell))) continue;
      if (tableRows === null) tableRows = [];
      tableRows.push(cells);
      continue;
    }
    flushTable();

    if (trimmed.length === 0) {
      closeParagraph();
      closeList();
      continue;
    }
    if (trimmed === "---") {
      closeParagraph();
      closeList();
      out.push("<hr />");
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeParagraph();
      closeList();
      out.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      closeParagraph();
      closeList();
      out.push(`<h1>${inlineMarkdown(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith("- ")) {
      closeParagraph();
      if (!listOpen) {
        out.push("<ul>");
        listOpen = true;
      }
      out.push(`<li>${inlineMarkdown(trimmed.slice(2))}</li>`);
      continue;
    }
    paragraph.push(trimmed);
  }
  closeParagraph();
  closeList();
  flushTable();

  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8" />',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${PRINT_STYLES}</style>`,
    "</head><body>",
    ...out,
    "</body></html>",
  ].join("\n");
}