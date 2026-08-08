# Windows Manual Smoke Test

Run this checklist against a Windows 11 desktop build before a public showcase.

- [ ] Launch the desktop app on Windows 11.
- [ ] Create “Mechanical Keyboards India” in a chosen folder.
- [ ] Enter the research objective and confirm Saved.
- [ ] Add two evidence sources and three competitors.
- [ ] Confirm min, max, average, and median prices.
- [ ] Enter five cost inputs and low/base/high selling prices.
- [ ] Calculate scenarios and verify the base margin.
- [ ] Add observations, risks, and opportunities with source references.
- [ ] Generate the Markdown report.
- [ ] Inspect JSON, JSONL, CSV, Markdown, runs, and provenance in the app.
- [ ] Open the project folder in Explorer.
- [ ] Close the app, relaunch, reopen from Recents, and confirm all state.

## Production Build Checks

- [ ] `npm run tauri build -- --bundles nsis` completes.
- [ ] The NSIS installer exists and is non-empty.
- [ ] A fresh install launches Open Merchant.
- [ ] The installed app completes create → report → reopen.
- [ ] Uninstall removes the app but does not delete user project folders.
