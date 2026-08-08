use merchant_core::{CostAssumptions, DecimalString, ScenarioPrices, SCHEMA_VERSION};
use open_merchant_lib::application::{CreateProjectRequest, MerchantService, RecentProjectsStore};

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

    let markdown = service.generate_report(&snapshot.root).unwrap();

    assert!(markdown.contains("# Keyboard Study"));
    let runs = service.list_runs(&snapshot.root).unwrap();
    assert_eq!(runs.len(), 1);
    assert_eq!(runs[0].operation, merchant_workspace::RunOperation::ReportGenerated);
    assert_eq!(runs[0].output_artifacts.len(), 2);
    assert!(runs[0]
        .output_artifacts
        .iter()
        .all(|artifact| artifact.sha256.len() == 64));

    let provenance = service.list_provenance(&snapshot.root).unwrap();
    assert_eq!(provenance.len(), 2);
    assert!(provenance
        .iter()
        .all(|record| record.run_id == runs[0].run_id));
}
