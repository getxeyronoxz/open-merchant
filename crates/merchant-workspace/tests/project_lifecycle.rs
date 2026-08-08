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
