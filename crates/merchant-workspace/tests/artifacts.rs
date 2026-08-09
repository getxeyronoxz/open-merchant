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

#[cfg(windows)]
#[test]
fn refuses_a_known_artifact_path_when_it_is_a_symlink_outside_the_workspace() {
    use std::{fs, os::windows::fs::symlink_file};

    let temp = tempfile::tempdir().unwrap();
    let workspace =
        Workspace::create(temp.path(), "Keyboard Study", "Assess demand", "INR").unwrap();
    let outside = temp.path().join("outside.txt");
    fs::write(&outside, "private test data").unwrap();
    let report = workspace.root().join("reports/opportunity-report.md");
    fs::remove_file(&report).unwrap();
    symlink_file(&outside, &report).unwrap();

    assert!(workspace
        .read_artifact("reports/opportunity-report.md")
        .is_err());
    assert!(workspace
        .fingerprint_artifact("reports/opportunity-report.md")
        .is_err());
}

#[cfg(windows)]
#[test]
fn refuses_an_artifact_when_its_parent_directory_is_a_symlink_outside_the_workspace() {
    use std::{fs, os::windows::fs::symlink_dir};

    let temp = tempfile::tempdir().unwrap();
    let workspace =
        Workspace::create(temp.path(), "Keyboard Study", "Assess demand", "INR").unwrap();
    let outside_reports = temp.path().join("outside-reports");
    fs::create_dir(&outside_reports).unwrap();
    fs::write(
        outside_reports.join("opportunity-report.md"),
        "private test data",
    )
    .unwrap();
    let reports = workspace.root().join("reports");
    fs::remove_dir_all(&reports).unwrap();
    symlink_dir(&outside_reports, &reports).unwrap();

    assert!(workspace
        .read_artifact("reports/opportunity-report.md")
        .is_err());
    assert!(workspace
        .fingerprint_artifact("reports/opportunity-report.md")
        .is_err());
    assert!(workspace
        .write_opportunity_report("must not write")
        .is_err());
    assert_eq!(
        fs::read_to_string(outside_reports.join("opportunity-report.md")).unwrap(),
        "private test data"
    );
}
