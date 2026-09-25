/**
 * README demo recorder v2 — drives the REAL Electron app through the full
 * evidence → report loop with MOTION, not just keyframes: a capture loop
 * records frames while typing, scrolling, hovering, and panel transitions
 * run, so the assembled GIF reads like a screen recording.
 *
 * No AI keys, no network, no telemetry. Frames are assembled into
 * docs/media/demo-loop.gif by gif.mjs.
 *
 * Frame naming:  NN-k-<name>.png  = keyframe (long hold in the GIF)
 *                NN-m-<name>.png  = motion frame (short hold, plays fast)
 *
 * Usage:  pnpm --filter @open-merchant/desktop build && node record.cjs
 */
const { mkdir, mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { _electron } = require("playwright-core");

const FRAMES_DIR = process.env.OM_FRAMES_DIR || join(__dirname, ".om-frames");
// Capture large, downscale in gif.mjs — box-filtered 1600→960 keeps text crisp.
const FRAME_W = Number(process.env.OM_FRAME_W || 1600);
const FRAME_H = Number(process.env.OM_FRAME_H || 1000);
// Cadence of the motion capture loop (ms between motion frames).
const MOTION_MS = Number(process.env.OM_MOTION_MS || 110);

let frameIndex = 0;
let page = null;

async function capture(kind, name) {
  const id = String(frameIndex).padStart(3, "0");
  await page.screenshot({ path: join(FRAMES_DIR, `${id}-${kind}-${name}.png`) });
  frameIndex += 1;
}

/** Keyframe — a state the viewer should stop and read. */
async function shot(name, settleMs = 900) {
  await page.waitForTimeout(settleMs);
  await capture("k", name);
  console.log(`key   ${frameIndex - 1}-${name}`);
}

/**
 * Run `action` while capturing motion frames until it settles.
 * Every transition, keystroke burst, and scroll goes through here.
 */
async function recordDuring(name, action, { tailMs = 250 } = {}) {
  let recording = true;
  const loop = (async () => {
    while (recording) {
      await capture("m", name);
      await page.waitForTimeout(MOTION_MS);
    }
  })();
  try {
    await action();
  } finally {
    recording = false;
    await loop.catch(() => {});
    if (tailMs > 0) await page.waitForTimeout(tailMs);
  }
}

/** Type like a person — visible keystrokes at a readable pace. */
async function typeInto(locator, text, name) {
  await locator.click();
  await recordDuring(name, async () => {
    // Pre-filled fields (cost assumptions) must be replaced, not appended to —
    // typing over a selection is also what a human would do on camera.
    await locator.press("Control+a");
    await locator.pressSequentially(text, { delay: 55 });
  });
}

/** Hover a target first so the glow/lift state is captured, then click. */
async function hoverClick(locator, name) {
  await recordDuring(name, async () => {
    await locator.hover();
    await page.waitForTimeout(350);
    await locator.click();
  });
}

/** Smooth-scroll a panel: many small wheel steps, all captured. */
async function smoothScroll(name, { steps = 14, dy = 70, pause = 90 } = {}) {
  await recordDuring(name, async () => {
    for (let i = 0; i < steps; i += 1) {
      await page.mouse.wheel(0, dy);
      await page.waitForTimeout(pause);
    }
  });
}

(async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "om-rec-userdata-"));
  const projectsParent = await mkdtemp(join(tmpdir(), "om-rec-projects-"));
  await rm(FRAMES_DIR, { recursive: true, force: true });
  await mkdir(FRAMES_DIR, { recursive: true });

  const electronApp = await _electron.launch({
    args: ["./out/main/index.js"],
    env: { ...process.env, OPEN_MERCHANT_USER_DATA: userDataDir },
  });
  await electronApp.evaluate(({ dialog }, parent) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [parent], bookmarks: [] });
  }, projectsParent);

  page = await electronApp.firstWindow();
  await page.setViewportSize({ width: FRAME_W, height: FRAME_H });
  await page.waitForLoadState("domcontentloaded");

  try {
    // Home: first-run welcome card, then the create form.
    await page.locator(".home__welcome").waitFor({ state: "visible" });
    await shot("home-welcome", 1400);
    await hoverClick(page.getByRole("button", { name: "Got it" }), "welcome-dismiss");
    await page.locator(".home__welcome").waitFor({ state: "hidden" });
    await hoverClick(page.getByRole("button", { name: "New workspace" }), "home-new");
    await typeInto(
      page.getByPlaceholder("Mechanical keyboards India"),
      "Nova65 — India entry",
      "type-name",
    );
    await typeInto(
      page.locator(".home__form textarea"),
      "Decide whether to enter the Indian enthusiast keyboard market with the Nova65.",
      "type-objective",
    );
    await shot("home-create", 600);

    // Objective: land in the workspace.
    await hoverClick(page.locator(".home__form button[type='submit']"), "home-submit");
    await page.locator(".shell__nav").first().waitFor({ state: "visible" });
    await shot("objective", 1300);

    // --- Evidence: add a real source ---
    await page.getByRole("button", { name: "Add first source" }).waitFor({ state: "visible" });
    await shot("evidence-empty", 700);
    await hoverClick(page.getByRole("button", { name: "Add first source" }), "evidence-add");
    await typeInto(page.getByPlaceholder("https://…"), "https://example.com/nova65", "type-url");
    await typeInto(
      page.getByPlaceholder("Marketplace category page"),
      "Nova65 listing",
      "type-title",
    );
    await hoverClick(page.getByRole("button", { name: "Save source" }), "evidence-save");
    await page.getByRole("button", { name: "Add source" }).waitFor({ state: "visible" });
    await shot("evidence-saved", 900);

    // --- Competitors: two priced listings, then the statistics ledger ---
    await hoverClick(page.getByRole("button", { name: "Continue to Competitors →" }), "nav-competitors");
    await typeInto(page.getByPlaceholder("65% hot-swappable keyboard"), "Board A — 65% hot-swap", "type-comp-a");
    await typeInto(page.getByPlaceholder("Nova"), "Keychron", "type-brand-a");
    await typeInto(page.locator("input.om-money").first(), "499.00", "type-price-a");
    await shot("competitor-form", 500);
    await hoverClick(page.getByRole("button", { name: "Add listing" }), "comp-add-a");
    await page.getByRole("cell", { name: "Board A" }).first().waitFor({ state: "visible" });
    await typeInto(page.getByPlaceholder("65% hot-swappable keyboard"), "Board B — 75% gasket", "type-comp-b");
    await typeInto(page.getByPlaceholder("Nova"), "NuPhy", "type-brand-b");
    await typeInto(page.locator("input.om-money").first(), "599.50", "type-price-b");
    await hoverClick(page.getByRole("button", { name: "Add listing" }), "comp-add-b");
    await page.getByText("549.25").first().waitFor({ state: "visible" });
    await shot("competitors-stats", 1200);

    // --- Economics: assumptions, then deterministic scenarios ---
    await hoverClick(page.getByRole("button", { name: "Continue to Economics →" }), "nav-economics");
    const money = page.locator("input.om-money");
    const values = ["500.00", "75.50", "20.00", "12.50", "2.35", "899.99", "1099.99", "1499.99"];
    for (let i = 0; i < values.length; i += 1) {
      await typeInto(money.nth(i), values[i], `type-econ-${i}`);
    }
    await shot("economics-form", 600);
    await hoverClick(page.getByRole("button", { name: "Save assumptions" }), "econ-save");
    await page.getByText("Saved — ready to calculate").waitFor({ state: "visible", timeout: 15_000 });
    await hoverClick(page.getByRole("button", { name: "Calculate scenarios" }), "econ-calc");
    await page.locator(".scenario").first().waitFor({ state: "visible", timeout: 30_000 });
    await shot("economics-results", 1300);

    // --- Report: generate, then scroll the paper document smoothly ---
    await hoverClick(page.getByRole("button", { name: "Continue to Report →" }), "nav-report");
    await hoverClick(page.getByRole("button", { name: "Generate report" }), "report-generate");
    await page.locator(".report-preview").first().waitFor({ state: "visible", timeout: 30_000 });
    await shot("report-top", 1300);
    await smoothScroll("report-scroll", { steps: 16, dy: 65, pause: 85 });
    await shot("report-bottom", 700);

    // --- Milestone + artifacts/history with the diff viewer ---
    await hoverClick(page.getByRole("button", { name: "Inspect Project Artifacts →" }), "nav-artifacts");
    await page.locator(".artifacts__list").waitFor({ state: "visible" });
    await shot("artifacts", 1200);

    // --- Phase 3: the Draft Desk draft gate ---
    // A capture run has no AI keys, so the review queue is honestly empty. The
    // frame shows the gate itself: the Assistant lane, the empty queue, and the
    // standing "Human acceptance required" badge.
    await hoverClick(page.getByRole("button", { name: "Draft Desk" }), "nav-draft-desk");
    await page.getByRole("heading", { name: "Draft Desk" }).waitFor({ state: "visible" });
    await page.getByText("No drafts waiting").waitFor({ state: "visible" });
    await shot("draft-desk", 1400);
    // Only scroll when the panel actually overflows, so the captured frame set
    // stays deterministic across window sizes.
    const deskOverflows = await page
      .locator(".draft-desk")
      .evaluate((el) => el.scrollHeight > el.clientHeight + 4);
    if (deskOverflows) {
      await smoothScroll("draft-desk-scroll", { steps: 8, dy: 60, pause: 90 });
      await shot("draft-desk-scrolled", 700);
    }
  } finally {
    await electronApp.close();
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    await rm(projectsParent, { recursive: true, force: true }).catch(() => {});
  }
  console.log(`done — ${frameIndex} frames in ${FRAMES_DIR}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

