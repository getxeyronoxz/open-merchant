import { chromium } from "playwright";

const out = process.argv[2] ?? ".";
const base = "http://localhost:5173";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/app-home.png` });
console.log("app-home.png");

// Create a project through the real UI (mock client in browser).
await page.getByRole("button", { name: "Create a project" }).click();
await page.getByPlaceholder("Mechanical keyboards India").fill("Mechanical Keyboards India");
await page
  .getByPlaceholder("What commercial decision are you making?")
  .fill("Should we enter the Indian enthusiast keyboard market this quarter?");
await page.getByRole("button", { name: "Create workspace" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/app-objective.png` });
console.log("app-objective.png");

// Evidence: add two sources.
await page.getByRole("button", { name: "Evidence" }).click();
await page.getByRole("button", { name: "Add source" }).click();
await page.getByPlaceholder("https://…").fill("https://example.com/keyboards/category");
await page.getByPlaceholder("Marketplace category page").fill("Marketplace category page");
await page.getByPlaceholder("What did you observe here?").fill("Entry boards start near INR 3,500; premium clusters above INR 12,000.");
await page.getByRole("button", { name: "Save source", exact: true }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Add source" }).click();
await page.getByPlaceholder("https://…").fill("https://forum.example.com/thread/4471");
await page.getByPlaceholder("Marketplace category page").fill("Community survey thread");
await page.getByRole("button", { name: "Save source", exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/app-evidence.png` });
console.log("app-evidence.png");

// Competitors: add three listings.
await page.getByRole("button", { name: "Competitors" }).click();
const form = page.locator("form").first();
const addListing = async (product, brand, price) => {
  await page.getByPlaceholder("65% hot-swappable keyboard").fill(product);
  await form.locator("input").nth(1).fill(brand);
  await form.locator("input.om-money").fill(price);
  await form.locator("input").nth(3).fill("Example Bazaar");
  await page.getByRole("button", { name: "Add listing" }).click();
  await page.waitForTimeout(400);
};
await addListing("Entry 60% board", "KeyNova", "3499.00");
await addListing("Mid 65% board", "KeebCraft", "4499.00");
await addListing("Premium 75% board", "AuroraKeys", "12499.00");
await page.screenshot({ path: `${out}/app-competitors.png` });
console.log("app-competitors.png");

// Economics: fill assumptions and calculate.
await page.getByRole("button", { name: "Economics" }).click();
const money = page.locator("input.om-money");
await money.nth(0).fill("1800.00");
await money.nth(1).fill("180.00");
await money.nth(2).fill("120.00");
await money.nth(3).fill("12.00");
await money.nth(4).fill("2.00");
await money.nth(5).fill("3499.00");
await money.nth(6).fill("4499.00");
await money.nth(7).fill("5499.00");
await page.getByRole("button", { name: "Save assumptions" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Calculate scenarios" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/app-economics.png` });
console.log("app-economics.png");

// Report: fill every section, generate, show the paper.
await page.getByRole("button", { name: "Report" }).click();
await page
  .getByPlaceholder("What did you decide, and why?")
  .fill("Enter with a limited first batch of 65% boards; validate supplier quotes before scaling.");
const listAreas = page.locator("form textarea");
await listAreas.nth(1).fill("Demand clusters around 65% layouts.\nBuyers cite lack of local warranty support.");
await listAreas.nth(2).fill("Import duties may erode margins.\nTwo dominant brands own shelf space.");
await listAreas.nth(3).fill("Bundle keycaps to lift average order value.\nTarget the warranty gap as a differentiator.");
await page.getByRole("button", { name: "Save sections" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Generate report" }).click();
await page.waitForTimeout(1200);
await page.evaluate(() => document.querySelector(".shell__scroll")?.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/app-report.png` });
console.log("app-report.png");

// Artifacts.
await page.getByRole("button", { name: "Artifacts" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /opportunity-report/ }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/app-artifacts.png` });
console.log("app-artifacts.png");

await browser.close();
