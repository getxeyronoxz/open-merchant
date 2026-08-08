use rust_decimal::{Decimal, RoundingStrategy};
use serde::{Deserialize, Serialize};

use crate::{Competitor, DecimalString};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CompetitorStatistics {
    pub valid_price_count: usize,
    pub minimum: Option<DecimalString>,
    pub maximum: Option<DecimalString>,
    pub average: Option<DecimalString>,
    pub median: Option<DecimalString>,
}

pub fn competitor_statistics(competitors: &[Competitor]) -> CompetitorStatistics {
    let mut prices = competitors
        .iter()
        .filter_map(|competitor| competitor.price)
        .collect::<Vec<_>>();
    prices.sort();
    if prices.is_empty() {
        return CompetitorStatistics {
            valid_price_count: 0,
            minimum: None,
            maximum: None,
            average: None,
            median: None,
        };
    }
    let count = prices.len();
    let total = prices
        .iter()
        .fold(Decimal::ZERO, |sum, price| sum + price.decimal());
    let average = rounded(total / Decimal::from(count));
    let median = if count % 2 == 1 {
        prices[count / 2]
    } else {
        rounded((prices[(count / 2) - 1].decimal() + prices[count / 2].decimal()) / Decimal::TWO)
    };
    CompetitorStatistics {
        valid_price_count: count,
        minimum: prices.first().copied(),
        maximum: prices.last().copied(),
        average: Some(average),
        median: Some(median),
    }
}

fn rounded(value: Decimal) -> DecimalString {
    DecimalString::from_decimal(
        value.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero),
    )
}
