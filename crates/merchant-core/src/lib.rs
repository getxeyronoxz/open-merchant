pub const SCHEMA_VERSION: u32 = 1;

pub mod model;
pub mod validation;

pub use model::{EvidenceSource, Observation, ProjectManifest, ProjectSnapshot};

#[cfg(test)]
mod tests {
    #[test]
    fn schema_version_starts_at_one() {
        assert_eq!(super::SCHEMA_VERSION, 1);
    }
}
