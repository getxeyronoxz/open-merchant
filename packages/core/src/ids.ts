/** Sequential ID helpers matching the workspace conventions (S-001, C-001). */

export function nextSequentialId(prefix: "S" | "C", existingIds: readonly string[]): string {
  let highest = 0;
  for (const id of existingIds) {
    const match = new RegExp(`^${prefix}-(\\d+)$`, "u").exec(id);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}
