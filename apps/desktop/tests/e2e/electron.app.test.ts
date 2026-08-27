import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron, type ElectronApplication, type Page } from "playwright-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * End-to-end test driving the REAL Electron app: real window, real preload
 * bridge, real IPC, real disk writes. The native directory dialog is
 * stubbed in the main process to point at a temp folder.
 */

let electronApp: ElectronApplication;
let page: Page;
let userDataDir: string;
let projectsParent: string;

const dirsToClean: string[] = [];

beforeEach(async () => {
  userDataDir = await mkdtemp(join(tmpdir(), "om-e2e-userdata-"));
  projectsParent = await mkdtemp(join(tmpdir(), "om-e2e-projects-"));
  dirsToClean.push(userDataDir, projectsParent);

  electronApp = await _electron.launch({
    args: ["./out/main/index.js"],
    env: { ...process.env, OPEN_MERCHANT_USER_DATA: userDataDir },
  });

  // Stub the native folder chooser to return our temp parent.
  await electronApp.evaluate(({ dialog }, parent) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [parent], bookmarks: [] });
  }, projectsParent);

  page = await electronApp.firstWindow();
  await page.waitForLoadState("domcontentloaded");
});

afterEach(async () => {
  try {
    await electronApp.close();
  } catch {
    // Already closed by a test that manages its own restart.
  }
  await Promise.all(dirsToClean.map((dir) => rm(dir, { recursive: true, force: true })));
  dirsToClean.length = 0;
});

describe("Open Merchant E2E", () => {
  it("boots to the Home screen", async () => {
    await expect(await page.locator(".home__thesis").innerText()).toContain("Make the call");
    await page.locator(".home__panel-title").waitFor({ state: "visible" });

    // Fresh install: the one-time first-run walkthrough card offers three moves.
    await page.locator(".home__welcome").waitFor({ state: "visible" });
    await expect(await page.locator(".home__welcome-title").innerText()).toContain("three moves");
    await page.getByRole("button", { name: "Got it" }).click();
    await page.locator(".home__welcome").waitFor({ state: "hidden" });

    // After dismissal the standing invitation remains for empty installs.
    await expect(await page.locator(".om-empty__title").innerText()).toContain("No decisions yet");
  });

  it("creates a project through the real IPC and lands in the workspace", async () => {
    await page.getByRole("button", { name: "Create a project" }).click();
    await page.getByPlaceholder("Mechanical keyboards India").fill("E2E Keyboards");
    await page
      .locator(".home__form textarea")
      .fill("Decide whether to enter the Indian enthusiast keyboard market.");
    // Currency defaults to INR; submit.
    await page.locator(".home__form button[type='submit']").click();

    // Workspace shell appears with the six-section rail.
    await page.locator(".shell__nav").first().waitFor({ state: "visible" });
    await expect(await page.locator(".shell__identity-copy strong").innerText()).toBe("E2E Keyboards");

    // The folder really exists on disk with a valid manifest.
    const manifestRaw = await readFile(
      join(projectsParent, "e2e-keyboards", ".openmerchant", "manifest.json"),
      "utf8",
    );
    const manifest = JSON.parse(manifestRaw);
    expect(manifest.name).toBe("E2E Keyboards");
    expect(manifest.currency).toBe("INR");
    expect(manifest.schemaVersion).toBe(2);

    // The run journal recorded the creation.
    const runs = await readFile(
      join(projectsParent, "e2e-keyboards", ".openmerchant", "runs.jsonl"),
      "utf8",
    );
    expect(runs).toContain("projectCreated");
  });
});

describe("Open Merchant E2E deep workflow", () => {
  it("walks evidence → competitors → economics → report across the real stack", async () => {
    // --- create project ---
    await page.getByRole("button", { name: "Create a project" }).click();
    await page.getByPlaceholder("Mechanical keyboards India").fill("Deep Flow");
    await page.locator(".home__form textarea").fill("Test the full research pipeline.");
    await page.locator(".home__form button[type='submit']").click();
    await page.locator(".shell__nav").first().waitFor({ state: "visible" });

    // Verify Onboarding Walkthrough Guide initializes correctly
    await page.locator(".om-guide").waitFor({ state: "visible" });
    await expect(await page.locator(".om-guide__title").innerText()).toContain("Step 2 of 6: Evidence library");

    // No AI key exists on a fresh install, so the guide states AI is optional.
    await page.locator(".om-guide__tip").waitFor({ state: "visible" });
    await expect(await page.locator(".om-guide__tip").innerText()).toContain("optional");

    const projectRoot = join(projectsParent, "deep-flow");

    // --- evidence: resume targeting landed the workspace here directly ---
    await page.getByRole("button", { name: "Add first source" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Add first source" }).click();
    await page.getByPlaceholder("https://…").fill("https://example.com/nova65");
    await page.getByPlaceholder("Marketplace category page").fill("Nova65 listing");
    await page.getByRole("button", { name: "Save source" }).click();
    await page.getByRole("button", { name: "Add source" }).waitFor({ state: "visible" });

    const sourcesRaw = await readFile(join(projectRoot, "evidence", "sources.jsonl"), "utf8");
    expect(sourcesRaw).toContain("Nova65 listing");

    // Guide advanced to Step 3: Market landscape
    await expect(await page.locator(".om-guide__title").innerText()).toContain("Step 3 of 6: Market landscape");

    // --- competitors: add two priced listings via continuation button ---
    await page.getByRole("button", { name: "Continue to Competitors →" }).click();
    for (const [product, price] of [["Board A", "499.00"], ["Board B", "599.50"]] as const) {
      await page.getByPlaceholder("65% hot-swappable keyboard").fill(product);
      await page.getByPlaceholder("Nova").fill("Brand");
      await page.locator("input.om-money").first().fill(price);
      await page.getByRole("button", { name: "Add listing" }).click();
      await page.getByRole("cell", { name: product, exact: true }).waitFor({ state: "visible" });
    }
    // Statistics ledger shows the deterministic values.
    await page.getByText("549.25").first().waitFor({ state: "visible" });
    expect(await page.getByText("549.25").count()).toBe(2);

    // Guide advanced to Step 4: Unit economics
    await expect(await page.locator(".om-guide__title").innerText()).toContain("Step 4 of 6: Unit economics");

    // --- economics: assumptions + prices, save, calculate via continuation button ---
    await page.getByRole("button", { name: "Continue to Economics →" }).click();
    const moneyInputs = page.locator("input.om-money");
    await moneyInputs.nth(0).fill("500.00"); // acquisition
    await moneyInputs.nth(1).fill("75.50"); // shipping
    await moneyInputs.nth(2).fill("20.00"); // other
    await moneyInputs.nth(3).fill("12.50"); // marketplace rate
    await moneyInputs.nth(4).fill("2.35"); // payment rate
    await moneyInputs.nth(5).fill("899.99"); // low
    await moneyInputs.nth(6).fill("1099.99"); // base
    await moneyInputs.nth(7).fill("1499.99"); // high
    await page.getByRole("button", { name: "Save assumptions" }).click();
    await page.getByRole("button", { name: "Calculate scenarios" }).click();
    await page.locator(".scenario").first().waitFor({ state: "visible", timeout: 30_000 });

    // The generated scenarios file lands on disk with exact values.
    const scenarios = JSON.parse(await readFile(join(projectRoot, "economics", "scenarios.json"), "utf8"));
    const base = scenarios.find((entry: { scenario: string }) => entry.scenario === "base");
    expect(base.totalCost).toBe("758.85");
    expect(base.grossProfit).toBe("341.14");

    // Guide advanced to Step 5: Opportunity report
    await expect(await page.locator(".om-guide__title").innerText()).toContain("Step 5 of 6: Opportunity report");

    // --- report: sections then generate via continuation button ---
    await page.getByRole("button", { name: "Continue to Report →" }).click();
    await page.getByRole("button", { name: "Generate report" }).click();
    await page.locator(".report-preview").first().waitFor({ state: "visible", timeout: 30_000 });
    const report = await readFile(join(projectRoot, "reports", "opportunity-report.md"), "utf8");
    expect(report).toContain("# Deep Flow");
    expect(report).toContain("| Base | INR 1099.99 | 758.85 | 341.14 | 31.01% |");

    // Walkthrough milestone reached!
    await expect(await page.locator(".om-guide__title").innerText()).toContain("Opportunity Report Generated");
    await expect(await page.locator(".om-guide__head-actions .om-badge").innerText()).toContain("6 of 6 complete");

    // Inspect artifacts via guide milestone button
    await page.getByRole("button", { name: "Inspect Project Artifacts →" }).click();
    await page.locator(".artifacts__list").waitFor({ state: "visible" });

    // Provenance journal gained records for both generated artifacts.
    const provenance = await readFile(join(projectRoot, ".openmerchant", "provenance.jsonl"), "utf8");
    expect(provenance).toContain("economics/scenarios.json");
    expect(provenance).toContain("reports/opportunity-report.md");
  });
});

describe("Open Merchant E2E persistence", () => {
  it("reopens a recent project with state intact after a full restart", async () => {
    await page.getByRole("button", { name: "Create a project" }).click();
    await page.getByPlaceholder("Mechanical keyboards India").fill("Persistent");
    await page.locator(".home__form textarea").fill("Check reopen behavior.");
    await page.locator(".home__form button[type='submit']").click();
    await page.locator(".shell__nav").first().waitFor({ state: "visible" });

    // Add one evidence source so the project has real content.
    await page.locator(".shell__nav").getByRole("button", { name: "Evidence" }).click();
    await page.getByRole("button", { name: "Add first source" }).click();
    await page.getByPlaceholder("https://…").fill("https://example.com/keep");
    await page.getByPlaceholder("Marketplace category page").fill("Kept source");
    await page.getByRole("button", { name: "Save source" }).click();

    // Close the app entirely before relaunching against the same user data.
    await electronApp.close();

    const second = await _electron.launch({
      args: ["./out/main/index.js"],
      env: { ...process.env, OPEN_MERCHANT_USER_DATA: userDataDir },
    });
    try {
      await second.evaluate(({ dialog }, parent) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [parent], bookmarks: [] });
      }, projectsParent);
      const page2 = await second.firstWindow();
      await page2.waitForLoadState("domcontentloaded");

      // The recents list shows the project; open it.
      await page2.getByRole("button", { name: /Persistent/ }).first().click();
      await page2.locator(".shell__nav").first().waitFor({ state: "visible", timeout: 10_000 });

      // Evidence survived the restart.
      await page2.locator(".shell__nav").getByRole("button", { name: "Evidence" }).click();
      await page2.getByText("Kept source").waitFor({ state: "visible" });
    } finally {
      await second.close();
    }
  });
});
