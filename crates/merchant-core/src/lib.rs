pub const SCHEMA_VERSION: u32 = 1;

pub mod economics;
pub mod model;
pub mod report;
pub mod statistics;
pub mod validation;

pub use economics::{calculate_scenarios, EconomicsScenario, ScenarioName};
pub use model::{
    Competitor, CostAssumptions, DecimalString, EvidenceSource, Observation, ProjectManifest,
    ProjectSnapshot, ReportInput, ReportSections, ScenarioPrices,
};
pub use report::render_opportunity_report;
pub use statistics::{competitor_statistics, CompetitorStatistics};

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
