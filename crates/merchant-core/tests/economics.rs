use merchant_core::{
    calculate_scenarios, CostAssumptions, DecimalString, ScenarioName, ScenarioPrices,
    SCHEMA_VERSION,
};

fn assumptions() -> CostAssumptions {
    CostAssumptions {
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
    }
}

#[test]
fn calculates_base_scenario_without_binary_floats() {
    let scenarios = calculate_scenarios(&assumptions()).unwrap();
    let base = scenarios
        .iter()
        .find(|row| row.scenario == ScenarioName::Base)
        .unwrap();
    assert_eq!(base.marketplace_fee.file_string(), "1124.85");
    assert_eq!(base.payment_fee.file_string(), "149.98");
    assert_eq!(base.total_cost.file_string(), "4974.83");
    assert_eq!(base.gross_profit.file_string(), "2524.17");
    assert_eq!(base.gross_margin_percent.file_string(), "33.66");
}

#[test]
fn zero_selling_price_is_rejected() {
    let mut assumptions = assumptions();
    assumptions.scenario_prices.low = Some(DecimalString::parse("0").unwrap());
    assert!(calculate_scenarios(&assumptions).is_err());
}
