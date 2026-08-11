# Open Merchant V0 UI Modernization Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modernize the complete Open Merchant V0 frontend into a refined, accessible desktop workspace without changing product behavior, data, domain logic, or Tauri interfaces.

**Architecture:** Keep the existing feature-screen structure and `ProjectContext`. Add a small frontend-only visual system under `src/components/ui`, extract the workspace navigation into its own tested component, and keep async state local to each existing workflow. All data continues to flow through the existing `DesktopClient`; backend statistics and scenarios remain authoritative.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, CSS custom properties, Vitest, Testing Library, Tauri 2.

---

## Task 1: Establish the visual system and navigation behavior

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Icon.tsx`
- Create: `src/components/ui/Surface.tsx`
- Create: `src/components/ui/StatusMessage.tsx`
- Create: `src/components/ui/EmptyState.tsx`
- Create: `src/components/ui/DataDisplay.tsx`
- Create: `src/components/ui/index.ts`
- Create: `src/components/WorkspaceNavigation.tsx`
- Create: `src/components/WorkspaceNavigation.test.tsx`
- Modify: `src/styles.css`

1. Write a navigation test proving the selected item exposes `aria-current="page"`, the toggle changes its accessible expansion state, labels remain accessible while collapsed, and section clicks invoke the existing callback.
2. Run `npx vitest run src/components/WorkspaceNavigation.test.tsx` and confirm it fails because the component does not exist.
3. Implement the inline SVG icon set, shared primitives, tokens, focus styles, motion, reduced-motion override, and the smallest navigation component that passes the test.
4. Re-run the focused test and confirm it passes.
5. Run `npm run test:run` and `npm run build`.
6. Commit: `feat: add Open Merchant visual system`.

## Task 2: Modernize the workspace shell and home/objective flows

**Files:**
- Modify: `src/components/AppShell.tsx`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/HomeScreen.test.tsx`
- Modify: `src/features/objective/ObjectiveScreen.tsx`
- Modify: `src/features/objective/ObjectiveScreen.test.tsx`

1. Add failing tests for the shell's initially collapsed narrow-viewport state and expanded toggle state through `WorkspaceNavigation`, Home's in-flight create/open feedback, and Objective's accessible saving/error/retry status.
2. Run the focused tests and confirm they fail for the missing interaction states.
3. Replace the stacked shell with the responsive rail/content layout, preserving current section routing and project loading.
4. Recompose Home and Objective with the shared primitives, explicit status messages, and current workflow callbacks. Preserve entered values on failure.
5. Run the focused tests, then `npm run test:run` and `npm run build`.
6. Commit: `feat: modernize workspace shell and forms`.

## Task 3: Improve evidence and competitor workflows

**Files:**
- Modify: `src/features/evidence/EvidenceScreen.tsx`
- Modify: `src/features/evidence/EvidenceScreen.test.tsx`
- Modify: `src/features/competitors/CompetitorsScreen.tsx`
- Modify: `src/features/competitors/CompetitorsScreen.test.tsx`

1. Add failing tests proving save actions disable and announce progress, successful saves are announced, failed saves preserve the open draft, and empty-state actions open the existing editors.
2. Add a competitor presentation assertion using literal backend statistics and linked evidence context; do not recompute expected values in the test.
3. Run the focused tests and confirm the expected failures.
4. Implement structured editors, card/list empty states, contained tables, evidence titles, independent save/remove error handling, and accessible status feedback.
5. Confirm backend-provided min/median/average/max values render unchanged.
6. Run the focused tests, then `npm run test:run` and `npm run build`.
7. Commit: `feat: refine evidence and competitor research`.

## Task 4: Improve economics presentation without moving calculations

**Files:**
- Modify: `src/features/economics/EconomicsScreen.tsx`
- Modify: `src/features/economics/EconomicsScreen.test.tsx`

1. Add failing tests using deferred promises to prove Save and Calculate have independent disabled/loading/success/error states.
2. Add literal scenario fixtures proving selling price, total cost, gross profit, and margin render unchanged and are formatted only for display.
3. Run the focused test and confirm it fails against the current combined state.
4. Implement grouped cost/price panels, Calculate as the primary action, independent workflow states, and low/base/high result cards. Keep `onCalculate` authoritative and add no arithmetic in React.
5. Run the focused test, then `npm run test:run` and `npm run build`.
6. Commit: `feat: improve economics scenario presentation`.

## Task 5: Refine report generation and artifact inspection

**Files:**
- Modify: `src/features/report/ReportScreen.tsx`
- Modify: `src/features/report/ReportScreen.test.tsx`
- Modify: `src/features/artifacts/ArtifactsScreen.tsx`
- Modify: `src/features/artifacts/ArtifactsScreen.test.tsx`

1. Add failing tests proving report Save and Generate states are independent, generate failures preserve the draft, tabs expose semantic selected state, artifact loading is announced, and missing/history empty states remain distinct.
2. Run the focused tests and confirm they fail for the missing behavior.
3. Implement grouped report fields, separate status regions, disabled in-flight controls, readable Markdown preview, accessible tabs, selected-file state, file loading feedback, and improved run cards.
4. Run the focused tests, then `npm run test:run` and `npm run build`.
5. Commit: `feat: refine reports and local artifacts`.

## Task 6: Record the refresh and perform full verification

**Files:**
- Modify: `CHANGELOG.md`

1. Add one concise Unreleased Changed entry for the V0 interface refresh. Do not add marketing claims or new product documentation.
2. Run `git diff --check` and inspect the complete diff for scope violations.
3. Run:
   - `npm run test:run`
   - `npm run build`
   - `cargo fmt --all -- --check`
   - `cargo clippy --workspace --all-targets --all-features -- -D warnings`
   - `cargo test --workspace --all-targets --all-features`
   - `npm run tauri build -- --bundles nsis`
4. Inspect at 1280×800 and 960×640. Verify section reachability, contained table scrolling, keyboard focus, no clipped fields, and reduced-motion behavior.
5. Smoke-test the packaged app: open a project, navigate, view competitors, calculate economics, generate a report, and inspect an artifact.
6. Commit: `docs: record V0 interface refresh`.

## Task 7: Review and publish for founder review

1. Obtain `BASE_SHA=origin/main` and `HEAD_SHA=HEAD`.
2. Use superpowers:requesting-code-review with the approved design and this plan. Fix every Critical or Important finding and re-run affected tests.
3. Use superpowers:verification-before-completion and repeat the full verification commands on the final tree.
4. Confirm the branch is clean and ahead only by the intended commits.
5. Push `feat/modernize-v0-ui` to origin.
6. Open one ready pull request to `main` with a factual summary and exact verification evidence. Do not merge it.
