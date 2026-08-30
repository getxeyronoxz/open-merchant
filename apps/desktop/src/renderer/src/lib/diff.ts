/**
 * Minimal Myers-style line diff for the artifact viewer. Pure and dependency-
 * free so it can run in the renderer and in Node tests alike; it is display
 * logic only — it never touches commerce math.
 */

export type DiffLineKind = "same" | "add" | "del" | "skip";

export interface DiffLine {
  readonly kind: DiffLineKind;
  readonly text: string;
}

export interface LineDiff {
  readonly before: DiffLine[];
  readonly after: DiffLine[];
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n/gu, "\n").split("\n");
}

/**
 * Computes an LCS alignment of two texts and returns aligned rows for a
 * side-by-side view. Identical lines appear on both sides; removed lines fill
 * the before column and added lines the after column, with "skip" rows
 * keeping the two columns the same height for clean pairing.
 */
export function diffLines(beforeText: string, afterText: string): LineDiff {
  const beforeLines = splitLines(beforeText);
  const afterLines = splitLines(afterText);
  const n = beforeLines.length;
  const m = afterLines.length;

  // Longest-common-subsequence table (bottom-up, exact). Row and element
  // reads stay within bounds by construction, so the non-null assertions
  // satisfy the strict index checking without changing behavior.
  const table: Int32Array[] = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i]![j] =
        beforeLines[i] === afterLines[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }

  const before: DiffLine[] = [];
  const after: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const left = beforeLines[i] ?? "";
    const right = afterLines[j] ?? "";
    if (left === right) {
      before.push({ kind: "same", text: left });
      after.push({ kind: "same", text: right });
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      before.push({ kind: "del", text: left });
      after.push({ kind: "skip", text: "" });
      i += 1;
    } else {
      before.push({ kind: "skip", text: "" });
      after.push({ kind: "add", text: right });
      j += 1;
    }
  }
  while (i < n) {
    before.push({ kind: "del", text: beforeLines[i] ?? "" });
    after.push({ kind: "skip", text: "" });
    i += 1;
  }
  while (j < m) {
    before.push({ kind: "skip", text: "" });
    after.push({ kind: "add", text: afterLines[j] ?? "" });
    j += 1;
  }

  return { before, after };
}