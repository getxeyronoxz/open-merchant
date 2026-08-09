use merchant_core::{
    calculate_scenarios, validation::validate_assumptions, CostAssumptions, DecimalString,
    ScenarioName, ScenarioPrices, SCHEMA_VERSION,
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

#[test]
fn calculates_fee_extremes_without_floating_point_drift() {
    let assumptions = CostAssumptions {
        schema_version: SCHEMA_VERSION,
        currency: "INR".into(),
        acquisition_cost: DecimalString::parse("0").unwrap(),
        shipping_cost: DecimalString::parse("0").unwrap(),
        marketplace_fee_rate: DecimalString::parse("100").unwrap(),
        payment_fee_rate: DecimalString::parse("0").unwrap(),
        other_costs: DecimalString::parse("0").unwrap(),
        scenario_prices: ScenarioPrices {
            low: Some(DecimalString::parse("0.01").unwrap()),
            base: Some(DecimalString::parse("123.45").unwrap()),
            high: Some(DecimalString::parse("1000000.01").unwrap()),
        },
    };

    let scenarios = calculate_scenarios(&assumptions).unwrap();
    for scenario in scenarios {
        assert_eq!(scenario.marketplace_fee, scenario.selling_price);
        assert_eq!(scenario.payment_fee.file_string(), "0.00");
        assert_eq!(scenario.total_cost, scenario.selling_price);
        assert_eq!(scenario.gross_profit.file_string(), "0.00");
        assert_eq!(scenario.gross_margin_percent.file_string(), "0.00");
    }
}

#[test]
fn rounds_decimal_fees_and_negative_margin_at_two_decimal_places() {
    let assumptions = CostAssumptions {
        schema_version: SCHEMA_VERSION,
        currency: "INR".into(),
        acquisition_cost: DecimalString::parse("10.01").unwrap(),
        shipping_cost: DecimalString::parse("0.02").unwrap(),
        marketplace_fee_rate: DecimalString::parse("12.50").unwrap(),
        payment_fee_rate: DecimalString::parse("2.50").unwrap(),
        other_costs: DecimalString::parse("0.03").unwrap(),
        scenario_prices: ScenarioPrices {
            low: Some(DecimalString::parse("5.00").unwrap()),
            base: Some(DecimalString::parse("19.99").unwrap()),
            high: Some(DecimalString::parse("19.99").unwrap()),
        },
    };

    let scenarios = calculate_scenarios(&assumptions).unwrap();
    let low = scenarios
        .iter()
        .find(|scenario| scenario.scenario == ScenarioName::Low)
        .unwrap();
    let base = scenarios
        .iter()
        .find(|scenario| scenario.scenario == ScenarioName::Base)
        .unwrap();

    assert_eq!(low.gross_profit.file_string(), "-5.81");
    assert_eq!(low.gross_margin_percent.file_string(), "-116.20");
    assert_eq!(base.marketplace_fee.file_string(), "2.50");
    assert_eq!(base.payment_fee.file_string(), "0.50");
    assert_eq!(base.total_cost.file_string(), "13.06");
    assert_eq!(base.gross_profit.file_string(), "6.93");
    assert_eq!(base.gross_margin_percent.file_string(), "34.67");
}

#[test]
fn rejects_invalid_fee_rates_and_missing_or_negative_prices() {
    let mut assumptions = assumptions();
    assumptions.marketplace_fee_rate = DecimalString::parse("-0.01").unwrap();
    assert!(validate_assumptions(&assumptions, "INR").is_err());

    assumptions.marketplace_fee_rate = DecimalString::parse("100.01").unwrap();
    assert!(validate_assumptions(&assumptions, "INR").is_err());

    assumptions.marketplace_fee_rate = DecimalString::parse("0").unwrap();
    assumptions.payment_fee_rate = DecimalString::parse("100").unwrap();
    assert!(validate_assumptions(&assumptions, "INR").is_ok());

    assumptions.scenario_prices.base = None;
    assert!(calculate_scenarios(&assumptions).is_err());

    assumptions.scenario_prices.base = Some(DecimalString::parse("-1").unwrap());
    assert!(calculate_scenarios(&assumptions).is_err());
}
