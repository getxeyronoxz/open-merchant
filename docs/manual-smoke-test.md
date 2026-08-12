# Windows Manual Smoke Test

Run this checklist against a Windows 11 desktop build before a public showcase. Use a disposable local folder; do not use commercially sensitive project data.

- [ ] Install and launch the desktop app on Windows 11.
- [ ] Confirm the Start menu, installed app window, and taskbar use the graphite-and-lime Open Merchant “M” icon.
- [ ] Create “Mechanical Keyboards India” in a chosen folder.
- [ ] Enter the research objective and confirm Saved.
- [ ] Add two evidence sources and three competitors.
- [ ] Confirm min, max, average, and median prices.
- [ ] Enter five cost inputs and low/base/high selling prices.
- [ ] Calculate scenarios and verify the base margin.
- [ ] Add observations, risks, and opportunities with source references.
- [ ] Generate the Markdown report.
- [ ] Inspect JSON, JSONL, CSV, Markdown, runs, and provenance in the app.
- [ ] Close the app, relaunch, reopen from Recents, and confirm all state.
- [ ] Tab through the home screen and each workspace form; focus is visible and each action is reachable.
- [ ] Enable Windows reduced-motion preference and confirm non-essential motion does not persist or obstruct use.

## Production Build Checks

- [ ] `npm run tauri build -- --bundles nsis` completes.
- [ ] The NSIS installer exists and is non-empty.
- [ ] A fresh install launches Open Merchant.
- [ ] The installed application shows the regenerated icon rather than a stale or generic Windows icon.
- [ ] The installed app completes create → report → reopen.
- [ ] Uninstall removes the app but does not delete user project folders.
