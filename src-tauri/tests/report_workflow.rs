use chrono::Utc;
use merchant_core::{Competitor, CostAssumptions, DecimalString, ScenarioPrices, SCHEMA_VERSION};
use open_merchant_lib::application::{CreateProjectRequest, MerchantService, RecentProjectsStore};
use sha2::{Digest, Sha256};
use std::fs;

#[test]
fn generating_a_report_records_its_run_and_output_provenance() {
    let temp = tempfile::tempdir().unwrap();
    let service = MerchantService::new(RecentProjectsStore::new(temp.path().join("recents.json")));
    let snapshot = service
        .create_project(CreateProjectRequest {
            parent_directory: temp.path().to_string_lossy().into_owned(),
            name: "Keyboard Study".into(),
            objective: "Assess whether keyboards are commercially attractive".into(),
            currency: "INR".into(),
        })
        .unwrap();

    service
        .save_assumptions(
            &snapshot.root,
            CostAssumptions {
                schema_version: SCHEMA_VERSION,
                currency: "INR".into(),
                acquisition_cost: DecimalString::parse("1800").unwrap(),
                shipping_cost: DecimalString::parse("120").unwrap(),
                marketplace_fee_rate: DecimalString::parse("12").unwrap(),
                payment_fee_rate: DecimalString::parse("2").unwrap(),
                other_costs: DecimalString::parse("80").unwrap(),
                scenario_prices: ScenarioPrices {
                    low: Some(DecimalString::parse("3000").unwrap()),
                    base: Some(DecimalString::parse("4000").unwrap()),
                    high: Some(DecimalString::parse("5000").unwrap()),
                },
            },
        )
        .unwrap();
    service
        .save_competitors(
            &snapshot.root,
            vec![competitor("C-001", "3000"), competitor("C-002", "5000")],
        )
        .unwrap();

    let markdown = service.generate_report(&snapshot.root).unwrap();

    assert!(markdown.contains("# Keyboard Study"));
    assert!(markdown.contains("## Competitor price statistics"));
    assert!(markdown.contains("- Priced competitors: 2"));
    assert!(markdown.contains("- Price range: INR 3000.00–5000.00"));
    assert!(markdown.contains("- Average price: INR 4000.00"));
    assert!(markdown.contains("- Median price: INR 4000.00"));
    let runs = service.list_runs(&snapshot.root).unwrap();
    assert_eq!(runs.len(), 1);
    assert_eq!(
        runs[0].operation,
        merchant_workspace::RunOperation::ReportGenerated
    );
    assert_eq!(runs[0].output_artifacts.len(), 2);
    assert!(runs[0]
        .output_artifacts
        .iter()
        .all(|artifact| artifact.sha256.len() == 64));
    for artifact in &runs[0].output_artifacts {
        assert_eq!(
            artifact.sha256,
            sha256(snapshot.root.as_ref(), &artifact.path)
        );
    }
    for artifact in &runs[0].input_artifacts {
        assert_eq!(
            artifact.sha256,
            sha256(snapshot.root.as_ref(), &artifact.path)
        );
    }
    assert!(runs[0]
        .input_artifacts
        .iter()
        .any(|artifact| artifact.path == "merchant-project.json"));
    let original_assumptions_hash = runs[0]
        .input_artifacts
        .iter()
        .find(|artifact| artifact.path == "economics/assumptions.json")
        .unwrap()
        .sha256
        .clone();

    let provenance = service.list_provenance(&snapshot.root).unwrap();
    assert_eq!(provenance.len(), 2);
    assert!(provenance
        .iter()
        .all(|record| record.run_id == runs[0].run_id));

    let mut revised_assumptions = service.load_assumptions(&snapshot.root).unwrap();
    revised_assumptions.scenario_prices.base = Some(DecimalString::parse("7000").unwrap());
    service
        .save_assumptions(&snapshot.root, revised_assumptions)
        .unwrap();
    let revised_markdown = service.generate_report(&snapshot.root).unwrap();
    assert!(revised_markdown.contains("| Base | INR 7000.00 |"));

    let runs = service.list_runs(&snapshot.root).unwrap();
    let provenance = service.list_provenance(&snapshot.root).unwrap();
    assert_eq!(runs.len(), 2);
    assert_eq!(provenance.len(), 4);
    assert_ne!(runs[0].run_id, runs[1].run_id);
    for artifact in &runs[1].input_artifacts {
        assert_eq!(
            artifact.sha256,
            sha256(snapshot.root.as_ref(), &artifact.path)
        );
    }
    assert_ne!(
        original_assumptions_hash,
        runs[1]
            .input_artifacts
            .iter()
            .find(|artifact| artifact.path == "economics/assumptions.json")
            .unwrap()
            .sha256
    );
    for artifact in &runs[1].output_artifacts {
        assert_eq!(
            artifact.sha256,
            sha256(snapshot.root.as_ref(), &artifact.path)
        );
    }
    assert!(provenance
        .iter()
        .skip(2)
        .all(|record| record.run_id == runs[1].run_id));
}

fn competitor(id: &str, price: &str) -> Competitor {
    Competitor {
        schema_version: SCHEMA_VERSION,
        id: id.into(),
        product: "Mechanical keyboard".into(),
        brand: "Example brand".into(),
        price: Some(DecimalString::parse(price).unwrap()),
        currency: "INR".into(),
        marketplace: "Example marketplace".into(),
        url: "https://example.com/listing".into(),
        source_id: None,
        notes: String::new(),
        observed_at: Utc::now(),
    }
}

fn sha256(root: &str, relative_path: &str) -> String {
    format!(
        "{:x}",
        Sha256::digest(fs::read(std::path::Path::new(root).join(relative_path)).unwrap())
    )
}
