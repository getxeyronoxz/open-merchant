use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use rust_decimal::Decimal;
use std::{fmt, str::FromStr};

use crate::DomainError;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct DecimalString(Decimal);

impl DecimalString {
    pub fn parse(value: &str) -> Result<Self, DomainError> {
        let decimal = Decimal::from_str(value).map_err(|_| DomainError::InvalidDecimal(value.to_owned()))?;
        if decimal.scale() > 2 {
            return Err(DomainError::InvalidDecimal(value.to_owned()));
        }
        Ok(Self(decimal))
    }

    pub fn decimal(self) -> Decimal { self.0 }

    pub fn from_decimal(value: Decimal) -> Self { Self(value) }

    pub fn file_string(self) -> String { format!("{:.2}", self.0.round_dp(2)) }
}

impl Serialize for DecimalString {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error> where S: serde::Serializer {
        serializer.serialize_str(&self.file_string())
    }
}

impl<'de> Deserialize<'de> for DecimalString {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error> where D: serde::Deserializer<'de> {
        let value = String::deserialize(deserializer)?;
        Self::parse(&value).map_err(serde::de::Error::custom)
    }
}

impl fmt::Display for DecimalString {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result { self.file_string().fmt(formatter) }
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
