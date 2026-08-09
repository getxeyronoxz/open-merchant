use std::fs;

use merchant_core::{ReportSections, SCHEMA_VERSION};
use merchant_workspace::Workspace;

#[test]
fn create_then_open_preserves_manifest_and_layout() {
    let temp = tempfile::tempdir().unwrap();
    let workspace = Workspace::create(
        temp.path(),
        "Mechanical Keyboards India",
        "Would selling mechanical keyboards in India be commercially attractive?",
        "INR",
    )
    .unwrap();

    assert!(workspace.root().join("merchant-project.json").is_file());
    assert!(workspace.root().join("sources/sources.jsonl").is_file());
    assert!(workspace.root().join("market/competitors.csv").is_file());
    assert!(workspace
        .root()
        .join("economics/assumptions.json")
        .is_file());
    assert!(workspace
        .root()
        .join("reports/report-sections.json")
        .is_file());

    let reopened = Workspace::open(workspace.root()).unwrap();
    let snapshot = reopened.load_snapshot().unwrap();
    assert_eq!(snapshot.manifest.name, "Mechanical Keyboards India");
    assert_eq!(snapshot.manifest.currency, "INR");
}

#[test]
fn create_never_overwrites_an_existing_project_folder() {
    let temp = tempfile::tempdir().unwrap();
    Workspace::create(
        temp.path(),
        "Mechanical Keyboards India",
        "Assess demand",
        "INR",
    )
    .unwrap();

    let error = Workspace::create(
        temp.path(),
        "Mechanical Keyboards India",
        "New objective",
        "INR",
    )
    .unwrap_err();

    assert!(error.to_string().contains("already exists"));
}

#[test]
fn saving_manifest_survives_reopen() {
    let temp = tempfile::tempdir().unwrap();
    let workspace =
        Workspace::create(temp.path(), "Keyboard Study", "Assess demand", "INR").unwrap();
    let mut snapshot = workspace.load_snapshot().unwrap();
    snapshot.manifest.objective = "Updated commercial question".into();

    workspace.save_manifest(&snapshot.manifest).unwrap();

    assert_eq!(
        Workspace::open(workspace.root())
            .unwrap()
            .load_snapshot()
            .unwrap()
            .manifest
            .objective,
        "Updated commercial question"
    );
}

#[test]
fn create_uses_windows_safe_folders_for_unicode_and_reserved_names() {
    let temp = tempfile::tempdir().unwrap();
    let unicode = Workspace::create(temp.path(), "भारत 😀", "Assess demand", "INR").unwrap();
    let reserved = Workspace::create(temp.path(), "CON", "Assess demand", "INR").unwrap();

    assert_eq!(
        unicode.root().file_name().unwrap().to_str(),
        Some("project-92d-93e-930-924-20-1f600")
    );
    assert_eq!(
        reserved.root().file_name().unwrap().to_str(),
        Some("con-project")
    );
    assert!(Workspace::open(unicode.root()).is_ok());
    assert!(Workspace::open(reserved.root()).is_ok());
}

#[test]
fn report_sections_reject_unsupported_schemas_without_overwriting_user_data() {
    let temp = tempfile::tempdir().unwrap();
    let workspace =
        Workspace::create(temp.path(), "Keyboard Study", "Assess demand", "INR").unwrap();
    let path = workspace.root().join("reports/report-sections.json");
    let original = fs::read_to_string(&path).unwrap();
    let unsupported = ReportSections {
        schema_version: SCHEMA_VERSION + 1,
        decision_summary: "Future-format data".into(),
        market_observations: vec![],
        risks: vec![],
        opportunities: vec![],
    };

    assert!(workspace.save_report_sections(&unsupported).is_err());
    assert_eq!(fs::read_to_string(&path).unwrap(), original);

    fs::write(&path, serde_json::to_string(&unsupported).unwrap()).unwrap();
    assert!(workspace.load_report_sections().is_err());
}
