use thiserror::Error;

#[derive(Clone, Debug, Error, PartialEq, Eq)]
pub enum ValidationError {
    #[error("Project name is required")]
    MissingProjectName,
    #[error("Research objective is required")]
    MissingObjective,
    #[error("Currency must be exactly three uppercase ASCII letters")]
    InvalidCurrency,
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
