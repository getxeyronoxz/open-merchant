use merchant_workspace::{Workspace, WorkspaceError};

#[test]
fn lists_known_artifacts_and_rejects_arbitrary_paths() {
    let temp = tempfile::tempdir().unwrap();
    let workspace =
        Workspace::create(temp.path(), "Keyboard Study", "Assess demand", "INR").unwrap();

    let artifacts = workspace.list_artifacts().unwrap();

    assert!(artifacts
        .iter()
        .any(|item| item.relative_path == "reports/opportunity-report.md"));
    assert!(matches!(
        workspace.read_artifact("../outside.txt"),
        Err(WorkspaceError::UnknownArtifact(_))
    ));
}
