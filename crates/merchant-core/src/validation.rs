use thiserror::Error;
use crate::{Competitor, EvidenceSource};

#[derive(Clone, Debug, Error, PartialEq, Eq)]
pub enum ValidationError {
    #[error("Project name is required")]
    MissingProjectName,
    #[error("Research objective is required")]
    MissingObjective,
    #[error("Currency must be exactly three uppercase ASCII letters")]
    InvalidCurrency,
    #[error("Invalid evidence source: {0}")]
    InvalidEvidence(String),
}

pub fn validate_evidence_sources(sources: &[EvidenceSource]) -> Result<(), ValidationError> {
    let mut ids = std::collections::HashSet::new();
    for source in sources {
        if source.schema_version != crate::SCHEMA_VERSION {
            return Err(ValidationError::InvalidEvidence(format!("{} has an unsupported schema version", source.id)));
        }
        if !source.id.starts_with("S-") || source.id.len() <= 2 || !ids.insert(&source.id) {
            return Err(ValidationError::InvalidEvidence("source IDs must be unique and start with S-".into()));
        }
        let valid_url = ["https://", "http://"].iter().any(|prefix| {
            source.url.strip_prefix(prefix).is_some_and(|rest| !rest.trim().is_empty())
        });
        if !valid_url {
            return Err(ValidationError::InvalidEvidence(format!("{} needs an http or https URL", source.id)));
        }
        if source.title.trim().is_empty() {
            return Err(ValidationError::InvalidEvidence(format!("{} needs a title", source.id)));
        }
    }
    Ok(())
}

pub fn validate_competitors(competitors: &[Competitor], project_currency: &str) -> Result<(), ValidationError> {
    let mut ids = std::collections::HashSet::new();
    for competitor in competitors {
        if competitor.schema_version != crate::SCHEMA_VERSION {
            return Err(ValidationError::InvalidEvidence(format!("{} has an unsupported schema version", competitor.id)));
        }
        if !competitor.id.starts_with("C-") || competitor.id.len() <= 2 || !ids.insert(&competitor.id) {
            return Err(ValidationError::InvalidEvidence("competitor IDs must be unique and start with C-".into()));
        }
        if competitor.product.trim().is_empty() || competitor.currency != project_currency {
            return Err(ValidationError::InvalidEvidence(format!("{} has an invalid product or currency", competitor.id)));
        }
        if competitor.price.is_some_and(|price| price.decimal().is_sign_negative()) {
            return Err(ValidationError::InvalidEvidence(format!("{} has a negative price", competitor.id)));
        }
    }
    Ok(())
}

pub fn validate_project_name(value: &str) -> Result<(), ValidationError> {
    if value.trim().is_empty() {
        return Err(ValidationError::MissingProjectName);
    }
    Ok(())
}

pub fn validate_objective(value: &str) -> Result<(), ValidationError> {
    if value.trim().is_empty() {
        return Err(ValidationError::MissingObjective);
    }
    Ok(())
}

pub fn validate_currency(value: &str) -> Result<(), ValidationError> {
    if value.len() == 3 && value.bytes().all(|byte| byte.is_ascii_uppercase()) {
        return Ok(());
    }
    Err(ValidationError::InvalidCurrency)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_required_project_fields_and_iso_currency_shape() {
        assert!(validate_project_name("Mechanical Keyboards India").is_ok());
        assert!(validate_objective("Assess demand").is_ok());
        assert!(validate_currency("INR").is_ok());
        assert!(validate_currency("inr").is_err());
        assert!(validate_currency("INRR").is_err());
    }
}
