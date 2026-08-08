# Open Merchant V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a demo-ready Windows desktop application that creates, edits, persists, reopens, calculates, reports, and exposes an Open Merchant product-research workspace as normal local files.

**Architecture:** React and TypeScript render one desktop workspace and communicate through a typed desktop client. Tauri commands call a Rust application service, which coordinates a pure `merchant-core` crate and a filesystem-focused `merchant-workspace` crate. All financial and competitor calculations run in Rust with decimal arithmetic.

**Tech Stack:** Tauri 2, React, TypeScript, Vite, Tailwind CSS v4, Rust stable MSVC, rust_decimal, serde, csv, Vitest, React Testing Library, Cargo tests, npm, NSIS, Windows 11 x64.

## Global Constraints

- Target Windows 11 x64 first; keep `merchant-core` and `merchant-workspace` free of Windows and Tauri dependencies.
- Use the installed Node 24.18.1 and npm 11.16.0; install Rust stable MSVC only because Rust, Cargo, and rustup were absent during environment inspection.
- Use Tauri major version 2 and commit `package-lock.json` and `Cargo.lock`.
- Keep canonical project state in normal JSON, JSONL, CSV, and Markdown files; do not add SQLite.
- Use one ISO 4217 currency per project, default INR.
- Serialize money and percentage values as decimal strings; never use JavaScript or Rust binary floating-point for commerce math.
- Support exactly three selling-price scenarios: low, base, and high.
- Generate report narrative only from user-authored text; do not add AI, scraping, accounts, cloud sync, integrations, or any excluded V0 feature.
- Keep modal/editor drafts local until their explicit Save action; persist each committed record immediately and debounce project-level free-text saves for 500 milliseconds.
- Write a failing test before each behavior change, observe the expected failure, implement the minimum passing behavior, rerun the focused test, then run the relevant suite.
- Keep commits small and limited to one task.
- Tasks 1–18 are the public-prototype gate. Do not start Tasks 19–21 until Tasks 1–18 pass the acceptance smoke test and a Windows production build launches.

---

## File and Responsibility Map

### Root

- `.gitattributes` — LF normalization for source and workspace fixtures.
- `.gitignore` — Node, Rust, Tauri, test, and generated screenshot exclusions.
- `Cargo.toml` — Rust workspace containing core, workspace, and Tauri crates.
- `Cargo.lock` — locked Rust dependency graph.
- `rust-toolchain.toml` — stable MSVC Rust channel.
- `package.json` / `package-lock.json` — frontend, test, and Tauri CLI dependencies and scripts.
- `vite.config.ts` — React, Tailwind, Vite, and Vitest configuration.
- `tsconfig*.json` — strict TypeScript configurations.
- `index.html` — local bundled application entry point.
- `LICENSE` — MIT license.
- `README.md` — product, setup, build, workspace format, and limitations.

### Pure commerce core

- `crates/merchant-core/src/lib.rs` — public exports.
- `crates/merchant-core/src/model.rs` — versioned project, evidence, competitor, economics, and report input types.
- `crates/merchant-core/src/validation.rs` — domain validation and `DomainError`.
- `crates/merchant-core/src/statistics.rs` — deterministic competitor statistics.
- `crates/merchant-core/src/economics.rs` — deterministic unit economics.
- `crates/merchant-core/src/report.rs` — deterministic Markdown renderer.

### Workspace storage

- `crates/merchant-workspace/src/lib.rs` — public `Workspace` API and exports.
- `crates/merchant-workspace/src/error.rs` — path-aware `WorkspaceError`.
- `crates/merchant-workspace/src/paths.rs` — fixed relative artifact paths and safe path resolution.
- `crates/merchant-workspace/src/atomic.rs` — adjacent temporary-file writes and replacement.
- `crates/merchant-workspace/src/project.rs` — create/open/load/save project source data.
- `crates/merchant-workspace/src/artifacts.rs` — artifact inventory and safe text reads.
- `crates/merchant-workspace/src/history.rs` — basic run/provenance records and JSONL append.

### Tauri/application boundary

- `src-tauri/src/application/mod.rs` — application exports.
- `src-tauri/src/application/service.rs` — workflows coordinating core and workspace.
- `src-tauri/src/application/recent_projects.rs` — recent-project JSON store.
- `src-tauri/src/commands.rs` — serializable Tauri commands.
- `src-tauri/src/platform/windows.rs` — Explorer integration.
- `src-tauri/src/lib.rs` — Tauri builder, state, plugins, and command registration.
- `src-tauri/src/main.rs` — desktop executable entry point.
- `src-tauri/capabilities/default.json` — minimum main-window permissions.
- `src-tauri/tauri.conf.json` — app identity, window, frontend commands, and NSIS bundle.

### React desktop UI

- `src/types.ts` — DTOs matching camel-case Rust command payloads.
- `src/lib/desktop.ts` — `DesktopClient`, real Tauri implementation, and native folder dialogs.
- `src/context/ProjectContext.tsx` — one-open-project state and mutation actions.
- `src/hooks/useDebouncedSave.ts` — 500 ms save state machine.
- `src/components/AppShell.tsx` — top bar, sidebar, save state, and active section.
- `src/features/home/HomeScreen.tsx` — create, open, and recent projects.
- `src/features/objective/ObjectiveScreen.tsx` — project metadata editor.
- `src/features/evidence/EvidenceScreen.tsx` — evidence list and editor.
- `src/features/competitors/CompetitorsScreen.tsx` — editable competitor grid and statistics.
- `src/features/economics/EconomicsScreen.tsx` — assumptions, prices, and calculated scenarios.
- `src/features/report/ReportScreen.tsx` — structured narrative, generation, and Markdown preview.
- `src/features/artifacts/ArtifactsScreen.tsx` — artifact tree, text viewer, run list, and provenance summary.
- `src/App.tsx` — home/workspace state switch.
- `src/styles.css` — Tailwind import, theme tokens, and global desktop styles.
- Tests live beside the corresponding frontend files as `*.test.tsx`.

### Showcase and verification

- `examples/mechanical-keyboards-india/**` — complete portable example workspace.
- `docs/manual-smoke-test.md` — repeatable vertical-slice and installer checklist.
- `docs/demo-script.md` — 30–60 second public demo sequence.
- `docs/screenshots/*.png` — three real application screenshots.
- `.github/workflows/windows.yml` — optional Task 21 CI only.

### Shared test support

- `crates/merchant-core/tests/support/mod.rs` — exports `fixed_time() -> DateTime<Utc>`, `competitors_with_prices(prices: &[&str]) -> Vec<Competitor>`, `competitors_without_prices(count: usize) -> Vec<Competitor>`, `fixture_assumptions(acquisition: &str, shipping: &str, marketplace_rate: &str, payment_rate: &str, other: &str, prices: [&str; 3]) -> CostAssumptions`, `valid_assumptions() -> CostAssumptions`, `complete_report_input(run_id: &str, generated_at: DateTime<Utc>) -> ReportInput`, and `report_input_with_empty_narrative() -> ReportInput`.
- `crates/merchant-workspace/tests/support/mod.rs` — exports `TestWorkspace`, which owns a `tempfile::TempDir` and dereferences to `Workspace`; `fixture_workspace()` returns an empty valid project, `complete_fixture_workspace()` and `generated_fixture_workspace()` return generated projects, `repo_root()` resolves the repository root, and optional hardening tasks add `externally_edited_manifest_json()` plus `simulate_interruption_after_staging(&Workspace)`.
- `src-tauri/tests/support/mod.rs` — exports `ServiceFixture { temp, service, root }`, `empty_service_fixture()`, `complete_service_fixture()`, `complete_evidence()`, `complete_competitors()`, `complete_assumptions()`, and `complete_report_sections()`.
- `src/test/fixtures.ts` — exports `mechanicalKeyboardSnapshot`, `sampleEvidence`, `emptyAssumptions`, `sampleStatistics`, `competitorsProps`, `reportRun`, and `reportProvenance`.
- `src/test/fakeDesktopClient.ts` — exports `createFakeDesktopClient()`; every method is a typed Vitest mock with a safe empty default.

Use one fixed test timestamp, `2026-08-08T00:00:00Z`, and UUID `00000000-0000-0000-0000-000000000001`. Each frontend test creates `const user = userEvent.setup()` and the specifically named `vi.fn()` callbacks used by that test. Create or extend each support file in the first task that needs its types.

### Stable application contract

The service and `DesktopClient` grow task-by-task but keep these final method names and payloads:

~~~rust
pub struct CreateProjectRequest {
    pub parent_directory: String,
    pub name: String,
    pub objective: String,
    pub currency: String,
}

impl MerchantService {
    pub fn create_project(&self, request: CreateProjectRequest) -> Result<ProjectSnapshot, AppError>;
    pub fn open_project(&self, root: &str) -> Result<ProjectSnapshot, AppError>;
    pub fn list_recent_projects(&self) -> Result<Vec<RecentProject>, AppError>;
    pub fn remove_recent_project(&self, root: &str) -> Result<(), AppError>;
    pub fn save_manifest(&self, root: &str, value: ProjectManifest) -> Result<ProjectSnapshot, AppError>;
    pub fn save_evidence(&self, root: &str, value: Vec<EvidenceSource>) -> Result<ProjectSnapshot, AppError>;
    pub fn save_competitors(&self, root: &str, value: Vec<Competitor>) -> Result<ProjectSnapshot, AppError>;
    pub fn save_assumptions(&self, root: &str, value: CostAssumptions) -> Result<ProjectSnapshot, AppError>;
    pub fn save_report_sections(&self, root: &str, value: ReportSections) -> Result<ProjectSnapshot, AppError>;
    pub fn calculate_and_save_scenarios(&self, root: &str) -> Result<Vec<EconomicsScenario>, AppError>;
    pub fn generate_report(&self, root: &str) -> Result<GeneratedReport, AppError>;
    pub fn list_artifacts(&self, root: &str) -> Result<Vec<ArtifactDescriptor>, AppError>;
    pub fn read_artifact(&self, root: &str, relative_path: &str) -> Result<String, AppError>;
    pub fn list_runs(&self, root: &str) -> Result<Vec<RunRecord>, AppError>;
    pub fn list_provenance(&self, root: &str) -> Result<Vec<ProvenanceRecord>, AppError>;
}
~~~

Every Tauri command uses the snake-case form of its service method and serializes fields with `#[serde(rename_all = "camelCase")]`. `DesktopClient` uses the camel-case form with matching TypeScript DTOs. No component invokes Tauri outside `src/lib/desktop.ts`.

---

### Task 1: Bootstrap the Tauri, React, and Rust Workspace

**Files:**
- Create: root configuration files listed above
- Create: `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`, `src/styles.css`, `src/test/setup.ts`
- Create: minimal crate and Tauri entry files from the file map

**Interfaces:**
- Produces: `npm test`, `npm run build`, `cargo test --workspace`, and `npm run tauri dev`
- Produces: `merchant_core::SCHEMA_VERSION: u32`

- [ ] **Step 1: Verify prerequisites and install only missing Rust**

~~~powershell
node --version
npm --version
rustup --version
if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) {
  winget install --id Rustlang.Rustup -e --accept-package-agreements --accept-source-agreements
}
rustup default stable-x86_64-pc-windows-msvc
rustc --version
cargo --version
~~~

Expected: Node reports `v24.18.1`; Rust and Cargo report stable MSVC versions. Restart the terminal once if the new Rust PATH is not visible.

- [ ] **Step 2: Create manifests and install locked frontend dependencies**

Create `package.json` with these scripts:

~~~json
{
  "name": "open-merchant",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "tauri": "tauri"
  }
}
~~~

Run:

~~~powershell
npm install react react-dom @tauri-apps/api@^2 @tauri-apps/plugin-dialog@^2 @tauri-apps/plugin-opener@^2 react-markdown
npm install --save-dev typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event tailwindcss @tailwindcss/vite @tauri-apps/cli@^2 @types/react @types/react-dom
~~~

Create root `Cargo.toml`:

~~~toml
[workspace]
members = ["crates/merchant-core", "crates/merchant-workspace", "src-tauri"]
resolver = "2"
~~~

- [ ] **Step 3: Write the failing frontend smoke test**

~~~tsx
// src/App.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("identifies the product as a workspace, not a chatbot", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Open Merchant" })).toBeInTheDocument();
    expect(screen.getByText("Local commerce research workspace")).toBeInTheDocument();
  });
});
~~~

- [ ] **Step 4: Run the smoke test and observe failure**

~~~powershell
npm test -- --run src/App.test.tsx
~~~

Expected: FAIL because the test setup and `App` content do not exist yet.

- [ ] **Step 5: Add the minimal frontend and test configuration**

~~~tsx
// src/App.tsx
export default function App() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <h1>Open Merchant</h1>
      <p>Local commerce research workspace</p>
    </main>
  );
}
~~~

~~~ts
// src/test/setup.ts
import "@testing-library/jest-dom/vitest";
~~~

Configure `vite.config.ts` with React, `tailwindcss()`, ignored `src-tauri` watching, and Vitest `jsdom` plus `src/test/setup.ts`. Import `@import "tailwindcss";` from `src/styles.css`.

- [ ] **Step 6: Add the minimal Rust crates and verify all builds**

~~~rust
// crates/merchant-core/src/lib.rs
pub const SCHEMA_VERSION: u32 = 1;

#[cfg(test)]
mod tests {
    #[test]
    fn schema_version_starts_at_one() {
        assert_eq!(super::SCHEMA_VERSION, 1);
    }
}
~~~

Create minimal `merchant-workspace` and Tauri library crates that depend on `merchant-core`; configure `tauri.conf.json` with identifier `com.openmerchant.desktop`, dev URL `http://localhost:1420`, frontend command `npm run dev`, and build command `npm run build`.

Run:

~~~powershell
npm test -- --run src/App.test.tsx
npm run build
cargo test --workspace
~~~

Expected: all commands PASS.

- [ ] **Step 7: Commit the bootstrap**

~~~powershell
git add -- .gitattributes .gitignore Cargo.toml Cargo.lock rust-toolchain.toml package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html src src-tauri crates
git commit -m "chore: bootstrap Open Merchant desktop workspace"
~~~

### Task 2: Create and Reopen a Project Workspace

**Files:**
- Create: `crates/merchant-core/src/model.rs`, `crates/merchant-core/src/validation.rs`
- Create: `crates/merchant-workspace/src/error.rs`, `paths.rs`, `atomic.rs`, `project.rs`
- Modify: both crate `lib.rs` files
- Test: `crates/merchant-workspace/tests/project_lifecycle.rs`

**Interfaces:**
- Produces: `ProjectManifest`, `ProjectSnapshot`, `Workspace::create(parent, name, objective, currency)`, `Workspace::open(root)`, `Workspace::load_snapshot()`
- Produces fixed relative paths: `merchant-project.json`, source files, generated files, and history files from the spec

- [ ] **Step 1: Write the failing project lifecycle test**

~~~rust
#[test]
fn create_then_open_preserves_manifest_and_layout() {
    let temp = tempfile::tempdir().unwrap();
    let workspace = Workspace::create(
        temp.path(),
        "Mechanical Keyboards India",
        "Would selling mechanical keyboards in India be commercially attractive?",
        "INR",
    ).unwrap();

    assert!(workspace.root().join("merchant-project.json").is_file());
    assert!(workspace.root().join("sources/sources.jsonl").is_file());
    assert!(workspace.root().join("market/competitors.csv").is_file());
    assert!(workspace.root().join("economics/assumptions.json").is_file());
    assert!(workspace.root().join("reports/report-sections.json").is_file());

    let reopened = Workspace::open(workspace.root()).unwrap();
    let snapshot = reopened.load_snapshot().unwrap();
    assert_eq!(snapshot.manifest.name, "Mechanical Keyboards India");
    assert_eq!(snapshot.manifest.currency, "INR");
}
~~~

- [ ] **Step 2: Run the focused test and observe failure**

~~~powershell
cargo test -p merchant-workspace --test project_lifecycle
~~~

Expected: FAIL because `Workspace`, models, and layout creation are undefined.

- [ ] **Step 3: Define the exact project interfaces**

~~~rust
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectManifest {
    pub schema_version: u32,
    pub project_id: Uuid,
    pub name: String,
    pub objective: String,
    pub currency: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub root: String,
    pub manifest: ProjectManifest,
}
~~~

Add `validate_project_name`, `validate_objective`, and `validate_currency`; accept a non-empty name/objective and exactly three ASCII uppercase currency letters.

- [ ] **Step 4: Implement the minimal file-first workspace**

Implement:

~~~rust
impl Workspace {
    pub fn create(
        parent: &Path,
        name: &str,
        objective: &str,
        currency: &str,
    ) -> Result<Self, WorkspaceError>;

    pub fn open(root: impl AsRef<Path>) -> Result<Self, WorkspaceError>;
    pub fn root(&self) -> &Path;
    pub fn load_snapshot(&self) -> Result<ProjectSnapshot, WorkspaceError>;
}
~~~

Use a lowercase hyphenated sanitized folder name; stop with `WorkspaceError::AlreadyExists` if it exists. Create every source-data directory and file. Use adjacent `.tmp` files and rename only after complete serialization.

- [ ] **Step 5: Run lifecycle and workspace tests**

~~~powershell
cargo test -p merchant-workspace --test project_lifecycle
cargo test --workspace
~~~

Expected: PASS, including a second test proving an existing folder is not overwritten.

- [ ] **Step 6: Commit project lifecycle**

~~~powershell
git add -- crates/merchant-core crates/merchant-workspace Cargo.lock
git commit -m "feat: create and reopen project workspaces"
~~~

### Task 3: Add Project Lifecycle Commands and Recent Projects

**Files:**
- Create: `src-tauri/src/application/mod.rs`, `service.rs`, `recent_projects.rs`
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/tests/project_commands.rs`

**Interfaces:**
- Consumes: `Workspace::create`, `Workspace::open`, `ProjectSnapshot`
- Produces: `MerchantService::create_project`, `open_project`, `list_recent_projects`, `remove_recent_project`
- Produces Tauri commands with the same snake-case names and camel-case payload fields

- [ ] **Step 1: Write a failing recent-project and service test**

~~~rust
#[test]
fn creating_and_opening_projects_updates_recent_paths() {
    let temp = tempfile::tempdir().unwrap();
    let recents = RecentProjectsStore::new(temp.path().join("recent-projects.json"));
    let service = MerchantService::new(recents);

    let snapshot = service.create_project(CreateProjectRequest {
        parent_directory: temp.path().to_string_lossy().into_owned(),
        name: "Mechanical Keyboards India".into(),
        objective: "Assess the India opportunity".into(),
        currency: "INR".into(),
    }).unwrap();

    assert_eq!(service.list_recent_projects().unwrap()[0].path, snapshot.root);
    assert_eq!(service.open_project(&snapshot.root).unwrap().manifest.name, snapshot.manifest.name);
}
~~~

- [ ] **Step 2: Run and observe failure**

~~~powershell
cargo test -p open-merchant --test project_commands
~~~

Expected: FAIL because the application service is not defined.

- [ ] **Step 3: Implement the service and atomic recent-project store**

Define:

~~~rust
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub last_opened_at: DateTime<Utc>,
}

impl MerchantService {
    pub fn new(recents: RecentProjectsStore) -> Self;
    pub fn create_project(&self, request: CreateProjectRequest) -> Result<ProjectSnapshot, AppError>;
    pub fn open_project(&self, root: &str) -> Result<ProjectSnapshot, AppError>;
    pub fn list_recent_projects(&self) -> Result<Vec<RecentProject>, AppError>;
    pub fn remove_recent_project(&self, root: &str) -> Result<(), AppError>;
}
~~~

Store recents at Tauri's roaming application-data path in production and inject a temporary path in tests.

- [ ] **Step 4: Register thin Tauri commands**

Each command accepts `State<MerchantService>`, calls one service method, and maps `AppError` to a serializable `CommandError { code, message, detail }`. Do not place domain or filesystem logic in `commands.rs`.

- [ ] **Step 5: Run tests and compile the Tauri crate**

~~~powershell
cargo test -p open-merchant --test project_commands
cargo test --workspace
~~~

Expected: PASS.

- [ ] **Step 6: Commit application lifecycle commands**

~~~powershell
git add -- src-tauri Cargo.lock
git commit -m "feat: expose project lifecycle commands"
~~~

### Task 4: Build the Create/Open/Reopen Desktop Flow

**Files:**
- Create: `src/types.ts`, `src/lib/desktop.ts`, `src/context/ProjectContext.tsx`
- Create: `src/features/home/HomeScreen.tsx`, `HomeScreen.test.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: lifecycle Tauri commands from Task 3
- Produces: `DesktopClient`, `ProjectProvider`, and the first complete UI flow

- [ ] **Step 1: Define the client contract**

~~~ts
export interface CreateProjectInput {
  parentDirectory: string;
  name: string;
  objective: string;
  currency: string;
}

export interface ProjectSnapshot {
  root: string;
  manifest: {
    schemaVersion: number;
    projectId: string;
    name: string;
    objective: string;
    currency: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface DesktopClient {
  chooseDirectory(title: string): Promise<string | null>;
  createProject(input: CreateProjectInput): Promise<ProjectSnapshot>;
  openProject(root: string): Promise<ProjectSnapshot>;
  listRecentProjects(): Promise<RecentProject[]>;
  removeRecentProject(root: string): Promise<void>;
}
~~~

- [ ] **Step 2: Write the failing create/open UI test**

~~~tsx
it("creates a project and enters the workspace", async () => {
  const client = createFakeDesktopClient();
  client.chooseDirectory.mockResolvedValue("C:/Research");
  client.createProject.mockResolvedValue(mechanicalKeyboardSnapshot);

  render(<App client={client} />);
  await user.click(screen.getByRole("button", { name: "Create project" }));
  await user.type(screen.getByLabelText("Project name"), "Mechanical Keyboards India");
  await user.type(screen.getByLabelText("Research objective"), "Assess the India opportunity");
  await user.click(screen.getByRole("button", { name: "Create workspace" }));

  expect(await screen.findByText("Mechanical Keyboards India")).toBeInTheDocument();
  expect(screen.getByText("Objective")).toBeInTheDocument();
});
~~~

- [ ] **Step 3: Run and observe failure**

~~~powershell
npm test -- --run src/features/home/HomeScreen.test.tsx
~~~

Expected: FAIL because the client, provider, and screen do not exist.

- [ ] **Step 4: Implement the minimal home and project context**

Use `@tauri-apps/plugin-dialog.open({ directory: true, multiple: false, title })` only inside `src/lib/desktop.ts`. Keep `App` injectable:

~~~tsx
export default function App({ client = tauriDesktopClient }: { client?: DesktopClient }) {
  return (
    <ProjectProvider client={client}>
      <AppRouter />
    </ProjectProvider>
  );
}
~~~

Show create form, open-folder action, and recent project buttons. When open succeeds, switch to an `AppShell` placeholder with the six section names.

- [ ] **Step 5: Verify UI and production frontend build**

~~~powershell
npm test -- --run src/features/home/HomeScreen.test.tsx
npm run build
~~~

Expected: PASS.

- [ ] **Step 6: Manually verify the first user milestone**

~~~powershell
npm run tauri dev
~~~

Create a project, close the app, launch again, and reopen it from Recents. Confirm the manifest remains on disk.

- [ ] **Step 7: Commit create/open/reopen UI**

~~~powershell
git add -- src src-tauri/capabilities src-tauri/tauri.conf.json package.json package-lock.json
git commit -m "feat: add create open and reopen flow"
~~~

### Task 5: Persist the Research Objective

**Files:**
- Create: `src/hooks/useDebouncedSave.ts`, `useDebouncedSave.test.tsx`
- Create: `src/components/AppShell.tsx`
- Create: `src/features/objective/ObjectiveScreen.tsx`, `ObjectiveScreen.test.tsx`
- Modify: `crates/merchant-workspace/src/project.rs`, `src-tauri/src/application/service.rs`, `src-tauri/src/commands.rs`, `src/types.ts`, `src/lib/desktop.ts`

**Interfaces:**
- Produces: `Workspace::save_manifest(&ProjectManifest)`
- Produces: `MerchantService::save_manifest(root, manifest)`
- Produces: `useDebouncedSave(value, save, 500)` returning `idle | saving | saved | error`

- [ ] **Step 1: Write failing Rust and UI tests**

~~~rust
#[test]
fn saving_manifest_survives_reopen() {
    let workspace = fixture_workspace();
    let mut snapshot = workspace.load_snapshot().unwrap();
    snapshot.manifest.objective = "Updated commercial question".into();
    workspace.save_manifest(&snapshot.manifest).unwrap();
    assert_eq!(
        workspace.load_snapshot().unwrap().manifest.objective,
        "Updated commercial question"
    );
}
~~~

~~~tsx
it("debounces objective persistence and shows saved status", async () => {
  vi.useFakeTimers();
  render(<ObjectiveScreen snapshot={mechanicalKeyboardSnapshot} onSave={save} />);
  await user.clear(screen.getByLabelText("Research objective"));
  await user.type(screen.getByLabelText("Research objective"), "Updated objective");
  await vi.advanceTimersByTimeAsync(500);
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ objective: "Updated objective" }));
  expect(await screen.findByText("Saved")).toBeInTheDocument();
});
~~~

- [ ] **Step 2: Run both tests and observe failure**

~~~powershell
cargo test -p merchant-workspace saving_manifest_survives_reopen
npm test -- --run src/features/objective/ObjectiveScreen.test.tsx
~~~

Expected: both FAIL on missing save behavior.

- [ ] **Step 3: Implement validated atomic manifest saving**

Validate name, objective, and currency in Rust; retain `project_id` and `created_at`; update `updated_at`; write atomically. Expose the command through `DesktopClient.saveManifest(root, manifest)`.

- [ ] **Step 4: Implement the 500 ms save hook and objective form**

The hook cancels an older timer, never overlaps saves, retains dirty state after error, and exposes a retry function. Currency editing is disabled once priced records exist; until those records are available, it remains editable.

- [ ] **Step 5: Rerun focused and relevant suites**

~~~powershell
cargo test -p merchant-workspace
npm test -- --run src/hooks/useDebouncedSave.test.tsx src/features/objective/ObjectiveScreen.test.tsx
npm run build
~~~

Expected: PASS.

- [ ] **Step 6: Commit objective persistence**

~~~powershell
git add -- crates/merchant-workspace src-tauri src
git commit -m "feat: persist project objective"
~~~

### Task 6: Add Evidence Records

**Files:**
- Modify: `crates/merchant-core/src/model.rs`, `validation.rs`
- Modify: `crates/merchant-workspace/src/project.rs`
- Modify: application service, commands, TypeScript DTOs, and desktop client
- Create: `src/features/evidence/EvidenceScreen.tsx`, `EvidenceScreen.test.tsx`
- Test: `crates/merchant-workspace/tests/evidence_jsonl.rs`

**Interfaces:**
- Produces: `EvidenceSource`, `Observation`
- Produces: `Workspace::load_evidence()`, `save_evidence(&[EvidenceSource])`
- Produces: `DesktopClient.saveEvidence(root, evidence)`

- [ ] **Step 1: Write the failing JSONL round-trip test**

~~~rust
#[test]
fn evidence_round_trips_as_one_json_object_per_line() {
    let workspace = fixture_workspace();
    let evidence = vec![EvidenceSource {
        schema_version: 1,
        id: "S-001".into(),
        url: "https://example.com/keyboard".into(),
        title: "Keyboard listing".into(),
        notes: "Observed retail listing".into(),
        observations: vec![Observation {
            id: "O-001".into(),
            label: "Listed price".into(),
            value: "7499".into(),
            unit: Some("INR".into()),
            note: String::new(),
        }],
        observed_at: fixed_time(),
        created_at: fixed_time(),
        updated_at: fixed_time(),
    }];

    workspace.save_evidence(&evidence).unwrap();
    assert_eq!(workspace.load_evidence().unwrap(), evidence);
    assert_eq!(
        std::fs::read_to_string(workspace.root().join("sources/sources.jsonl"))
            .unwrap()
            .lines()
            .count(),
        1
    );
}
~~~

- [ ] **Step 2: Run and observe failure**

~~~powershell
cargo test -p merchant-workspace --test evidence_jsonl
~~~

Expected: FAIL because evidence types and persistence are missing.

- [ ] **Step 3: Implement evidence validation and JSONL persistence**

Require a unique `S-` ID, `http` or `https` URL, non-empty title, and timestamp. Permit empty notes and observations. Rewrite the entire JSONL file atomically after successful serialization of every record.

- [ ] **Step 4: Write the failing evidence UI test**

~~~tsx
it("adds an evidence record and persists it", async () => {
  render(<EvidenceScreen evidence={[]} onSave={saveEvidence} />);
  await user.click(screen.getByRole("button", { name: "Add source" }));
  await user.type(screen.getByLabelText("Source URL"), "https://example.com/keyboard");
  await user.type(screen.getByLabelText("Source title"), "Keyboard listing");
  await user.click(screen.getByRole("button", { name: "Save source" }));
  expect(saveEvidence).toHaveBeenCalledWith([
    expect.objectContaining({ id: "S-001", title: "Keyboard listing" }),
  ]);
});
~~~

- [ ] **Step 5: Implement the evidence list/editor**

Generate the next stable ID from the highest existing numeric suffix, retain IDs during edits, confirm deletion, and display title, URL host, observed date, and observation count. Wire save through the project context and Rust command.

- [ ] **Step 6: Verify evidence persistence**

~~~powershell
cargo test -p merchant-workspace --test evidence_jsonl
npm test -- --run src/features/evidence/EvidenceScreen.test.tsx
npm run build
~~~

Expected: PASS.

- [ ] **Step 7: Commit evidence**

~~~powershell
git add -- crates/merchant-core crates/merchant-workspace src-tauri src
git commit -m "feat: add evidence records"
~~~

### Task 7: Add the Competitor Table

**Files:**
- Modify: `crates/merchant-core/src/model.rs`, `validation.rs`
- Modify: `crates/merchant-workspace/src/project.rs`
- Modify: application service, commands, DTOs, and desktop client
- Create: `src/features/competitors/CompetitorsScreen.tsx`, `CompetitorsScreen.test.tsx`
- Test: `crates/merchant-workspace/tests/competitor_csv.rs`

**Interfaces:**
- Produces: `DecimalString`, `Competitor`
- Produces: `Workspace::load_competitors()`, `save_competitors(&[Competitor])`
- Produces: `DesktopClient.saveCompetitors(root, competitors)`

- [ ] **Step 1: Write the failing CSV round-trip test**

~~~rust
#[test]
fn competitor_csv_preserves_money_unicode_commas_and_quotes() {
    let workspace = fixture_workspace();
    let competitors = vec![Competitor {
        schema_version: 1,
        id: "C-001".into(),
        product: "K2, hot-swappable".into(),
        brand: "Keychron".into(),
        price: Some(DecimalString::parse("7499.00").unwrap()),
        currency: "INR".into(),
        marketplace: "Brand store".into(),
        url: "https://example.com/k2".into(),
        source_id: Some("S-001".into()),
        notes: "Includes “Mac” keycaps".into(),
        observed_at: fixed_time(),
    }];

    workspace.save_competitors(&competitors).unwrap();
    assert_eq!(workspace.load_competitors().unwrap(), competitors);
}
~~~

- [ ] **Step 2: Run and observe failure**

~~~powershell
cargo test -p merchant-workspace --test competitor_csv
~~~

Expected: FAIL because competitor types and CSV storage are missing.

- [ ] **Step 3: Implement decimal-string and competitor validation**

~~~rust
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct DecimalString(Decimal);

impl DecimalString {
    pub fn parse(value: &str) -> Result<Self, DomainError>;
    pub fn decimal(self) -> Decimal;
    pub fn file_string(self) -> String;
}
~~~

Serialize `DecimalString` as a JSON/CSV string. Validate non-negative price, project currency equality, unique competitor ID, and optional source ID existence when saving a complete snapshot.

- [ ] **Step 4: Write the failing editable-grid test**

~~~tsx
it("adds and persists a priced competitor", async () => {
  render(<CompetitorsScreen currency="INR" competitors={[]} evidence={sampleEvidence} onSave={save} />);
  await user.click(screen.getByRole("button", { name: "Add competitor" }));
  await user.type(screen.getByLabelText("Product"), "Keychron K2");
  await user.type(screen.getByLabelText("Brand"), "Keychron");
  await user.type(screen.getByLabelText("Price"), "7499");
  await user.click(screen.getByRole("button", { name: "Save competitor" }));
  expect(save).toHaveBeenCalledWith([
    expect.objectContaining({ id: "C-001", price: "7499.00", currency: "INR" }),
  ]);
});
~~~

- [ ] **Step 5: Implement the table and focused row editor**

Use a semantic table for product, brand, price, marketplace, source, and actions. Edit one row in a dialog or side panel rather than implementing spreadsheet keyboard behavior. Currency is displayed from the project and is not editable per row.

- [ ] **Step 6: Verify table persistence**

~~~powershell
cargo test -p merchant-workspace --test competitor_csv
npm test -- --run src/features/competitors/CompetitorsScreen.test.tsx
npm run build
~~~

Expected: PASS.

- [ ] **Step 7: Commit competitor records**

~~~powershell
git add -- crates/merchant-core crates/merchant-workspace src-tauri src
git commit -m "feat: add competitor comparison table"
~~~

### Task 8: Add Deterministic Competitor Statistics

**Files:**
- Create: `crates/merchant-core/src/statistics.rs`
- Modify: core exports, service, commands, DTOs, desktop client, and `CompetitorsScreen.tsx`
- Test: `crates/merchant-core/tests/statistics.rs`

**Interfaces:**
- Produces: `CompetitorStatistics`
- Produces: `competitor_statistics(&[Competitor]) -> CompetitorStatistics`

- [ ] **Step 1: Write failing odd/even/empty statistics tests**

~~~rust
#[test]
fn calculates_even_median_and_average_with_decimal_rounding() {
    let competitors = competitors_with_prices(&["100.00", "200.00", "400.00", "900.00"]);
    let stats = competitor_statistics(&competitors);
    assert_eq!(stats.valid_price_count, 4);
    assert_eq!(stats.minimum.unwrap().file_string(), "100.00");
    assert_eq!(stats.maximum.unwrap().file_string(), "900.00");
    assert_eq!(stats.average.unwrap().file_string(), "400.00");
    assert_eq!(stats.median.unwrap().file_string(), "300.00");
}

#[test]
fn empty_prices_produce_none_not_zero() {
    let stats = competitor_statistics(&competitors_without_prices(2));
    assert_eq!(stats.valid_price_count, 0);
    assert!(stats.minimum.is_none());
    assert!(stats.average.is_none());
    assert!(stats.median.is_none());
}
~~~

- [ ] **Step 2: Run and observe failure**

~~~powershell
cargo test -p merchant-core --test statistics
~~~

Expected: FAIL because the statistics module is missing.

- [ ] **Step 3: Implement statistics with exact decimals**

Sort valid prices, compute arithmetic mean, choose the middle value for odd counts, average two middle values for even counts, and round materialized results to two decimal places with midpoint-away-from-zero.

- [ ] **Step 4: Add the failing statistics-card UI test**

~~~tsx
it("shows deterministic price statistics from the backend result", () => {
  render(<CompetitorsScreen {...competitorsProps} statistics={{
    validPriceCount: 3,
    minimum: "4999.00",
    maximum: "8999.00",
    average: "6999.00",
    median: "6999.00"
  }} />);
  expect(screen.getByText("₹4,999.00")).toBeInTheDocument();
  expect(screen.getByText("₹8,999.00")).toBeInTheDocument();
  expect(screen.getAllByText("₹6,999.00")).toHaveLength(2);
});
~~~

- [ ] **Step 5: Return statistics with every competitor snapshot and display four cards**

Do not recompute statistics in TypeScript. Format only the returned decimal strings using `Intl.NumberFormat`.

- [ ] **Step 6: Verify calculations and UI**

~~~powershell
cargo test -p merchant-core --test statistics
npm test -- --run src/features/competitors/CompetitorsScreen.test.tsx
cargo test --workspace
~~~

Expected: PASS.

- [ ] **Step 7: Commit statistics**

~~~powershell
git add -- crates/merchant-core src-tauri src
git commit -m "feat: calculate competitor price statistics"
~~~

### Task 9: Persist Economics Inputs

**Files:**
- Modify: `crates/merchant-core/src/model.rs`, `validation.rs`
- Modify: `crates/merchant-workspace/src/project.rs`
- Modify: service, commands, DTOs, and desktop client
- Create: `src/features/economics/EconomicsScreen.tsx`, `EconomicsScreen.test.tsx`
- Test: `crates/merchant-workspace/tests/economics_inputs.rs`

**Interfaces:**
- Produces: `CostAssumptions`, `ScenarioPrices`, `ScenarioName`
- Produces: `Workspace::load_assumptions()`, `save_assumptions(&CostAssumptions)`

- [ ] **Step 1: Write the failing assumptions round-trip test**

~~~rust
#[test]
fn economics_inputs_round_trip_as_decimal_strings() {
    let workspace = fixture_workspace();
    let assumptions = fixture_assumptions(
        "3200.00", "350.00", "15.00", "2.00", "150.00",
        ["5999.00", "7499.00", "8999.00"],
    );
    workspace.save_assumptions(&assumptions).unwrap();
    assert_eq!(workspace.load_assumptions().unwrap(), assumptions);
}
~~~

- [ ] **Step 2: Run and observe failure**

~~~powershell
cargo test -p merchant-workspace --test economics_inputs
~~~

Expected: FAIL because assumptions persistence is absent.

- [ ] **Step 3: Implement assumptions types, validation, and atomic JSON persistence**

Store the five shared costs/rates as `DecimalString`, initialized to `"0.00"`. Define `ScenarioPrices { low, base, high }` as `Option<DecimalString>` fields initialized to `null`, because a new project does not yet have selling prices. Validate costs as non-negative, fee rates from 0 through 100, every present scenario price as greater than zero, and assumptions currency equal to project currency. Calculation in Task 10 rejects a missing scenario price. Assert in the test that serialized JSON contains `"acquisitionCost": "3200.00"`.

- [ ] **Step 4: Write the failing economics-form test**

~~~tsx
it("persists shared costs and three scenario prices", async () => {
  render(<EconomicsScreen assumptions={emptyAssumptions} onSave={save} />);
  await user.type(screen.getByLabelText("Acquisition cost"), "3200");
  await user.type(screen.getByLabelText("Shipping and logistics"), "350");
  await user.type(screen.getByLabelText("Base selling price"), "7499");
  await user.click(screen.getByRole("button", { name: "Save assumptions" }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    acquisitionCost: "3200.00",
    shippingCost: "350.00",
    scenarioPrices: expect.objectContaining({ base: "7499.00" })
  }));
});
~~~

- [ ] **Step 5: Implement the assumptions form**

Use explicit labeled decimal inputs and show competitor minimum, median, and maximum as copyable suggestions. At this task, the calculated-result area says `Calculate scenarios to see margins`.

- [ ] **Step 6: Verify inputs**

~~~powershell
cargo test -p merchant-workspace --test economics_inputs
npm test -- --run src/features/economics/EconomicsScreen.test.tsx
npm run build
~~~

Expected: PASS.

- [ ] **Step 7: Commit economics inputs**

~~~powershell
git add -- crates/merchant-core crates/merchant-workspace src-tauri src
git commit -m "feat: persist economics assumptions"
~~~

### Task 10: Calculate Deterministic Unit Economics

**Files:**
- Create: `crates/merchant-core/src/economics.rs`
- Modify: core exports, workspace project persistence, service, commands, DTOs, desktop client, and `EconomicsScreen.tsx`
- Test: `crates/merchant-core/tests/economics.rs`, `src-tauri/tests/scenarios_workflow.rs`

**Interfaces:**
- Produces: `EconomicsScenario`
- Produces: `calculate_scenarios(&CostAssumptions) -> Result<Vec<EconomicsScenario>, DomainError>`
- Produces: `MerchantService::calculate_and_save_scenarios(root)`

- [ ] **Step 1: Write failing formula and validation tests**

~~~rust
#[test]
fn calculates_base_scenario_without_binary_floats() {
    let assumptions = fixture_assumptions(
        "3200.00", "350.00", "15.00", "2.00", "150.00",
        ["5999.00", "7499.00", "8999.00"],
    );
    let scenarios = calculate_scenarios(&assumptions).unwrap();
    let base = scenarios.iter().find(|row| row.scenario == ScenarioName::Base).unwrap();

    assert_eq!(base.marketplace_fee.file_string(), "1124.85");
    assert_eq!(base.payment_fee.file_string(), "149.98");
    assert_eq!(base.total_cost.file_string(), "4974.83");
    assert_eq!(base.gross_profit.file_string(), "2524.17");
    assert_eq!(base.gross_margin_percent.file_string(), "33.66");
}

#[test]
fn zero_selling_price_is_rejected() {
    let mut assumptions = valid_assumptions();
    assumptions.scenario_prices.low = Some(DecimalString::parse("0").unwrap());
    assert!(matches!(
        calculate_scenarios(&assumptions),
        Err(DomainError::SellingPriceMustBePositive)
    ));
}
~~~

- [ ] **Step 2: Run and observe failure**

~~~powershell
cargo test -p merchant-core --test economics
~~~

Expected: FAIL because economics calculations are missing.

- [ ] **Step 3: Implement formulas exactly as the spec**

Compute unrounded fee, total, profit, and margin decimals. Round each materialized output to two decimal places with `MidpointAwayFromZero`. Allow negative gross profit.

- [ ] **Step 4: Write the failing scenarios CSV test**

~~~rust
#[test]
fn calculate_workflow_writes_three_readable_scenario_rows() {
    let fixture = complete_service_fixture();
    let scenarios = fixture.service
        .calculate_and_save_scenarios(&fixture.root)
        .unwrap();
    assert_eq!(scenarios.len(), 3);
    let csv = std::fs::read_to_string(
        Path::new(&fixture.root).join("economics/scenarios.csv")
    ).unwrap();
    assert!(csv.contains("scenario,selling_price"));
    assert!(csv.contains("base,7499.00"));
}
~~~

- [ ] **Step 5: Implement scenario persistence and result table**

Write the exact CSV columns from the design. The UI button text is `Calculate and save scenarios`; show low/base/high rows and visually distinguish positive and negative margins. TypeScript only formats backend results.

- [ ] **Step 6: Verify domain, workspace, and UI**

~~~powershell
cargo test -p merchant-core --test economics
cargo test -p open-merchant --test scenarios_workflow
npm test -- --run src/features/economics/EconomicsScreen.test.tsx
cargo test --workspace
~~~

Expected: PASS.

- [ ] **Step 7: Commit economics calculations**

~~~powershell
git add -- crates/merchant-core crates/merchant-workspace src-tauri src
git commit -m "feat: calculate deterministic unit economics"
~~~

### Task 11: Generate the Markdown Opportunity Report

**Files:**
- Modify: `crates/merchant-core/src/model.rs`
- Create: `crates/merchant-core/src/report.rs`
- Modify: workspace project persistence, service, commands, DTOs, and desktop client
- Create: `src/features/report/ReportScreen.tsx`, `ReportScreen.test.tsx`
- Test: `crates/merchant-core/tests/report.rs`, `src-tauri/tests/report_workflow.rs`

**Interfaces:**
- Produces: `ReportItem`, `ReportSections`, `ReportInput`, `GeneratedReport`
- Produces: `render_opportunity_report(&ReportInput) -> String`
- Produces: `MerchantService::generate_report(root) -> GeneratedReport`

- [ ] **Step 1: Write the failing deterministic report tests**

~~~rust
#[test]
fn report_contains_objective_calculations_evidence_and_run_id() {
    let input = complete_report_input("RUN-001", fixed_time());
    let markdown = render_opportunity_report(&input);
    assert!(markdown.contains("# Mechanical Keyboards India"));
    assert!(markdown.contains("## Research objective"));
    assert!(markdown.contains("₹7,499.00"));
    assert!(markdown.contains("[S-001] Keyboard listing"));
    assert!(markdown.contains("Generating run:"));
    assert!(markdown.contains("RUN-001"));
}

#[test]
fn report_never_invents_empty_narrative() {
    let markdown = render_opportunity_report(&report_input_with_empty_narrative());
    assert!(markdown.contains("No observations recorded."));
    assert!(markdown.contains("No risks recorded."));
    assert!(markdown.contains("No opportunities recorded."));
}
~~~

- [ ] **Step 2: Run and observe failure**

~~~powershell
cargo test -p merchant-core --test report
~~~

Expected: FAIL because report types and renderer are missing.

- [ ] **Step 3: Implement report sections and renderer**

Render the eleven sections in the exact design order. Escape Markdown control characters in user-entered table cells, use stable source IDs, and use supplied `run_id` and `generated_at` so tests remain deterministic.

- [ ] **Step 4: Write the failing end-to-end report workflow test**

~~~rust
#[test]
fn generation_refreshes_scenarios_then_writes_markdown() {
    let fixture = complete_service_fixture();
    let result = fixture.service.generate_report(&fixture.root).unwrap();
    assert!(result.markdown.contains("## Pricing and unit economics"));
    assert!(Path::new(&fixture.root).join("economics/scenarios.csv").is_file());
    assert!(Path::new(&fixture.root).join("reports/opportunity-report.md").is_file());
}
~~~

- [ ] **Step 5: Implement the application workflow and report UI**

Save report sections, reload current inputs, validate, recalculate scenarios, compute competitor statistics, allocate a run UUID, render Markdown, and atomically replace both generated artifacts. The UI edits decision summary plus observation/risk/opportunity items with source checkboxes, then shows a raw-HTML-disabled `react-markdown` preview.

- [ ] **Step 6: Verify report generation**

~~~powershell
cargo test -p merchant-core --test report
cargo test -p open-merchant --test report_workflow
npm test -- --run src/features/report/ReportScreen.test.tsx
cargo test --workspace
npm run build
~~~

Expected: PASS.

- [ ] **Step 7: Commit report generation**

~~~powershell
git add -- crates/merchant-core crates/merchant-workspace src-tauri src
git commit -m "feat: generate opportunity report"
~~~

### Task 12: Add the Basic Artifact Viewer

**Files:**
- Create: `crates/merchant-workspace/src/artifacts.rs`
- Modify: workspace exports, service, commands, DTOs, desktop client
- Create: `src/features/artifacts/ArtifactsScreen.tsx`, `ArtifactsScreen.test.tsx`
- Test: `crates/merchant-workspace/tests/artifacts.rs`

**Interfaces:**
- Produces: `ArtifactDescriptor { relative_path, kind, generated, exists }`
- Produces: `Workspace::list_artifacts()`, `Workspace::read_artifact(relative_path)`

- [ ] **Step 1: Write the failing safe-artifact test**

~~~rust
#[test]
fn lists_known_artifacts_and_rejects_arbitrary_paths() {
    let workspace = complete_fixture_workspace();
    let artifacts = workspace.list_artifacts().unwrap();
    assert!(artifacts.iter().any(|item| item.relative_path == "reports/opportunity-report.md"));
    assert!(matches!(
        workspace.read_artifact("../outside.txt"),
        Err(WorkspaceError::UnknownArtifact(_))
    ));
}
~~~

- [ ] **Step 2: Run and observe failure**

~~~powershell
cargo test -p merchant-workspace --test artifacts
~~~

Expected: FAIL because artifact inventory is missing.

- [ ] **Step 3: Implement a fixed allowlist and UTF-8 size limit**

Allow only the known relative paths from the design. Return `UnknownArtifact` for traversal or unlisted paths and `ArtifactTooLarge` above 2 MiB. Return missing generated artifacts as descriptors with `exists: false`, not errors.

- [ ] **Step 4: Write the failing viewer test**

~~~tsx
it("selects a known artifact and shows its text", async () => {
  client.listArtifacts.mockResolvedValue([
    { relativePath: "reports/opportunity-report.md", kind: "markdown", generated: true, exists: true }
  ]);
  client.readArtifact.mockResolvedValue("# Mechanical Keyboards India");
  render(<ArtifactsScreen client={client} projectRoot="C:/Research/keyboards" />);
  await user.click(await screen.findByText("opportunity-report.md"));
  expect(await screen.findByText("# Mechanical Keyboards India")).toBeInTheDocument();
});
~~~

- [ ] **Step 5: Implement the tree and read-only text viewer**

Group artifacts by folder, label missing generated files `Not generated`, render Markdown with raw HTML disabled, and render JSON/JSONL/CSV as scrollable monospaced text. Add `Open in Explorer` through a Windows adapter that passes the selected root as a separate `explorer.exe` argument.

- [ ] **Step 6: Verify viewer behavior**

~~~powershell
cargo test -p merchant-workspace --test artifacts
npm test -- --run src/features/artifacts/ArtifactsScreen.test.tsx
npm run build
~~~

Expected: PASS.

- [ ] **Step 7: Commit artifact viewer**

~~~powershell
git add -- crates/merchant-workspace src-tauri src
git commit -m "feat: add local artifact viewer"
~~~

### Task 13: Add Basic Run and Provenance History

**Files:**
- Create: `crates/merchant-workspace/src/history.rs`
- Modify: workspace exports, application service, commands, DTOs, desktop client
- Modify: `src/features/artifacts/ArtifactsScreen.tsx`, its test
- Test: `crates/merchant-workspace/tests/history.rs`, `src-tauri/tests/report_workflow.rs`

**Interfaces:**
- Produces: `RunRecord`, `ProvenanceRecord`, `ArtifactFingerprint`
- Produces: `Workspace::append_run`, `append_provenance`, `list_runs`, `list_provenance`
- Modifies: report generation to record one run owning scenarios CSV and report Markdown

- [ ] **Step 1: Write the failing history test**

~~~rust
#[test]
fn report_generation_records_inputs_outputs_hashes_and_sources() {
    let fixture = complete_service_fixture();
    let generated = fixture.service.generate_report(&fixture.root).unwrap();
    let workspace = Workspace::open(&fixture.root).unwrap();

    let runs = workspace.list_runs().unwrap();
    let run = runs.last().unwrap();
    assert_eq!(run.run_id, generated.run_id);
    assert_eq!(run.operation, RunOperation::ReportGenerated);
    assert_eq!(run.status, RunStatus::Succeeded);
    assert!(run.input_artifacts.iter().any(|item| item.path == "sources/sources.jsonl"));
    assert!(run.output_artifacts.iter().any(|item| {
        item.path == "reports/opportunity-report.md" && item.sha256.len() == 64
    }));
    assert!(run.source_ids.contains(&"S-001".to_string()));

    let provenance = workspace.list_provenance().unwrap();
    assert!(provenance.iter().any(|item| {
        item.run_id == generated.run_id
            && item.artifact_path == "reports/opportunity-report.md"
    }));
}
~~~

- [ ] **Step 2: Run and observe failure**

~~~powershell
cargo test -p open-merchant --test report_workflow report_generation_records
~~~

Expected: FAIL because history storage and generation logging are missing.

- [ ] **Step 3: Implement basic append-only history**

~~~rust
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactFingerprint {
    pub path: String,
    pub sha256: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRecord {
    pub schema_version: u32,
    pub run_id: String,
    pub operation: RunOperation,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub status: RunStatus,
    pub app_version: String,
    pub input_artifacts: Vec<ArtifactFingerprint>,
    pub output_artifacts: Vec<ArtifactFingerprint>,
    pub source_ids: Vec<String>,
    pub error_summary: Option<String>,
}
~~~

Hash direct input files and the two generated outputs with SHA-256, append one JSON object per line, and flush the file. Keep the UI inspection basic: operation, timestamp, status, output paths, and selected artifact's producing run.

- [ ] **Step 4: Write the failing history UI test**

~~~tsx
it("shows the report generation run and provenance summary", async () => {
  client.listRuns.mockResolvedValue([reportRun]);
  client.listProvenance.mockResolvedValue([reportProvenance]);
  render(<ArtifactsScreen client={client} projectRoot="C:/Research/keyboards" />);
  await user.click(screen.getByRole("tab", { name: "History" }));
  expect(await screen.findByText("Report generated")).toBeInTheDocument();
  expect(screen.getByText("opportunity-report.md")).toBeInTheDocument();
});
~~~

- [ ] **Step 5: Verify history and viewer**

~~~powershell
cargo test -p merchant-workspace --test history
cargo test -p open-merchant --test report_workflow
npm test -- --run src/features/artifacts/ArtifactsScreen.test.tsx
cargo test --workspace
~~~

Expected: PASS.

- [ ] **Step 6: Commit history**

~~~powershell
git add -- crates/merchant-workspace src-tauri src
git commit -m "feat: record artifact provenance"
~~~

### Task 14: Verify the Complete Persistence Vertical Slice

**Files:**
- Create: `src-tauri/tests/vertical_slice.rs`
- Create: `docs/manual-smoke-test.md`
- Modify only defects exposed by this test

**Interfaces:**
- Consumes all core workflow interfaces from Tasks 2–13
- Produces one automated backend acceptance test and one UI smoke checklist

- [ ] **Step 1: Write the failing complete-workflow integration test**

~~~rust
#[test]
fn complete_project_survives_reopen_with_generated_artifacts() {
    let temp = tempfile::tempdir().unwrap();
    let recent_path = temp.path().join("recent-projects.json");
    let service = MerchantService::new(RecentProjectsStore::new(recent_path.clone()));
    let project = service.create_project(CreateProjectRequest {
        parent_directory: temp.path().to_string_lossy().into_owned(),
        name: "Mechanical Keyboards India".into(),
        objective: "Would selling mechanical keyboards in India be attractive?".into(),
        currency: "INR".into(),
    }).unwrap();

    service.save_evidence(&project.root, complete_evidence()).unwrap();
    service.save_competitors(&project.root, complete_competitors()).unwrap();
    service.save_assumptions(&project.root, complete_assumptions()).unwrap();
    service.save_report_sections(&project.root, complete_report_sections()).unwrap();
    service.generate_report(&project.root).unwrap();

    drop(service);
    let reopened_service = MerchantService::new(RecentProjectsStore::new(recent_path));
    let reopened = reopened_service.open_project(&project.root).unwrap();
    assert_eq!(reopened.manifest.objective, "Would selling mechanical keyboards in India be attractive?");
    assert_eq!(reopened.evidence.len(), 2);
    assert_eq!(reopened.competitors.len(), 3);
    assert_eq!(reopened.scenarios.len(), 3);
    assert!(reopened_service
        .read_artifact(&project.root, "reports/opportunity-report.md")
        .unwrap()
        .contains("Mechanical Keyboards India"));
    assert_eq!(reopened_service.list_runs(&project.root).unwrap().len(), 1);
}
~~~

- [ ] **Step 2: Run and observe any integration failures**

~~~powershell
cargo test -p open-merchant --test vertical_slice -- --nocapture
~~~

Expected before fixes: at least one failure exposing a mismatched DTO, missing snapshot field, or persistence gap.

- [ ] **Step 3: Fix only the failures required for the complete slice**

Make `ProjectSnapshot` return manifest, evidence, competitors, statistics, assumptions, scenarios, report sections, report Markdown availability, artifacts, runs, and provenance in the exact camel-case shapes consumed by the UI. Do not add hardening features.

- [ ] **Step 4: Write the manual smoke checklist**

`docs/manual-smoke-test.md` must contain these checkboxes:

~~~markdown
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
~~~

- [ ] **Step 5: Run the full local quality gate**

~~~powershell
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm test -- --run
npm run build
~~~

Expected: every command PASS.

- [ ] **Step 6: Execute the manual checklist in Tauri dev mode**

~~~powershell
npm run tauri dev
~~~

Record any failure directly under its checklist line, fix it with a new failing regression test, rerun the quality gate, then clear the note.

- [ ] **Step 7: Commit vertical-slice verification**

~~~powershell
git add -- src-tauri src crates docs/manual-smoke-test.md
git commit -m "test: verify complete project workflow"
~~~

### Task 15: Produce the Windows Production Build

**Files:**
- Modify: `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`
- Create: app icons under `src-tauri/icons/`
- Modify: `docs/manual-smoke-test.md`

**Interfaces:**
- Produces: release executable and basic unsigned NSIS installer under `target/release/bundle/nsis`

- [ ] **Step 1: Add production-build checks to the smoke document**

~~~markdown
- [ ] npm run tauri build -- --bundles nsis completes.
- [ ] The NSIS installer exists and is non-empty.
- [ ] A fresh install launches Open Merchant.
- [ ] The installed app completes create → report → reopen.
- [ ] Uninstall removes the app but does not delete user project folders.
~~~

- [ ] **Step 2: Confirm the bundle check currently fails**

~~~powershell
$installer = Get-ChildItem -Path 'target/release/bundle/nsis' -Filter '*.exe' -ErrorAction SilentlyContinue
if (-not $installer) { throw 'NSIS installer not built yet' }
~~~

Expected: FAIL because no production installer exists.

- [ ] **Step 3: Configure the basic Windows bundle**

Set product name `Open Merchant`, version `0.1.0`, identifier `com.openmerchant.desktop`, one 1280×800 minimum-960×640 main window, NSIS target, and local-only capabilities. Generate standard Tauri icon sizes from one approved square source icon.

- [ ] **Step 4: Run all tests immediately before packaging**

~~~powershell
cargo test --workspace
npm test -- --run
npm run build
~~~

Expected: PASS.

- [ ] **Step 5: Build and smoke-test NSIS**

~~~powershell
npm run tauri build -- --bundles nsis
Get-ChildItem -Path 'target/release/bundle/nsis' -Filter '*.exe' |
  Select-Object FullName, Length, LastWriteTime
~~~

Expected: one non-empty installer. Install it and complete the production-build smoke checklist.

- [ ] **Step 6: Commit production configuration and icons**

~~~powershell
git add -- src-tauri/tauri.conf.json src-tauri/capabilities src-tauri/icons docs/manual-smoke-test.md
git commit -m "build: configure Windows production bundle"
~~~

### Task 16: Add the Mechanical Keyboards Example Project

**Files:**
- Create: `examples/mechanical-keyboards-india/**`
- Test: `crates/merchant-workspace/tests/example_project.rs`

**Interfaces:**
- Produces a portable schema-version-1 example that opens and renders without migration

- [ ] **Step 1: Write the failing example-project test**

~~~rust
#[test]
fn checked_in_example_opens_and_has_a_complete_report() {
    let root = repo_root().join("examples/mechanical-keyboards-india");
    let workspace = Workspace::open(&root).unwrap();
    let snapshot = workspace.load_snapshot().unwrap();
    assert_eq!(snapshot.manifest.currency, "INR");
    assert!(snapshot.evidence.len() >= 3);
    assert!(snapshot.competitors.len() >= 5);
    assert_eq!(snapshot.scenarios.len(), 3);
    assert!(workspace
        .read_artifact("reports/opportunity-report.md")
        .unwrap()
        .contains("## Risks"));
}
~~~

- [ ] **Step 2: Run and observe failure**

~~~powershell
cargo test -p merchant-workspace --test example_project
~~~

Expected: FAIL because the example folder is absent.

- [ ] **Step 3: Create the example through the application**

Use realistic but clearly sample data: at least three evidence URLs, five competitors spanning low/mid/high prices, one complete cost model, three scenarios, three observations, two risks, and two opportunities. Generate its scenarios, report, run, and provenance files through Open Merchant rather than hand-authoring derived data.

- [ ] **Step 4: Sanitize and verify the example**

Ensure it contains no private local paths, credentials, personal data, or unverifiable claims presented as fact. URLs may be public product pages, but notes must say observations are sample data captured for the demo.

~~~powershell
cargo test -p merchant-workspace --test example_project
git status --short -- examples/mechanical-keyboards-india
~~~

Expected: PASS and only expected example files.

- [ ] **Step 5: Commit the example**

~~~powershell
git add -- examples/mechanical-keyboards-india crates/merchant-workspace/tests/example_project.rs
git commit -m "docs: add example research project"
~~~

### Task 17: Write the Public README and License

**Files:**
- Create: `README.md`, `LICENSE`
- Modify: no application code

**Interfaces:**
- Produces public setup, use, architecture, workspace format, limitations, testing, and build documentation

- [ ] **Step 1: Create a failing README-content check**

~~~powershell
$required = @(
  'What Open Merchant is',
  'Windows prerequisites',
  'Development',
  'Testing',
  'Windows build',
  'Workspace format',
  'Deterministic calculations',
  'Current limitations'
)
$readme = if (Test-Path README.md) { Get-Content -Raw README.md } else { '' }
$missing = $required | Where-Object { $readme -notmatch [regex]::Escape($_) }
if ($missing) { throw ('Missing README sections: ' + ($missing -join ', ')) }
~~~

Expected: FAIL because README is absent.

- [ ] **Step 2: Write the README**

Lead with a one-sentence artifact-first value proposition and one screenshot placeholder that will become `docs/screenshots/workspace.png` in Task 18. Include exact commands:

~~~powershell
npm install
npm run tauri dev
cargo test --workspace
npm test -- --run
npm run tauri build -- --bundles nsis
~~~

Document the project tree, formulas, unsigned-installer warning, Windows-only status, sole-writer limitation while open, and explicit V0 exclusions.

- [ ] **Step 3: Add the MIT license**

Use the standard MIT text with copyright year 2026 and the repository owner's chosen public name. Do not invent a legal entity; if no public name is configured, use `Open Merchant contributors`.

- [ ] **Step 4: Verify docs and commands**

~~~powershell
npm run build
cargo test --workspace
Select-String -Path README.md -Pattern 'What Open Merchant is','Workspace format','Current limitations'
~~~

Expected: PASS and all sections found.

- [ ] **Step 5: Commit public documentation**

~~~powershell
git add -- README.md LICENSE
git commit -m "docs: add public project guide"
~~~

### Task 18: Capture Three Screenshots and Finalize the Demo Workflow

**Files:**
- Create: `docs/screenshots/workspace.png`, `economics.png`, `report-artifacts.png`
- Create: `docs/demo-script.md`
- Modify: `README.md`, `docs/manual-smoke-test.md`

**Interfaces:**
- Produces the complete public showcase gate

- [ ] **Step 1: Write the screenshot and demo acceptance check**

~~~powershell
$shots = @(
  'docs/screenshots/workspace.png',
  'docs/screenshots/economics.png',
  'docs/screenshots/report-artifacts.png'
)
foreach ($shot in $shots) {
  if (-not (Test-Path $shot)) { throw ('Missing screenshot: ' + $shot) }
  if ((Get-Item $shot).Length -lt 100KB) { throw ('Screenshot too small: ' + $shot) }
}
if (-not (Test-Path 'docs/demo-script.md')) { throw 'Missing demo script' }
~~~

Expected: FAIL because showcase assets are absent.

- [ ] **Step 2: Prepare the real app for capture**

Install and launch the production build, open the checked-in example, set the window to 1280×800, and ensure no private paths or developer tools are visible.

- [ ] **Step 3: Capture exactly three real application screenshots**

1. `workspace.png`: Evidence section with objective context and populated sources.
2. `economics.png`: Competitor statistics and all three economics scenarios with visible margins.
3. `report-artifacts.png`: Generated report preview beside artifact/history navigation.

Use Windows Snipping Tool at native resolution, crop only window chrome/background, and keep text legible.

- [ ] **Step 4: Write the 30–60 second demo script**

~~~markdown
0–05s — Launch Open Merchant and open “Mechanical Keyboards India”.
05–12s — Show the research objective and evidence records.
12–20s — Open competitors and point to deterministic price statistics.
20–30s — Open economics, change the base price, and calculate margins.
30–42s — Generate the opportunity report and show evidence references.
42–52s — Inspect CSV, JSONL, Markdown, run, and provenance artifacts.
52–60s — Close, relaunch, reopen from Recents, and show the intact project.
~~~

- [ ] **Step 5: Run the complete public-prototype gate**

~~~powershell
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm test -- --run
npm run build
npm run tauri build -- --bundles nsis
~~~

Then execute every checkbox in `docs/manual-smoke-test.md`.

Expected: all automated commands PASS, every manual checkbox passes, and the three screenshot checks pass.

- [ ] **Step 6: Commit showcase assets**

~~~powershell
git add -- docs/screenshots docs/demo-script.md docs/manual-smoke-test.md README.md
git commit -m "docs: add Open Merchant showcase assets"
~~~

---

## Optional Hardening — Start Only After Task 18 Passes

### Task 19: Detect External File Conflicts

**Files:**
- Modify: `crates/merchant-workspace/src/project.rs`, `error.rs`
- Modify: service, commands, DTOs, desktop client, project context
- Test: `crates/merchant-workspace/tests/external_conflicts.rs`

**Interfaces:**
- Produces: `FileRevision { relative_path, sha256 }`
- Modifies each save command to accept the last loaded revision and return the new revision

- [ ] **Step 1: Write the failing conflict test**

~~~rust
#[test]
fn stale_revision_cannot_overwrite_an_external_edit() {
    let workspace = fixture_workspace();
    let loaded = workspace.load_snapshot().unwrap();
    std::fs::write(
        workspace.root().join("merchant-project.json"),
        externally_edited_manifest_json(),
    ).unwrap();

    let result = workspace.save_manifest_if_current(
        &loaded.manifest,
        loaded.revisions.get("merchant-project.json").unwrap(),
    );
    assert!(matches!(result, Err(WorkspaceError::ExternalModification { .. })));
}
~~~

- [ ] **Step 2: Run and observe failure**

~~~powershell
cargo test -p merchant-workspace --test external_conflicts
~~~

Expected: FAIL because revisions and guarded saves are missing.

- [ ] **Step 3: Implement guarded source-data saves**

Hash each source-data file when loading. Immediately before replacement, hash the current on-disk file and compare it with the caller's revision. On mismatch, do not write and return the relative path in `ExternalModification`.

- [ ] **Step 4: Add the reload-only UI path**

Show `This project changed outside Open Merchant` with one primary action, `Reload project`. Do not implement merging or overwrite-anyway.

- [ ] **Step 5: Verify conflicts and regressions**

~~~powershell
cargo test -p merchant-workspace --test external_conflicts
cargo test --workspace
npm test -- --run
~~~

Expected: PASS.

- [ ] **Step 6: Commit conflict detection**

~~~powershell
git add -- crates/merchant-workspace src-tauri src
git commit -m "feat: detect external workspace changes"
~~~

### Task 20: Harden Provenance Integrity and Save Recovery

**Files:**
- Modify: `crates/merchant-workspace/src/history.rs`, `atomic.rs`, `artifacts.rs`
- Modify: application service and `ArtifactsScreen.tsx`
- Test: `crates/merchant-workspace/tests/integrity.rs`, `recovery.rs`

**Interfaces:**
- Produces: `IntegrityStatus { verified, changed, missing }`
- Produces: `Workspace::verify_artifact(relative_path)`
- Adds recoverable per-run staging under `.merchant/staging/<run-id>/`

- [ ] **Step 1: Write the failing integrity test**

~~~rust
#[test]
fn changed_generated_artifact_is_reported_without_repairing_it() {
    let workspace = generated_fixture_workspace();
    std::fs::write(
        workspace.root().join("reports/opportunity-report.md"),
        "# Externally changed",
    ).unwrap();
    assert_eq!(
        workspace.verify_artifact("reports/opportunity-report.md").unwrap(),
        IntegrityStatus::Changed
    );
}
~~~

- [ ] **Step 2: Write the failing interrupted-generation recovery test**

~~~rust
#[test]
fn incomplete_staged_generation_preserves_the_last_successful_report() {
    let workspace = generated_fixture_workspace();
    let previous = workspace.read_artifact("reports/opportunity-report.md").unwrap();
    simulate_interruption_after_staging(&workspace);
    workspace.recover_incomplete_runs().unwrap();
    assert_eq!(
        workspace.read_artifact("reports/opportunity-report.md").unwrap(),
        previous
    );
}
~~~

- [ ] **Step 3: Implement verification and minimal staged recovery**

Verify against the latest provenance hash. Stage both generated outputs under one run directory, publish only after both serialize successfully, and remove abandoned staging directories during project open after recording a failed run. Never auto-repair a user-edited artifact.

- [ ] **Step 4: Add provenance detail UI**

For the selected artifact, show current hash status, producing run, direct input paths/hashes, and source IDs. Keep this read-only.

- [ ] **Step 5: Verify hardening**

~~~powershell
cargo test -p merchant-workspace --test integrity --test recovery
cargo test --workspace
npm test -- --run src/features/artifacts/ArtifactsScreen.test.tsx
~~~

Expected: PASS.

- [ ] **Step 6: Commit integrity hardening**

~~~powershell
git add -- crates/merchant-workspace src-tauri src
git commit -m "feat: harden artifact integrity"
~~~

### Task 21: Add Windows CI and Secondary Release Polish

**Files:**
- Create: `.github/workflows/windows.yml`
- Modify: `src-tauri/tauri.conf.json`, `README.md`
- Modify only accessibility or layout defects found during this task

**Interfaces:**
- Produces a Windows CI workflow and polished unsigned release metadata

- [ ] **Step 1: Write the workflow with exact gates**

~~~yaml
name: windows
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: cargo fmt --all -- --check
      - run: cargo clippy --workspace --all-targets -- -D warnings
      - run: cargo test --workspace
      - run: npm test -- --run
      - run: npm run build
      - run: npm run tauri build -- --bundles nsis
~~~

- [ ] **Step 2: Validate workflow and production build locally**

~~~powershell
npm ci
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm test -- --run
npm run tauri build -- --bundles nsis
~~~

Expected: PASS.

- [ ] **Step 3: Perform a focused secondary UX pass**

Keyboard-tab through create, evidence, competitor, economics, report, and artifacts. Fix only missing labels, invisible focus, clipped 960×640 layouts, and unclear empty/error states. Add one regression test per defect; do not add features or redesign navigation.

- [ ] **Step 4: Verify the optional polish did not destabilize the slice**

Rerun every automated command and every checkbox in `docs/manual-smoke-test.md`. Confirm the example and screenshots remain accurate.

- [ ] **Step 5: Commit CI and polish**

~~~powershell
git add -- .github/workflows/windows.yml src-tauri/tauri.conf.json README.md src
git commit -m "ci: verify Windows desktop release"
~~~

---

## Final Completion Evidence

Before claiming completion, capture these outputs in the task summary:

~~~powershell
git status --short
git log --oneline --decorate -20
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm test -- --run
npm run build
npm run tauri build -- --bundles nsis
Get-ChildItem -Path 'target/release/bundle/nsis' -Filter '*.exe' |
  Select-Object FullName, Length, LastWriteTime
~~~

Required evidence:

- Clean working tree or an explicit list of intentional uncommitted files.
- Passing test counts for Rust and frontend suites.
- Successful Windows production bundle path and size.
- Completed manual smoke checklist.
- Clickable paths to the installer, example project, README, three screenshots, and demo script.
- A concise list of optional Tasks 19–21 that were completed or deliberately skipped for the timebox.
