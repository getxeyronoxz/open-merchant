import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Crash-safe replacement writes, ported from the legacy Rust engine:
 * contents land in a fresh temporary file in the target directory, then are
 * renamed over the destination (atomic on POSIX; Node maps rename onto
 * MoveFileEx-with-replacement on Windows). If anything fails before the
 * rename, the temporary file is removed and the previous contents survive
 * untouched.
 */

export async function writeFileAtomically(path: string, contents: string | Uint8Array): Promise<void> {
  const parent = dirname(path);
  if (!parent) throw new Error(`Cannot write ${path}: no parent directory`);

  await mkdir(parent, { recursive: true });
  const fileName = path.slice(parent.length + 1);
  const temporary = join(parent, `.${fileName}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, contents, { flag: "wx" });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

/** Read-modify-write an append-only journal through the same atomic path. */
export async function appendLineAtomically(path: string, line: string): Promise<void> {
  const { readFile } = await import("node:fs/promises");
  let existing = "";
  try {
    existing = await readFile(path, "utf8");
  } catch {
    existing = "";
  }
  const nextLine = line.endsWith("\n") ? line : `${line}\n`;
  await writeFileAtomically(path, `${existing}${nextLine}`);
}
