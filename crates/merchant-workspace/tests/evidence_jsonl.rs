use chrono::Utc;
use merchant_core::{EvidenceSource, Observation, SCHEMA_VERSION};
use merchant_workspace::Workspace;

#[test]
fn evidence_round_trips_as_one_json_object_per_line() {
    let temp = tempfile::tempdir().unwrap();
    let workspace =
        Workspace::create(temp.path(), "Keyboard Study", "Assess demand", "INR").unwrap();
    let now = Utc::now();
    let evidence = vec![EvidenceSource {
        schema_version: SCHEMA_VERSION,
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
        observed_at: now,
        created_at: now,
        updated_at: now,
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
