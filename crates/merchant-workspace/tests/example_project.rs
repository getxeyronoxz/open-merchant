use std::path::PathBuf;

use merchant_workspace::Workspace;

#[test]
fn checked_in_example_opens_with_complete_artifacts() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join("examples/mechanical-keyboards-india");
    let workspace = Workspace::open(&root).unwrap();

    assert_eq!(workspace.load_snapshot().unwrap().manifest.currency, "INR");
    assert!(workspace.load_evidence().unwrap().len() >= 3);
    assert!(workspace.load_competitors().unwrap().len() >= 5);
    assert_eq!(workspace.load_scenarios().unwrap().len(), 3);
    assert!(workspace
        .read_artifact("reports/opportunity-report.md")
        .unwrap()
        .contains("## Risks"));
    assert_eq!(workspace.list_runs().unwrap().len(), 1);
    assert_eq!(workspace.list_provenance().unwrap().len(), 2);
}
