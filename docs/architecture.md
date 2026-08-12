# Open Merchant V0 Architecture

## Product boundary

Open Merchant is a Windows desktop workspace for local commerce research. It does not host a service or read remote marketplace pages. The selected project folder is the canonical record; the application provides structured editing, deterministic calculations, report generation, and safe inspection of known artifacts.

## Runtime path

```text
React + TypeScript UI
  -> src/lib/desktop.ts typed client
    -> Tauri commands
      -> src-tauri application services
        -> crates/merchant-core
        -> crates/merchant-workspace
          -> user-selected project folder
```

| Area | Responsibility |
| --- | --- |
| `src/` | Home screen, six-section workspace, accessible controls, and typed desktop-client calls. |
| `src-tauri/` | Tauri commands, native directory dialog, recent-project application data, and Windows packaging. |
| `crates/merchant-core/` | Validation, fixed-decimal economics, and competitor statistics. |
| `crates/merchant-workspace/` | Project layout, parsing, atomic writes, artifact access, runs, and provenance. |
| `examples/mechanical-keyboards-india/` | Explicit demo data for the documented workflow. |

## Canonical workspace

```text
project/
  merchant-project.json
  sources/sources.jsonl
  market/competitors.csv
  economics/assumptions.json
  economics/scenarios.csv
  reports/report-sections.json
  reports/opportunity-report.md
  .merchant/runs.jsonl
  .merchant/provenance.jsonl
```

Source records and assumptions are user-owned inputs. `scenarios.csv` and `opportunity-report.md` are generated from current saved inputs. Run and provenance records explain meaningful generation operations; the in-app artifact viewer intentionally restricts itself to this known layout.

## Deterministic rules

- Money and percentage values cross file boundaries as decimal strings.
- Rust owns validation and calculations. JavaScript numbers and AI are never used for commerce decisions.
- A project has one currency. Price statistics exclude unpriced listings.
- Malformed, unsupported, or out-of-layout files are rejected instead of silently changed.

## Desktop identity and accessibility

- `src-tauri/app-icon.svg` is the canonical Open Merchant app mark.
- `npm run tauri -- icon src-tauri/app-icon.svg --output src-tauri/icons` regenerates the bundled platform icons, including the Windows `.ico` file.
- Focusable controls use visible keyboard focus treatment; non-essential motion is disabled for `prefers-reduced-motion`.
- Save confirmations use polite live announcements where content changes without a full page load.

## Verification map

| Change area | Minimum verification |
| --- | --- |
| React behavior | Focused Vitest test, then `npm run test:run` and `npm run build` |
| Core/workspace rules | Focused Cargo test, then fmt, clippy, and workspace tests |
| App icon or installer | Regenerate icons, inspect `src-tauri/icons/icon.png`, then `npm run tauri build -- --bundles nsis` |
| User-facing desktop workflow | Follow [manual smoke test](manual-smoke-test.md) on Windows |
