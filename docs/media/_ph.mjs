// Product Hunt gallery generator — 1270x760 frames (PH's exact ratio) at 2x.
// Usage: node docs/media/_ph.mjs [outDir]
// Composes the existing app screenshots (docs/media/app-*.png) on the Ledger
// palette with launch headlines, mirroring the _og.html styling.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

const out = process.argv[2] ?? ".";
mkdirSync(out, { recursive: true });

const base = (headline, sub, screenshot, badges) => `
<!doctype html>
<html><head><meta charset="utf8"><style>
*{margin:0;box-sizing:border-box}
body{width:1270px;height:760px;background:#0c0f0d;color:#eef2ee;font-family:Georgia,'Times New Roman',serif;position:relative;overflow:hidden}
.glow{position:absolute;top:-240px;right:-180px;width:660px;height:660px;border-radius:50%;background:radial-gradient(circle,rgba(67,193,122,.10),transparent 65%)}
.glow2{position:absolute;bottom:-280px;left:-140px;width:560px;height:560px;border-radius:50%;background:radial-gradient(circle,rgba(201,162,39,.08),transparent 60%)}
.brand{position:absolute;left:56px;top:44px;display:flex;align-items:center;gap:13px;z-index:2}
.mark{width:32px;height:32px;border-radius:9px;background:#43c17a;color:#06130b;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:bold}
.name{font-size:24px;letter-spacing:.5px}
.name em{color:#43c17a;font-style:italic}
.rule{position:absolute;left:56px;right:56px;top:92px;height:1px;background:linear-gradient(90deg,#43c17a55,#c9a22733,transparent)}
.eyebrow{position:absolute;left:56px;top:118px;font-family:'Segoe UI',sans-serif;font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:#c9a227;z-index:2}
h1{position:absolute;left:56px;top:158px;font-weight:400;font-size:44px;line-height:1.16;width:1120px;z-index:2}
h1 em{font-style:italic;color:#c9a227}
.window{position:absolute;left:56px;top:296px;right:56px;bottom:44px;border:1px solid #2a332d;border-radius:12px;overflow:hidden;background:#070a08;box-shadow:0 24px 70px rgba(0,0,0,.55)}
.bar{height:34px;background:#101411;border-bottom:1px solid #2a332d;display:flex;align-items:center;gap:8px;padding:0 14px}
.dot{width:11px;height:11px;border-radius:50%}
.d1{background:#e5565b}.d2{background:#e0a53f}.d3{background:#43c17a}
.shot{position:absolute;inset:34px 0 0 0;width:100%;height:calc(100% - 34px);object-fit:cover;object-position:top left}
.badges{position:absolute;left:56px;bottom:auto;top:250px;display:flex;gap:10px;font-family:'Segoe UI',sans-serif;font-size:14px;z-index:3}
.badge{padding:6px 14px;border-radius:999px;border:1px solid #2a332d;color:#a3ada5;background:rgba(12,15,13,.85)}
.badge.acc{background:rgba(67,193,122,.13);border-color:transparent;color:#43c17a}
</style></head><body>
<div class="glow"></div><div class="glow2"></div>
<div class="brand"><div class="mark">◈</div><div class="name">Open <em>Merchant</em></div></div>
<div class="rule"></div>
<div class="eyebrow">Commerce research workbench · local-first · AI-native</div>
<h1>${headline}</h1>
${badges ? `<div class="badges">${badges.map((b, i) => `<span class="badge${i === 0 ? " acc" : ""}">${b}</span>`).join("")}</div>` : ""}
<div class="window"><div class="bar"><span class="dot d1"></span><span class="dot d2"></span><span class="dot d3"></span></div><img class="shot" src="${screenshot}"></div>
</body></html>`;

const badgeSets = {
  cover: ["AI drafts · you approve", "No accounts · no cloud · no telemetry", "Open source (AGPL)"],
  snap: ["Immutable captures", "Per-listing price history", "Any-two diff"],
  econ: ["Arbitrary-precision decimals", "Golden-fixture pinned", "No floating point"],
  ai: ["Six specialists", "Zod-validated drafts", "Provenance journaled"],
  diff: ["Side-by-side diff", "Stale-evidence flags", "Run journal search"],
  local: ["Your files, your machine", "BYO API key", "Keyless local AI"],
};

const slides = [
  {
    file: "ph-1-cover.png",
    html: base(
      "Is this opportunity worth <em>pursuing?</em> Decide with evidence in hand.",
      null,
      "app-home.png",
      badgeSets.cover,
    ),
  },
  {
    file: "ph-2-snapshots.png",
    html: base(
      "Market snapshots — capture the price history, <em>diff any two.</em>",
      null,
      "app-competitors.png",
      badgeSets.snap,
    ),
  },
  {
    file: "ph-3-economics.png",
    html: base(
      "Exact-decimal unit economics. <em>No floating point. Ever.</em>",
      null,
      "app-economics.png",
      badgeSets.econ,
    ),
  },
  {
    file: "ph-4-ai.png",
    html: base(
      "Six AI assistants draft it. <em>Nothing saves until you approve it.</em>",
      null,
      "app-evidence.png",
      badgeSets.ai,
    ),
  },
  {
    file: "ph-5-journal.png",
    html: base(
      "Every report diffed against the last. <em>Stale evidence flagged.</em>",
      null,
      "app-artifacts.png",
      badgeSets.diff,
    ),
  },
  {
    file: "ph-6-local.png",
    html: base(
      "Your files, your machine. <em>No accounts. No cloud. No telemetry.</em>",
      null,
      "app-report.png",
      badgeSets.local,
    ),
  },
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1270, height: 760 },
  deviceScaleFactor: 2,
});
const tmpHtml = new URL("./_ph-slide.html", import.meta.url);
for (const slide of slides) {
  // The slide HTML lives in docs/media so the app-*.png srcs resolve.
  writeFileSync(tmpHtml, slide.html);
  await page.goto(tmpHtml.href, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${slide.file}` });
  console.log(`${slide.file} done`);
}
rmSync(tmpHtml);
await browser.close();
