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
  return slug.replace(/^-+|-+$/g, "") || "project";
}
