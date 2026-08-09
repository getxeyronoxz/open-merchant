use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};
use uuid::Uuid;

use crate::DomainError;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct DecimalString(Decimal);

impl DecimalString {
    pub fn parse(value: &str) -> Result<Self, DomainError> {
        let decimal =
            Decimal::from_str(value).map_err(|_| DomainError::InvalidDecimal(value.to_owned()))?;
        if decimal.scale() > 2 {
            return Err(DomainError::InvalidDecimal(value.to_owned()));
        }
        Ok(Self(decimal))
    }

    pub fn decimal(self) -> Decimal {
        self.0
    }

    pub fn from_decimal(value: Decimal) -> Self {
        Self(value)
    }

    pub fn file_string(self) -> String {
        format!("{:.2}", self.0.round_dp(2))
    }
}

impl Serialize for DecimalString {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.file_string())
    }
}

impl<'de> Deserialize<'de> for DecimalString {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::parse(&value).map_err(serde::de::Error::custom)
    }
}

impl fmt::Display for DecimalString {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.file_string().fmt(formatter)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectManifest {
    pub schema_version: u32,
    pub project_id: Uuid,
    pub name: String,
    pub objective: String,
    pub currency: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub root: String,
    pub manifest: ProjectManifest,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Observation {
    pub id: String,
    pub label: String,
    pub value: String,
    pub unit: Option<String>,
    pub note: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceSource {
    pub schema_version: u32,
    pub id: String,
    pub url: String,
    pub title: String,
    pub notes: String,
    pub observations: Vec<Observation>,
    pub observed_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Competitor {
    pub schema_version: u32,
    pub id: String,
    pub product: String,
    pub brand: String,
    pub price: Option<DecimalString>,
    pub currency: String,
    pub marketplace: String,
    pub url: String,
    pub source_id: Option<String>,
    pub notes: String,
    pub observed_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioPrices {
    pub low: Option<DecimalString>,
    pub base: Option<DecimalString>,
    pub high: Option<DecimalString>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CostAssumptions {
    pub schema_version: u32,
    pub currency: String,
    pub acquisition_cost: DecimalString,
    pub shipping_cost: DecimalString,
    pub marketplace_fee_rate: DecimalString,
    pub payment_fee_rate: DecimalString,
    pub other_costs: DecimalString,
    pub scenario_prices: ScenarioPrices,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReportSections {
    pub schema_version: u32,
    pub decision_summary: String,
    pub market_observations: Vec<String>,
    pub risks: Vec<String>,
    pub opportunities: Vec<String>,
}
impl ReportSections {
    pub fn empty() -> Self {
        Self {
            schema_version: crate::SCHEMA_VERSION,
            decision_summary: String::new(),
            market_observations: vec![],
            risks: vec![],
            opportunities: vec![],
        }
    }
}

#[derive(Clone, Debug)]
pub struct ReportInput {
    pub manifest: ProjectManifest,
    pub sections: ReportSections,
    pub evidence: Vec<EvidenceSource>,
    pub competitor_statistics: crate::CompetitorStatistics,
    pub assumptions: CostAssumptions,
    pub scenarios: Vec<crate::EconomicsScenario>,
    pub run_id: String,
    pub generated_at: DateTime<Utc>,
}

impl CostAssumptions {
    pub fn empty(currency: impl Into<String>) -> Self {
        let zero = DecimalString::from_decimal(Decimal::ZERO);
        Self {
            schema_version: crate::SCHEMA_VERSION,
            currency: currency.into(),
            acquisition_cost: zero,
            shipping_cost: zero,
            marketplace_fee_rate: zero,
            payment_fee_rate: zero,
            other_costs: zero,
            scenario_prices: ScenarioPrices {
                low: None,
                base: None,
                high: None,
            },
        }
    }
}
