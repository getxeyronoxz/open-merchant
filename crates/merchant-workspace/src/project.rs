use std::{fs, path::{Path, PathBuf}};

use chrono::{DateTime, Utc};
use merchant_core::{validation::{validate_competitors, validate_currency, validate_evidence_sources, validate_objective, validate_project_name}, Competitor, DecimalString, EvidenceSource, ProjectManifest, ProjectSnapshot, SCHEMA_VERSION};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{atomic, paths, WorkspaceError};

#[derive(Clone, Debug)]
pub struct Workspace {
    root: PathBuf,
}

#[derive(Debug, Deserialize, Serialize)]
struct CompetitorCsv {
    schema_version: u32,
    id: String,
    product: String,
    brand: String,
    price: String,
    currency: String,
    marketplace: String,
    url: String,
    source_id: String,
    notes: String,
    observed_at: String,
}

impl From<&Competitor> for CompetitorCsv {
    fn from(competitor: &Competitor) -> Self {
        Self {
            schema_version: competitor.schema_version,
            id: competitor.id.clone(),
            product: competitor.product.clone(),
            brand: competitor.brand.clone(),
            price: competitor.price.map(DecimalString::file_string).unwrap_or_default(),
            currency: competitor.currency.clone(),
            marketplace: competitor.marketplace.clone(),
            url: competitor.url.clone(),
            source_id: competitor.source_id.clone().unwrap_or_default(),
            notes: competitor.notes.clone(),
            observed_at: competitor.observed_at.to_rfc3339(),
        }
    }
}

impl Workspace {
    pub fn create(
        parent: &Path,
        name: &str,
        objective: &str,
        currency: &str,
    ) -> Result<Self, WorkspaceError> {
        validate_project_name(name).map_err(|error| WorkspaceError::Validation(error.to_string()))?;
        validate_objective(objective).map_err(|error| WorkspaceError::Validation(error.to_string()))?;
        validate_currency(currency).map_err(|error| WorkspaceError::Validation(error.to_string()))?;

        let root = parent.join(project_folder_name(name));
        if root.exists() {
            return Err(WorkspaceError::AlreadyExists(root));
        }
        fs::create_dir_all(&root).map_err(|source| WorkspaceError::Io {
            path: root.clone(),
            source,
        })?;

        let now = Utc::now();
        let manifest = ProjectManifest {
            schema_version: SCHEMA_VERSION,
            project_id: Uuid::new_v4(),
            name: name.trim().to_owned(),
            objective: objective.trim().to_owned(),
            currency: currency.to_owned(),
            created_at: now,
            updated_at: now,
        };

        let result = initialize_files(&root, &manifest);
        if result.is_err() {
            let _ = fs::remove_dir_all(&root);
        }
        result?;
        Ok(Self { root })
    }

    pub fn open(root: impl AsRef<Path>) -> Result<Self, WorkspaceError> {
        let root = root.as_ref().to_path_buf();
        if !root.is_dir() {
            return Err(WorkspaceError::NotFound(root));
        }
        let workspace = Self { root };
        workspace.load_snapshot()?;
        Ok(workspace)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn load_snapshot(&self) -> Result<ProjectSnapshot, WorkspaceError> {
        let path = paths::at(&self.root, paths::MANIFEST);
        let raw = fs::read_to_string(&path).map_err(|source| WorkspaceError::Io {
            path: path.clone(),
            source,
        })?;
        let manifest: ProjectManifest = serde_json::from_str(&raw).map_err(|source| WorkspaceError::Json {
            path: path.clone(),
            source,
        })?;
        validate_manifest(&path, &manifest)?;
        Ok(ProjectSnapshot {
            root: self.root.to_string_lossy().into_owned(),
            manifest,
        })
    }

    pub fn save_manifest(&self, manifest: &ProjectManifest) -> Result<ProjectManifest, WorkspaceError> {
        validate_manifest(&paths::at(&self.root, paths::MANIFEST), manifest)?;
        let mut saved = manifest.clone();
        saved.updated_at = Utc::now();
        let path = paths::at(&self.root, paths::MANIFEST);
        let json = serde_json::to_vec_pretty(&saved).map_err(|source| WorkspaceError::Json {
            path: path.clone(),
            source,
        })?;
        atomic::write(&path, &with_newline(json))?;
        Ok(saved)
    }

    pub fn load_evidence(&self) -> Result<Vec<EvidenceSource>, WorkspaceError> {
        let path = paths::at(&self.root, paths::SOURCES);
        let contents = fs::read_to_string(&path).map_err(|source| WorkspaceError::Io {
            path: path.clone(),
            source,
        })?;
        let sources = contents
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| serde_json::from_str(line).map_err(|source| WorkspaceError::Json { path: path.clone(), source }))
            .collect::<Result<Vec<EvidenceSource>, WorkspaceError>>()?;
        validate_evidence_sources(&sources).map_err(|error| WorkspaceError::Validation(error.to_string()))?;
        Ok(sources)
    }

    pub fn save_evidence(&self, sources: &[EvidenceSource]) -> Result<(), WorkspaceError> {
        validate_evidence_sources(sources).map_err(|error| WorkspaceError::Validation(error.to_string()))?;
        let path = paths::at(&self.root, paths::SOURCES);
        let mut contents = String::new();
        for source in sources {
            let line = serde_json::to_string(source).map_err(|error| WorkspaceError::Json {
                path: path.clone(),
                source: error,
            })?;
            contents.push_str(&line);
            contents.push('\n');
        }
        atomic::write(&path, contents.as_bytes())
    }

    pub fn load_competitors(&self) -> Result<Vec<Competitor>, WorkspaceError> {
        let path = paths::at(&self.root, paths::COMPETITORS);
        let mut reader = csv::ReaderBuilder::new().from_path(&path).map_err(|source| WorkspaceError::Csv {
            path: path.clone(),
            source,
        })?;
        let competitors = reader.deserialize::<CompetitorCsv>()
            .map(|row| row.map_err(|source| WorkspaceError::Csv { path: path.clone(), source }))
            .map(|row| row.and_then(competitor_from_csv))
            .collect::<Result<Vec<_>, WorkspaceError>>()?;
        let currency = self.load_snapshot()?.manifest.currency;
        validate_competitors(&competitors, &currency).map_err(|error| WorkspaceError::Validation(error.to_string()))?;
        Ok(competitors)
    }

    pub fn save_competitors(&self, competitors: &[Competitor]) -> Result<(), WorkspaceError> {
        let path = paths::at(&self.root, paths::COMPETITORS);
        let currency = self.load_snapshot()?.manifest.currency;
        validate_competitors(competitors, &currency).map_err(|error| WorkspaceError::Validation(error.to_string()))?;
        let mut writer = csv::WriterBuilder::new().has_headers(true).terminator(csv::Terminator::Any(b'\n')).from_writer(Vec::new());
        for competitor in competitors {
            writer.serialize(CompetitorCsv::from(competitor)).map_err(|source| WorkspaceError::Csv {
                path: path.clone(),
                source,
            })?;
        }
        writer.flush().map_err(|source| WorkspaceError::Io { path: path.clone(), source })?;
        let contents = writer.into_inner().map_err(|error| WorkspaceError::Io {
            path: path.clone(),
            source: error.into_error(),
        })?;
        atomic::write(&path, &contents)
    }
}

fn competitor_from_csv(row: CompetitorCsv) -> Result<Competitor, WorkspaceError> {
    let price = if row.price.trim().is_empty() { None } else { Some(DecimalString::parse(&row.price).map_err(|error| WorkspaceError::Validation(error.to_string()))?) };
    let observed_at = DateTime::parse_from_rfc3339(&row.observed_at)
        .map_err(|error| WorkspaceError::Validation(format!("invalid competitor timestamp: {error}")))?
        .with_timezone(&Utc);
    Ok(Competitor {
        schema_version: row.schema_version,
        id: row.id,
        product: row.product,
        brand: row.brand,
        price,
        currency: row.currency,
        marketplace: row.marketplace,
        url: row.url,
        source_id: (!row.source_id.is_empty()).then_some(row.source_id),
        notes: row.notes,
        observed_at,
    })
}

fn initialize_files(root: &Path, manifest: &ProjectManifest) -> Result<(), WorkspaceError> {
    for relative in paths::ALL_ARTIFACTS {
        let path = paths::at(root, relative);
        let parent = path.parent().expect("workspace artifact paths always have parents");
        fs::create_dir_all(parent).map_err(|source| WorkspaceError::Io {
            path: parent.to_path_buf(),
            source,
        })?;
    }

    let manifest_json = serde_json::to_vec_pretty(manifest).map_err(|source| WorkspaceError::Json {
        path: paths::at(root, paths::MANIFEST),
        source,
    })?;
    atomic::write(&paths::at(root, paths::MANIFEST), &with_newline(manifest_json))?;

    for relative in [paths::SOURCES, paths::SCENARIOS, paths::OPPORTUNITY_REPORT, paths::RUNS, paths::PROVENANCE] {
        atomic::write(&paths::at(root, relative), b"")?;
    }
    atomic::write(
        &paths::at(root, paths::COMPETITORS),
        b"schema_version,id,product,brand,price,currency,marketplace,url,source_id,notes,observed_at\n",
    )?;
    atomic::write(
        &paths::at(root, paths::ASSUMPTIONS),
        b"{\n  \"schemaVersion\": 1,\n  \"acquisitionCost\": \"0\",\n  \"shippingCost\": \"0\",\n  \"marketplaceFeeRate\": \"0\",\n  \"paymentFeeRate\": \"0\",\n  \"otherCosts\": \"0\",\n  \"sellingPrices\": [\"0\", \"0\", \"0\"]\n}\n",
    )?;
    atomic::write(
        &paths::at(root, paths::REPORT_SECTIONS),
        b"{\n  \"schemaVersion\": 1,\n  \"decisionSummary\": \"\",\n  \"marketObservations\": [],\n  \"risks\": [],\n  \"opportunities\": []\n}\n",
    )?;
    Ok(())
}

fn validate_manifest(path: &Path, manifest: &ProjectManifest) -> Result<(), WorkspaceError> {
    if manifest.schema_version != SCHEMA_VERSION {
        return Err(WorkspaceError::InvalidProject {
            path: path.to_path_buf(),
            message: format!("schema version {} is not supported", manifest.schema_version),
        });
    }
    validate_project_name(&manifest.name).map_err(|error| invalid_manifest(path, error.to_string()))?;
    validate_objective(&manifest.objective).map_err(|error| invalid_manifest(path, error.to_string()))?;
    validate_currency(&manifest.currency).map_err(|error| invalid_manifest(path, error.to_string()))
}

fn invalid_manifest(path: &Path, message: String) -> WorkspaceError {
    WorkspaceError::InvalidProject { path: path.to_path_buf(), message }
}

fn project_folder_name(name: &str) -> String {
    let mut slug = String::new();
    let mut previous_was_separator = false;
    for character in name.trim().chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
            previous_was_separator = false;
        } else if !previous_was_separator && !slug.is_empty() {
            slug.push('-');
            previous_was_separator = true;
        }
    }
    slug.trim_matches('-').to_owned()
}

fn with_newline(mut contents: Vec<u8>) -> Vec<u8> {
    contents.push(b'\n');
    contents
}

#[cfg(test)]
mod tests {
    use super::project_folder_name;

    #[test]
    fn creates_a_portable_folder_name() {
        assert_eq!(project_folder_name("Mechanical Keyboards: India!"), "mechanical-keyboards-india");
    }
}
