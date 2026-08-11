# Open Merchant Day 4 — V0 UI Modernization Design

**Status:** Approved for implementation

**Date:** 2026-08-11

**Base:** `main` at `d1e75d6`

**Feature branch:** `feat/modernize-v0-ui`

## Purpose

Modernize the existing Open Merchant V0 interface without changing its product behavior. The result should feel like a calm, premium Windows productivity workspace while preserving every existing workflow, Tauri command, data schema, deterministic calculation, artifact, and local-first ownership guarantee.

This is a presentation and interaction-quality milestone, not a product expansion.

## Existing Interface Assessment

The current V0 already exposes the complete vertical slice, but it is assembled from repeated one-off Tailwind classes. The visual hierarchy is shallow, forms and tables use inconsistent density, async feedback differs between screens, and the navigation changes from a desktop sidebar to a stacked block below 1024px. These issues are most visible at the supported 960×640 minimum window and on the dense Competitors, Economics, Report, and Artifacts screens.

The modernization will retain the current graphite-and-emerald identity while making it systematic and more legible.

## Visual Direction

- Dark-only graphite workspace with controlled emerald accents.
- Neutral surfaces progress from application background to rail, panel, inset panel, and interactive row.
- Emerald communicates selection, primary action, focus, and success; rose is reserved for destructive actions and errors.
- Balanced density: comfortable forms and cards, compact data rows, readable long-form Markdown.
- Clear type hierarchy with restrained weights, slightly tighter headings, readable body line height, and tabular numerals for money.
- No gradients, glow, ornamental motion, gaming motifs, or new visual dependencies.

## Internal Visual System

The frontend will gain a small internal component set covering all current V0 surfaces:

- `Button` and `IconButton` with primary, secondary, ghost, and danger treatments.
- `Field`, `Input`, `Textarea`, and `Select` conventions for labels, hints, validation, and disabled state.
- `Panel`, `InsetPanel`, `PageHeader`, `StatusMessage`, and `EmptyState` for consistent hierarchy and workflow feedback.
- `Tabs`, `StatCard`, and `TableContainer` for dense product data.
- A focused inline SVG icon set for navigation and actions; no icon package.

Shared CSS custom properties will define color, spacing intent, radii, shadows, focus rings, and a 150ms interaction duration. Components remain private to this frontend and do not become a package or Storybook library.

## Application Shell

The workspace uses a persistent two-column desktop layout at all supported widths. The navigation rail:

- starts expanded when the first rendered viewport is wider than 1100px and collapsed otherwise;
- can be expanded or collapsed with a labelled button;
- keeps the user's manual choice only for the current React session;
- shows an icon for every section, visible labels when expanded, and native tooltips when collapsed;
- marks the selected section with `aria-current="page"`;
- remains fully keyboard accessible.

At 960×640 the collapsed rail reserves approximately 76px and the content column uses `min-width: 0`, keeping forms reachable and tables horizontally scrollable inside their own containers rather than forcing the whole window sideways.

## Screen Treatment

### Home

Strengthen the product introduction without changing copy. Make creation and opening clearly distinct actions, use a focused project form after folder selection, show recent projects as interactive cards, and provide explicit loading and error feedback. Empty recent-project content should explain persistence without pretending data exists.

### Objective

Use a page header, a single focused editor surface, immutable currency context, and an `aria-live` status indicator for Saving, Saved, and Failed. The existing debounce and retry behavior remains unchanged.

### Evidence

Present source editing in a structured inset panel. Use consistent field groups, observation rows, and action states. Existing sources become readable cards with host, timestamp, observation count, and restrained row actions. The empty state directly invokes the existing Add source workflow.

### Competitors

Keep backend-provided deterministic statistics as the only source of min, median, average, and max values. Present them as four prominent statistic cards. The competitor editor is grouped and the table is contained, horizontally scrollable, and enriched with linked evidence titles. Rows receive hover and focused actions without changing their data.

### Economics

Separate shared cost assumptions from low/base/high selling prices. Saving assumptions remains available, while Calculate and save scenarios is visually primary. Saving and calculation have independent disabled/status states. Existing backend scenarios are rendered as low/base/high summaries with formatted currency, gross profit emphasis, and margin; no calculation is moved into React.

### Report

Group decision summary and list-style writing fields, maintain separate save and generate states, and disable only the action in flight. Generated Markdown appears in a dedicated readable preview. Draft content remains intact after failure.

### Artifacts and History

Use accessible tabs, an explicit selected-file state, a file list with generated/missing context, and a readable monospace viewer. History operations become structured run cards with distinct succeeded and interrupted treatments while preserving the existing recovery guidance.

## Async Feedback and Failure Handling

Each workflow owns its local async state. Actions use explicit text—Creating, Opening, Saving, Calculating, Generating, Saved, or Failed—and announce changes through `aria-live`. Only the currently running action is disabled. User-entered drafts survive errors and existing retries remain available. No data is optimistically committed before the existing client call succeeds.

## Accessibility and Motion

- Visible `:focus-visible` rings on every control and row action.
- Semantic headings, labels, navigation, tabs, tables, status, and alert roles.
- Minimum practical 40px pointer targets for primary controls.
- Color is never the only status signal.
- Hover, pressed, disclosure, and status transitions use 150ms timing.
- `prefers-reduced-motion: reduce` disables nonessential transitions and scrolling animation.

## Boundaries

No changes are permitted to Rust crates, Tauri commands, `DesktopClient`, project formats, storage paths, reports, calculations, provenance semantics, or app/logo assets. No accounts, AI, scraping, integrations, cloud functionality, themes, mobile design, or V1 features are introduced.

## Verification

Behavioral tests will cover navigation collapse/current state, in-flight/disabled/success/error states, existing empty-state entry points, and unchanged competitor/economics outputs. Existing workflow tests must remain green.

Final verification includes the frontend suite/build, Rust formatting/lint/tests, NSIS packaging, responsive review at 1280×800 and 960×640, keyboard/focus and reduced-motion inspection, and a packaged-app smoke test of the complete existing workflow.
