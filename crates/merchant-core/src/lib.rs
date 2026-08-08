pub const SCHEMA_VERSION: u32 = 1;

pub mod model;
pub mod validation;
pub mod statistics;
pub mod economics;
pub mod report;

pub use model::{Competitor, CostAssumptions, DecimalString, EvidenceSource, Observation, ProjectManifest, ProjectSnapshot, ReportInput, ReportSections, ScenarioPrices};
pub use statistics::{competitor_statistics, CompetitorStatistics};
pub use economics::{calculate_scenarios, EconomicsScenario, ScenarioName};
pub use report::render_opportunity_report;

#[derive(Clone, Debug, thiserror::Error, PartialEq, Eq)]
pub enum DomainError {
    #[error("Invalid decimal amount: {0}")]
    InvalidDecimal(String),
    #[error("Every selling-price scenario must be provided")]
    MissingScenarioPrice,
    #[error("Selling prices must be positive")]
    SellingPriceMustBePositive,
}

#[cfg(test)]
mod tests {
    #[test]
    fn schema_version_starts_at_one() {
        assert_eq!(super::SCHEMA_VERSION, 1);
    }
}
