import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const out = process.argv[2] ?? ".";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await page.goto(pathToFileURL("_og.html").href);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/og-banner.png` });
console.log("og-banner.png done");
await browser.close();
