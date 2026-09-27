import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The macOS and Linux launcher for the bundled MCP server.
 *
 * The owner's machine is Windows, so this file is the only way the POSIX side
 * gets exercised locally at all — and it is written to run wherever a POSIX
 * shell exists, so CI's ubuntu and macOS runners cover the two layouts that
 * actually ship: a `.app` bundle, and an AppImage/deb/snap install tree.
 *
 * What is pinned here is the *path resolution*, because that is the part that
 * silently breaks. A `.app` puts the executable in `Contents/MacOS`, one level
 * the Linux layout does not have, so a launcher that only checked the Linux
 * path would fail on every Mac — and a launcher that guessed could just as
 * easily start a server belonging to a different install.
 */

const DESKTOP = fileURLToPath(new URL("..", import.meta.url));
const STAGE = join(DESKTOP, "stage-mcp.cjs");
const STAGED = join(DESKTOP, "resources", "mcp");
const LAUNCHER = "open-merchant-mcp";
const BUNDLE = "open-merchant-mcp.mjs";

/** A stand-in for the app executable, reporting how it was invoked. */
const FAKE_APP = `#!/bin/sh
echo "RUN_AS_NODE=$ELECTRON_RUN_AS_NODE"
echo "SCRIPT=$1"
shift
echo "ARGS=$*"
`;

/**
 * An absolute path to a POSIX shell, in a form the *host OS* can spawn.
 *
 * `command -v bash` inside git-bash answers `/usr/bin/bash`, which a Windows
 * process cannot execute — so on Windows the lookup has to come from `where`,
 * which answers a path Windows can actually spawn. The absolute form is what
 * lets the "no Node anywhere" test strip PATH from the child.
 */
function findBash(): string {
  const lookup =
    process.platform === "win32"
      ? spawnSync("where", ["bash"], { encoding: "utf8" })
      : spawnSync("bash", ["-c", "command -v bash"], { encoding: "utf8" });
  return lookup.stdout.split(/\r?\n/u)[0]?.trim() ?? "";
}

const bashPath = findBash();
const hasBash = bashPath !== "" && spawnSync(bashPath, ["--version"]).status === 0;
const trees: string[] = [];

beforeAll(() => {
  // Run the real staging script rather than reading committed output: this is
  // also the only test that the script still produces what it claims to.
  //
  // `--posix` because the owner's machine is Windows and a Windows build stages
  // only the .cmd. Staging is per-platform by design, so asking for the POSIX
  // tree explicitly is how the macOS and Linux artefacts get checked from here.
  execFileSync("node", [STAGE, "--posix"], { cwd: DESKTOP });
});

afterAll(() => {
  for (const tree of trees) rm(tree, { recursive: true, force: true });
});

/** Builds a fake install tree and returns its root and staged launcher path. */
async function installTree(
  layout: "macos" | "linux",
  options: { appExecutable?: boolean } = {},
): Promise<{ root: string; launcher: string; expectedScript: string }> {
  const root = await mkdtemp(join(tmpdir(), "om-mcp-layout-"));
  trees.push(root);

  const contents =
    layout === "macos" ? join(root, "Open Merchant.app", "Contents") : root;
  const mcpDir = join(contents, layout === "macos" ? join("Resources", "mcp") : join("resources", "mcp"));
  mkdirSync(mcpDir, { recursive: true });

  copyFileSync(join(STAGED, BUNDLE), join(mcpDir, BUNDLE));
  const launcher = join(mcpDir, LAUNCHER);
  copyFileSync(join(STAGED, LAUNCHER), launcher);
  chmodSync(launcher, 0o755);

  if (options.appExecutable !== false) {
    const app =
      layout === "macos"
        ? join(contents, "MacOS", "open-merchant")
        : join(root, "open-merchant");
    mkdirSync(dirname(app), { recursive: true });
    writeFileSync(app, FAKE_APP, "utf8");
    chmodSync(app, 0o755);
  }

  return { root, launcher, expectedScript: join(mcpDir, BUNDLE) };
}

/**
 * The path a POSIX shell should be given for a file.
 *
 * On a real macOS or Linux host this is already POSIX. Under git-bash on
 * Windows it is not: a `C:\...` path contains no `/`, so the launcher's own
 * `$0` handling resolves it to the working directory instead of the file's —
 * an artifact of running the test on the wrong OS, not a product bug, since no
 * POSIX host ever hands a shell a backslash-separated path.
 */
function posixPath(target: string): string {
  if (process.platform !== "win32") return target;
  const converted = spawnSync("cygpath", ["-u", target], { encoding: "utf8" }).stdout.trim();
  return converted === "" ? target : converted;
}

function run(launcher: string, args: string[] = [], env?: NodeJS.ProcessEnv) {
  // bash is invoked by absolute path so a test can strip PATH from the child
  // to stand in for a machine with no Node installed.
  const result = spawnSync(bashPath, [posixPath(launcher), ...args], {
    encoding: "utf8",
    ...(env === undefined ? {} : { env }),
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

describe("staged MCP launcher", () => {
  it("is staged with a shebang and no carriage returns", () => {
    // A CRLF in a shell script breaks the shebang line, and the "bad
    // interpreter" error that results points nowhere near the real cause.
    const source = readFileSync(join(STAGED, LAUNCHER), "utf8");

    expect(source.startsWith("#!/bin/sh\n")).toBe(true);
    expect(source).not.toContain("\r");
  });

  // NTFS has no executable bit to lose, so this can only be checked where there
  // is one. CI's ubuntu runner is the real assertion; running it on Windows
  // would be asserting that chmod did something it structurally cannot.
  it.skipIf(process.platform === "win32")(
    "is staged executable, because a host spawns it directly",
    () => {
      // If the executable bit does not survive being copied into a DMG, an
      // AppImage, or a snap, nothing starts at all and the reason is opaque.
      expect(statSync(join(STAGED, LAUNCHER)).mode & 0o111).not.toBe(0);
    },
  );

  it("stages only what the target platform can run", () => {
    // A macOS build should not carry a .cmd, and a Windows build should not
    // carry a shell launcher nobody there can run. Staging is per-platform by
    // design, so this asks for both trees rather than whichever one the machine
    // running the test happens to produce.
    execFileSync("node", [STAGE, "--windows"], { cwd: DESKTOP });
    const windows = readFileSync(join(STAGED, "open-merchant-mcp.cmd"), "utf8");

    expect(windows).toContain("\r\n");
    expect(windows).toContain("ELECTRON_RUN_AS_NODE=1");
    expect(existsSync(join(STAGED, "open-merchant-mcp"))).toBe(false);

    execFileSync("node", [STAGE, "--posix"], { cwd: DESKTOP });
    expect(existsSync(join(STAGED, "open-merchant-mcp"))).toBe(true);
    expect(existsSync(join(STAGED, "open-merchant-mcp.cmd"))).toBe(false);
  });
});

// The behaviour below needs a POSIX shell. It runs for real on CI's ubuntu and
// macOS runners, and wherever a developer has bash available.
describe.skipIf(!hasBash)("the POSIX launcher", () => {
  it("finds the executable inside a macOS .app bundle", async () => {
    // A .app keeps it in Contents/MacOS, a level the Linux layout does not
    // have. A launcher that only checked the Linux path would fail on every Mac.
    const { launcher } = await installTree("macos");
    const { status, out } = run(launcher, ["/projects/Keyboards"]);

    expect(status).toBe(0);
    expect(out).toContain("RUN_AS_NODE=1");
    // The layout tail is the assertion: the absolute prefix is the temp dir,
    // which a POSIX shell renders with its own separators.
    expect(out).toMatch(
      /SCRIPT=.*Open Merchant\.app[/\\]Contents[/\\]Resources[/\\]mcp[/\\]open-merchant-mcp\.mjs/u,
    );
    expect(out).toContain("ARGS=/projects/Keyboards");
  });

  it("finds the executable at the root of a Linux install tree", async () => {
    const { launcher } = await installTree("linux");
    const { status, out } = run(launcher, ["/projects/Keyboards"]);

    expect(status).toBe(0);
    expect(out).toContain("RUN_AS_NODE=1");
    expect(out).toMatch(/SCRIPT=.*resources[/\\]mcp[/\\]open-merchant-mcp\.mjs/u);
    expect(out).toContain("ARGS=/projects/Keyboards");
  });

  it("prefers the bundled runtime over whatever node happens to be installed", async () => {
    // A seller's node could be any version, or absent. The runtime that ships
    // with the app is the one guaranteed to match the server beside it.
    const { launcher } = await installTree("linux");
    const { out } = run(launcher, []);

    expect(out).toContain("RUN_AS_NODE=1");
    expect(out).not.toContain("no Node runtime found");
  });

  it("passes every argument through, including a path with spaces", async () => {
    const { launcher } = await installTree("linux");
    const { out } = run(launcher, ["/Users/seller/My Projects/Keyboards"]);

    expect(out).toContain("ARGS=/Users/seller/My Projects/Keyboards");
  });

  it("says something useful when there is no runtime at all", async () => {
    // Not an obscure failure: it names the problem, says why it is surprising,
    // and shows the command that works around it.
    const { launcher } = await installTree("linux", { appExecutable: false });
    const { status, out } = run(launcher, [], { PATH: "/nonexistent" });

    expect(status).toBe(1);
    expect(out).toContain("no Node runtime found");
    expect(out).toContain(BUNDLE);
  });
});
