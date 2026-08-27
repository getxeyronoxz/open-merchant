/** Portable lowercase-hyphenated folder name for a project title. */
export function projectFolderName(name: string): string {
  let slug = "";
  let previousWasSeparator = false;
  for (const character of name.trim()) {
    if (/[a-z0-9]/i.test(character)) {
      slug += character.toLowerCase();
      previousWasSeparator = false;
    } else if (!previousWasSeparator && slug.length > 0) {
      slug += "-";
      previousWasSeparator = true;
    }
  }
  // Bounded trimming without regex backtracking — CodeQL flags global
  // replaces over uncontrolled input, and the loop is behavior-identical.
  let start = 0;
  while (start < slug.length && slug[start] === "-") start += 1;
  let end = slug.length;
  while (end > start && slug[end - 1] === "-") end -= 1;
  return slug.slice(start, end) || "project";
}
