/**
 * README demo recorder — drives the REAL Electron app through the full
 * evidence → report loop, capturing a frame at every meaningful state.
 * No AI keys, no network, no telemetry. Frames are assembled into
 * docs/media/demo-loop.gif by gif.mjs.
 *
 * Usage:  pnpm --filter @open-merchant/desktop build && node record.cjs
 */
const { mkdir, mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { _electron } = require("playwright-core");

const FRAMES_DIR = process.env.OM_FRAMES_DIR || join(__dirname, ".om-frames");
const FRAME_W = Number(process.env.OM_FRAME_W || 1280);
const FRAME_H = Number(process.env.OM_FRAME_H || 800);

let frameIndex = 0;
async function shot(page, name, settleMs = 900) {
  await page.waitForTimeout(settleMs);
  const id = String(frameIndex).padStart(2, "0");
  await page.screenshot({ path: join(FRAMES_DIR, `${id}-${name}.png`) });
  console.log(`frame ${id}-${name}`);
  frameIndex += 1;
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

  const page = await electronApp.firstWindow();
  await page.setViewportSize({ width: FRAME_W, height: FRAME_H });
  await page.waitForLoadState("domcontentloaded");

  try {
    // Home: first-run welcome card, then the create form.
    await page.locator(".home__welcome").waitFor({ state: "visible" });
    await shot(page, "home-welcome");
    await page.getByRole("button", { name: "Got it" }).click();
    await page.locator(".home__welcome").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Create a project" }).click();
    await page.getByPlaceholder("Mechanical keyboards India").fill("Nova65 — India entry");
    await page
      .locator(".home__form textarea")
      .fill("Decide whether to enter the Indian enthusiast keyboard market with the Nova65.");
    await shot(page, "home-create");

    // Objective: land in the workspace.
    await page.locator(".home__form button[type='submit']").click();
    await page.locator(".shell__nav").first().waitFor({ state: "visible" });
    await shot(page, "objective", 1200);

    // --- Evidence: add a real source ---
    await page.getByRole("button", { name: "Add first source" }).waitFor({ state: "visible" });
    await shot(page, "evidence-empty");
    await page.getByRole("button", { name: "Add first source" }).click();
    await page.getByPlaceholder("https://…").fill("https://example.com/nova65");
    await page.getByPlaceholder("Marketplace category page").fill("Nova65 listing");
    await page.getByRole("button", { name: "Save source" }).click();
    await page.getByRole("button", { name: "Add source" }).waitFor({ state: "visible" });
    await shot(page, "evidence-saved");

    // --- Competitors: two priced listings, then the statistics ledger ---
    await page.getByRole("button", { name: "Continue to Competitors →" }).click();
    await page.getByPlaceholder("65% hot-swappable keyboard").fill("Board A — 65% hot-swap");
    await page.getByPlaceholder("Nova").fill("Keychron");
    await page.locator("input.om-money").first().fill("499.00");
    await shot(page, "competitor-form");
    await page.getByRole("button", { name: "Add listing" }).click();
    await page
      .getByRole("cell", { name: "Board A" })
      .first()
      .waitFor({ state: "visible" });
    await page.getByPlaceholder("65% hot-swappable keyboard").fill("Board B — 75% gasket");
    await page.getByPlaceholder("Nova").fill("NuPhy");
    await page.locator("input.om-money").first().fill("599.50");
    await page.getByRole("button", { name: "Add listing" }).click();
    await page.getByText("549.25").first().waitFor({ state: "visible" });
    await shot(page, "competitors-stats", 1100);

    // --- Economics: assumptions, then deterministic scenarios ---
    await page.getByRole("button", { name: "Continue to Economics →" }).click();
    const money = page.locator("input.om-money");
    await money.nth(0).fill("500.00");
    await money.nth(1).fill("75.50");
    await money.nth(2).fill("20.00");
    await money.nth(3).fill("12.50");
    await money.nth(4).fill("2.35");
    await money.nth(5).fill("899.99");
    await money.nth(6).fill("1099.99");
    await money.nth(7).fill("1499.99");
    await shot(page, "economics-form");
    await page.getByRole("button", { name: "Save assumptions" }).click();
    await page.getByRole("button", { name: "Calculate scenarios" }).click();
    await page.locator(".scenario").first().waitFor({ state: "visible", timeout: 30_000 });
    await shot(page, "economics-results", 1200);

    // --- Report: generate, then scroll the paper document ---
    await page.getByRole("button", { name: "Continue to Report →" }).click();
    await page.getByRole("button", { name: "Generate report" }).click();
    await page.locator(".report-preview").first().waitFor({ state: "visible", timeout: 30_000 });
    await shot(page, "report-top", 1200);
    await page.mouse.wheel(0, 480);
    await shot(page, "report-mid", 700);
    await page.mouse.wheel(0, 480);
    await shot(page, "report-low", 700);

    // --- Milestone + artifacts/history with the diff viewer ---
    await page.getByRole("button", { name: "Inspect Project Artifacts →" }).click();
    await page.locator(".artifacts__list").waitFor({ state: "visible" });
    await shot(page, "artifacts", 1100);
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

