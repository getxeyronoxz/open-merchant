pub const SCHEMA_VERSION: u32 = 1;

pub mod model;
pub mod validation;
pub mod statistics;

pub use model::{Competitor, CostAssumptions, DecimalString, EvidenceSource, Observation, ProjectManifest, ProjectSnapshot, ScenarioPrices};
pub use statistics::{competitor_statistics, CompetitorStatistics};

#[derive(Clone, Debug, thiserror::Error, PartialEq, Eq)]
pub enum DomainError {
    #[error("Invalid decimal amount: {0}")]
    InvalidDecimal(String),
}

#[cfg(test)]
mod tests {
    #[test]
    fn schema_version_starts_at_one() {
        assert_eq!(super::SCHEMA_VERSION, 1);
    }
}
