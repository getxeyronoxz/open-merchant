# Recoverable Report Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Make an interrupted or failed report generation visible and recoverable from the local workspace without changing the V0 project schema.

**Architecture:** A report begins by appending a provisional \`RunRecord\` with the existing \`failed\` status and a clear interruption message. The existing JSONL run record is then replaced in place with the final \`succeeded\` record only after scenarios, Markdown, and provenance succeed. A crash or error before that replacement leaves one persisted failed record that the existing History screen can show after reopening.

**Tech Stack:** Rust 2021, Tauri application service, local JSONL run history, React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- Keep \`SCHEMA_VERSION = 1\`; do not introduce a new run-status value or modify user project schemas.
- User-owned workspace files remain canonical and use the shared crash-safe writer.
- A failed report run must retain its input fingerprints and any output artifacts already written.
- Never silently delete partially generated report/scenario artifacts.
- Do not add cloud, account, or AI functionality.
- Do not push branches or create a PR.

---

### Task 1: Replace a provisional run record safely

**Files:**
- Modify: \`crates/merchant-workspace/src/history.rs\`
- Modify: \`crates/merchant-workspace/src/error.rs\`
- Test: \`crates/merchant-workspace/tests/history.rs\`

**Interfaces:**
- Produces \`Workspace::replace_run(&self, replacement: &RunRecord) -> Result<(), WorkspaceError>\`.
- Produces \`WorkspaceError::RunNotFound(String)\` when a run ID is not in \`.merchant/runs.jsonl\`.

- [x] **Step 1: Write the failing history replacement test**

~~~rust
#[test]
fn replacing_a_run_preserves_one_history_entry() {
    let temp = tempfile::tempdir().unwrap();
    let workspace = Workspace::create(temp.path(), "Keyboard Study", "Assess demand", "INR").unwrap();
    let mut run = report_run("RUN-001", RunStatus::Failed);
    run.error_summary = Some("Previous report generation was interrupted before completion.".into());
    workspace.append_run(&run).unwrap();

    run.status = RunStatus::Succeeded;
    run.error_summary = None;
    run.completed_at = Utc::now();
    workspace.replace_run(&run).unwrap();

    let runs = workspace.list_runs().unwrap();
    assert_eq!(runs.len(), 1);
    assert_eq!(runs[0].status, RunStatus::Succeeded);
    assert_eq!(runs[0].error_summary, None);
}
~~~

- [x] **Step 2: Run test to verify it fails**

Run: \`cargo test -p merchant-workspace replacing_a_run_preserves_one_history_entry\`

Expected: FAIL because \`Workspace::replace_run\` does not exist.

- [x] **Step 3: Implement the smallest JSONL replacement**

~~~rust
pub fn replace_run(&self, replacement: &RunRecord) -> Result<(), WorkspaceError> {
    let path = self.artifact_path(paths::RUNS)?;
    let mut runs = read_jsonl(&path)?;
    let run = runs.iter_mut().find(|run| run.run_id == replacement.run_id)
        .ok_or_else(|| WorkspaceError::RunNotFound(replacement.run_id.clone()))?;
    *run = replacement.clone();
    write_jsonl(&path, &runs)
}
~~~

Extract \`write_jsonl\` from \`append_jsonl\` so both append and replace serialize records line-by-line and persist them through \`atomic::write\`.

- [x] **Step 4: Verify green**

Run: \`cargo test -p merchant-workspace replacing_a_run_preserves_one_history_entry\`

Expected: PASS with one succeeded run, no duplicate entry.

Run: \`cargo test -p merchant-workspace\`

Expected: PASS.

- [x] **Step 5: Commit**

~~~text
git add crates/merchant-workspace/src/history.rs crates/merchant-workspace/src/error.rs crates/merchant-workspace/tests/history.rs
git commit -m "feat: support recoverable run history"
~~~

### Task 2: Persist failed report runs before report artifacts

**Files:**
- Modify: \`src-tauri/src/application/service.rs\`
- Modify: \`src-tauri/tests/report_workflow.rs\`
- Test: \`src-tauri/tests/report_workflow.rs\`

**Interfaces:**
- Consumes \`Workspace::append_run\` and \`Workspace::replace_run\`.
- Produces \`MerchantService::generate_report\` with one final succeeded run or one persisted failed run.
- Uses the exact provisional message: \`Previous report generation was interrupted before completion. Review the workspace artifacts, then generate the report again.\`
- Produces private \`report_run(run_id: &str, started_at: DateTime<Utc>, input_artifacts: Vec<ArtifactFingerprint>, source_ids: Vec<String>, status: RunStatus, output_artifacts: Vec<ArtifactFingerprint>, error_summary: Option<String>) -> RunRecord\`.

- [x] **Step 1: Write the failing service regression test**

~~~rust
#[test]
fn failed_report_generation_persists_a_recoverable_run_after_reopen() {
    let (service, snapshot, recents_path) = report_ready_service();
    let scenarios = Path::new(&snapshot.root).join("economics/scenarios.csv");
    fs::remove_file(&scenarios).unwrap();
    fs::create_dir(&scenarios).unwrap();

    assert!(service.generate_report(&snapshot.root).is_err());

    let restarted = MerchantService::new(RecentProjectsStore::new(recents_path));
    restarted.open_project(&snapshot.root).unwrap();
    let runs = restarted.list_runs(&snapshot.root).unwrap();

    assert_eq!(runs.len(), 1);
    assert_eq!(runs[0].status, RunStatus::Failed);
    assert!(runs[0].error_summary.as_deref().unwrap()
        .starts_with("Previous report generation was interrupted before completion."));
    assert!(runs[0].output_artifacts.is_empty());
}
~~~

- [x] **Step 2: Run test to verify it fails**

Run: \`cargo test -p open-merchant failed_report_generation_persists_a_recoverable_run_after_reopen\`

Expected: FAIL because the current service appends a run only after report artifacts succeed.

- [x] **Step 3: Add provisional/final report record flow**

~~~rust
let pending = report_run(
    &run_id,
    started_at,
    source.input_artifacts.clone(),
    source.evidence.iter().map(|source| source.id.clone()).collect(),
    RunStatus::Failed,
    vec![],
    Some(INTERRUPTED_REPORT_MESSAGE.into()),
);
workspace.append_run(&pending)?;

let mut output_artifacts = Vec::new();
let result = (|| -> Result<String, AppError> {
    let scenarios = calculate_scenarios(&source.assumptions)
        .map_err(|error| AppError::Domain(error.to_string()))?;
    output_artifacts.push(workspace.save_scenarios(&scenarios)?);
    let input = ReportInput {
        manifest: source.manifest.clone(),
        sections: source.sections.clone(),
        evidence: source.evidence.clone(),
        competitor_statistics: competitor_statistics(&source.competitors),
        assumptions: source.assumptions.clone(),
        scenarios,
        run_id: run_id.clone(),
        generated_at,
    };
    let markdown = render_opportunity_report(&input);
    output_artifacts.push(workspace.write_opportunity_report(&markdown)?);
    for artifact in &output_artifacts {
        workspace.append_provenance(&ProvenanceRecord {
            schema_version: merchant_core::SCHEMA_VERSION,
            artifact_path: artifact.path.clone(),
            sha256: artifact.sha256.clone(),
            generated_at,
            run_id: run_id.clone(),
        })?;
    }
    Ok(markdown)
})();
match result {
    Ok(markdown) => {
        workspace.replace_run(&report_run(
            &run_id, started_at, source.input_artifacts, source_ids,
            RunStatus::Succeeded, output_artifacts, None,
        ))?;
        Ok(markdown)
    }
    Err(error) => {
        let failed = report_run(
            &run_id, started_at, source.input_artifacts, source_ids,
            RunStatus::Failed, output_artifacts, Some(format!("{INTERRUPTED_REPORT_MESSAGE} {error}")),
        );
        let _ = workspace.replace_run(&failed);
        Err(error)
    }
}
~~~

Keep existing deterministic calculation and report rendering unchanged. Track scenario/report fingerprints as they are successfully written so failed runs describe partial outputs instead of hiding them. If the final run replacement itself fails, leave the provisional record intact and return that error.

- [x] **Step 4: Expand the successful report test**

Assert one final succeeded run, no error summary, two output artifacts, and two provenance records after successful generation. Assert the second report generation still produces one final history entry per run.

- [x] **Step 5: Verify green**

Run: \`cargo test -p open-merchant report_workflow\`

Expected: both successful and failed report-generation paths pass.

Run: \`cargo test --workspace --all-targets\`

Expected: PASS.

- [x] **Step 6: Commit**

~~~text
git add src-tauri/src/application/service.rs src-tauri/tests/report_workflow.rs
git commit -m "fix: preserve interrupted report runs"
~~~

### Task 3: Show report interruption in History

**Files:**
- Modify: \`src/features/artifacts/ArtifactsScreen.tsx\`
- Modify: \`src/features/artifacts/ArtifactsScreen.test.tsx\`

**Interfaces:**
- Consumes existing \`RunRecord.status\` and \`RunRecord.errorSummary\`.
- Produces a visible \`Report interrupted\` card with the saved recovery message for failed report runs.

- [x] **Step 1: Write the failing UI test**

~~~tsx
it("shows a recovery message for an interrupted report run", async () => {
    const client = createFakeDesktopClient();
    client.listRuns.mockResolvedValue([{
        schemaVersion: 1, runId: "RUN-002", operation: "reportGenerated",
        startedAt: "2026-08-09T12:00:00Z", completedAt: "2026-08-09T12:00:00Z",
        status: "failed", appVersion: "0.1.0", inputArtifacts: [],
        outputArtifacts: [], sourceIds: [],
        errorSummary: "Previous report generation was interrupted before completion. Review the workspace artifacts, then generate the report again.",
    }]);

    render(<ArtifactsScreen client={client} projectRoot="C:/Research/keyboards" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "History" }));

    expect(await screen.findByText("Report interrupted")).toBeInTheDocument();
    expect(screen.getByText(/Previous report generation was interrupted/)).toBeInTheDocument();
});
~~~

- [x] **Step 2: Run test to verify it fails**

Run: \`npm run test:run -- src/features/artifacts/ArtifactsScreen.test.tsx\`

Expected: FAIL because History does not currently render \`errorSummary\`.

- [x] **Step 3: Render failed runs as recovery cards**

For \`run.operation === "reportGenerated" && run.status === "failed"\`, show heading \`Report interrupted\`, the saved \`errorSummary\`, and the run start time. Use a restrained rose border/text treatment that remains legible in the existing dark premium interface. Keep succeeded-run rendering unchanged.

- [x] **Step 4: Verify green**

Run: \`npm run test:run -- src/features/artifacts/ArtifactsScreen.test.tsx\`

Expected: PASS.

Run: \`npm run test:run\`

Expected: all frontend tests pass.

- [x] **Step 5: Commit**

~~~text
git add src/features/artifacts/ArtifactsScreen.tsx src/features/artifacts/ArtifactsScreen.test.tsx
git commit -m "feat: show interrupted report recovery"
~~~

### Task 4: Verify the complete local release

**Files:**
- No source changes expected.

- [x] **Step 1: Verify formatting and linting**

Run: \`cargo fmt --all -- --check; cargo clippy --workspace --all-targets --all-features -- -D warnings\`

Expected: PASS.

- [x] **Step 2: Verify all tests and frontend build**

Run: \`cargo test --workspace --all-targets; npm run test:run; npm run build\`

Expected: all Rust and frontend tests pass and Vite builds \`dist/\`.

- [x] **Step 3: Build and identify the installer**

Run: \`npm run tauri build -- --bundles nsis; Get-FileHash -Algorithm SHA256 target/release/bundle/nsis/Open Merchant_0.1.0_x64-setup.exe\`

Expected: the NSIS installer exists with a SHA-256 value.

- [x] **Step 4: Commit the plan and final review**

Run: \`git diff --check; git status --short --branch\`

Expected: no whitespace errors and only the committed local branch ahead of its remote base.
