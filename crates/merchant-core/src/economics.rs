use rust_decimal::{Decimal, RoundingStrategy};
use serde::{Deserialize, Serialize};

use crate::{CostAssumptions, DecimalString, DomainError};

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ScenarioName { Low, Base, High }

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EconomicsScenario {
    pub scenario: ScenarioName,
    pub selling_price: DecimalString,
    pub acquisition_cost: DecimalString,
    pub shipping_cost: DecimalString,
    pub marketplace_fee_rate: DecimalString,
    pub marketplace_fee: DecimalString,
    pub payment_fee_rate: DecimalString,
    pub payment_fee: DecimalString,
    pub other_costs: DecimalString,
    pub total_cost: DecimalString,
    pub gross_profit: DecimalString,
    pub gross_margin_percent: DecimalString,
}

pub fn calculate_scenarios(assumptions: &CostAssumptions) -> Result<Vec<EconomicsScenario>, DomainError> {
    [ (ScenarioName::Low, assumptions.scenario_prices.low), (ScenarioName::Base, assumptions.scenario_prices.base), (ScenarioName::High, assumptions.scenario_prices.high) ]
        .into_iter()
        .map(|(scenario, price)| calculate_scenario(scenario, price.ok_or(DomainError::MissingScenarioPrice)?, assumptions))
        .collect()
}

fn calculate_scenario(scenario: ScenarioName, selling_price: DecimalString, assumptions: &CostAssumptions) -> Result<EconomicsScenario, DomainError> {
    let selling = selling_price.decimal();
    if selling <= Decimal::ZERO { return Err(DomainError::SellingPriceMustBePositive); }
    let marketplace_fee = selling * assumptions.marketplace_fee_rate.decimal() / Decimal::from(100);
    let payment_fee = selling * assumptions.payment_fee_rate.decimal() / Decimal::from(100);
    let total_cost = assumptions.acquisition_cost.decimal() + assumptions.shipping_cost.decimal() + marketplace_fee + payment_fee + assumptions.other_costs.decimal();
    let gross_profit = selling - total_cost;
    let gross_margin_percent = gross_profit / selling * Decimal::from(100);
    Ok(EconomicsScenario { scenario, selling_price, acquisition_cost: assumptions.acquisition_cost, shipping_cost: assumptions.shipping_cost, marketplace_fee_rate: assumptions.marketplace_fee_rate, marketplace_fee: rounded(marketplace_fee), payment_fee_rate: assumptions.payment_fee_rate, payment_fee: rounded(payment_fee), other_costs: assumptions.other_costs, total_cost: rounded(total_cost), gross_profit: rounded(gross_profit), gross_margin_percent: rounded(gross_margin_percent) })
}

fn rounded(value: Decimal) -> DecimalString { DecimalString::from_decimal(value.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)) }
