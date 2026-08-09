use chrono::Utc;
use merchant_workspace::{ArtifactFingerprint, RunOperation, RunRecord, RunStatus, Workspace};

#[test]
fn appends_and_lists_run_records_as_jsonl() {
    let temp = tempfile::tempdir().unwrap();
    let workspace =
        Workspace::create(temp.path(), "Keyboard Study", "Assess demand", "INR").unwrap();
    let now = Utc::now();
    let run = RunRecord {
        schema_version: 1,
        run_id: "RUN-001".into(),
        operation: RunOperation::ReportGenerated,
        started_at: now,
        completed_at: now,
        status: RunStatus::Succeeded,
        app_version: "0.1.0".into(),
        input_artifacts: vec![],
        output_artifacts: vec![ArtifactFingerprint {
            path: "reports/opportunity-report.md".into(),
            sha256: "a".repeat(64),
        }],
        source_ids: vec![],
        error_summary: None,
    };

    workspace.append_run(&run).unwrap();

    assert_eq!(workspace.list_runs().unwrap()[0].run_id, "RUN-001");
}

#[test]
fn replacing_a_run_preserves_one_history_entry() {
    let temp = tempfile::tempdir().unwrap();
    let workspace =
        Workspace::create(temp.path(), "Keyboard Study", "Assess demand", "INR").unwrap();
    let now = Utc::now();
    let mut run = RunRecord {
        schema_version: 1,
        run_id: "RUN-001".into(),
        operation: RunOperation::ReportGenerated,
        started_at: now,
        completed_at: now,
        status: RunStatus::Failed,
        app_version: "0.1.0".into(),
        input_artifacts: vec![],
        output_artifacts: vec![],
        source_ids: vec![],
        error_summary: Some("Previous report generation was interrupted before completion.".into()),
    };
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
