use merchant_core::{CostAssumptions, DecimalString, ScenarioPrices, SCHEMA_VERSION};
use merchant_workspace::Workspace;

#[test]
fn economics_inputs_round_trip_as_decimal_strings() {
    let temp = tempfile::tempdir().unwrap();
    let workspace =
        Workspace::create(temp.path(), "Keyboard Study", "Assess demand", "INR").unwrap();
    let assumptions = CostAssumptions {
        schema_version: SCHEMA_VERSION,
        currency: "INR".into(),
        acquisition_cost: DecimalString::parse("3200.00").unwrap(),
        shipping_cost: DecimalString::parse("350.00").unwrap(),
        marketplace_fee_rate: DecimalString::parse("15.00").unwrap(),
        payment_fee_rate: DecimalString::parse("2.00").unwrap(),
        other_costs: DecimalString::parse("150.00").unwrap(),
        scenario_prices: ScenarioPrices {
            low: Some(DecimalString::parse("5999.00").unwrap()),
            base: Some(DecimalString::parse("7499.00").unwrap()),
            high: Some(DecimalString::parse("8999.00").unwrap()),
        },
    };

    workspace.save_assumptions(&assumptions).unwrap();

    assert_eq!(workspace.load_assumptions().unwrap(), assumptions);
    assert!(
        std::fs::read_to_string(workspace.root().join("economics/assumptions.json"))
            .unwrap()
            .contains("\"acquisitionCost\": \"3200.00\"")
    );
}
