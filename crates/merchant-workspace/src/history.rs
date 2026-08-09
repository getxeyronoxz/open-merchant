use std::{fs, path::Path};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{atomic, paths, Workspace, WorkspaceError};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactFingerprint {
    pub path: String,
    pub sha256: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RunOperation {
    ProjectCreated,
    EconomicsGenerated,
    ReportGenerated,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RunStatus {
    Succeeded,
    Failed,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunRecord {
    pub schema_version: u32,
    pub run_id: String,
    pub operation: RunOperation,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub status: RunStatus,
    pub app_version: String,
    pub input_artifacts: Vec<ArtifactFingerprint>,
    pub output_artifacts: Vec<ArtifactFingerprint>,
    pub source_ids: Vec<String>,
    pub error_summary: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProvenanceRecord {
    pub schema_version: u32,
    pub artifact_path: String,
    pub sha256: String,
    pub generated_at: DateTime<Utc>,
    pub run_id: String,
}

impl Workspace {
    pub fn append_run(&self, run: &RunRecord) -> Result<(), WorkspaceError> {
        append_jsonl(&self.artifact_path(paths::RUNS)?, run)
    }
    pub fn replace_run(&self, replacement: &RunRecord) -> Result<(), WorkspaceError> {
        let path = self.artifact_path(paths::RUNS)?;
        let mut runs: Vec<RunRecord> = read_jsonl(&path)?;
        let run = runs
            .iter_mut()
            .find(|run| run.run_id == replacement.run_id)
            .ok_or_else(|| WorkspaceError::RunNotFound(replacement.run_id.clone()))?;
        *run = replacement.clone();
        write_jsonl(&path, &runs)
    }
    pub fn append_provenance(&self, provenance: &ProvenanceRecord) -> Result<(), WorkspaceError> {
        append_jsonl(&self.artifact_path(paths::PROVENANCE)?, provenance)
    }
    pub fn list_runs(&self) -> Result<Vec<RunRecord>, WorkspaceError> {
        read_jsonl(&self.artifact_path(paths::RUNS)?)
    }
    pub fn list_provenance(&self) -> Result<Vec<ProvenanceRecord>, WorkspaceError> {
        read_jsonl(&self.artifact_path(paths::PROVENANCE)?)
    }
    pub fn fingerprint_artifact(
        &self,
        relative_path: &str,
    ) -> Result<ArtifactFingerprint, WorkspaceError> {
        if !paths::ALL_ARTIFACTS.contains(&relative_path) {
            return Err(WorkspaceError::UnknownArtifact(relative_path.to_owned()));
        }
        fingerprint(&self.artifact_path(relative_path)?, relative_path)
    }
}

fn append_jsonl<T: Serialize>(path: &Path, record: &T) -> Result<(), WorkspaceError> {
    let mut existing = fs::read_to_string(path).map_err(|source| WorkspaceError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    existing.push_str(
        &serde_json::to_string(record).map_err(|source| WorkspaceError::Json {
            path: path.to_path_buf(),
            source,
        })?,
    );
    existing.push('\n');
    atomic::write(path, existing.as_bytes())
}
fn write_jsonl<T: Serialize>(path: &Path, records: &[T]) -> Result<(), WorkspaceError> {
    let mut contents = String::new();
    for record in records {
        contents.push_str(
            &serde_json::to_string(record).map_err(|source| WorkspaceError::Json {
                path: path.to_path_buf(),
                source,
            })?,
        );
        contents.push('\n');
    }
    atomic::write(path, contents.as_bytes())
}
fn read_jsonl<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<Vec<T>, WorkspaceError> {
    fs::read_to_string(path)
        .map_err(|source| WorkspaceError::Io {
            path: path.to_path_buf(),
            source,
        })?
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            serde_json::from_str(line).map_err(|source| WorkspaceError::Json {
                path: path.to_path_buf(),
                source,
            })
        })
        .collect()
}
fn fingerprint(path: &Path, relative_path: &str) -> Result<ArtifactFingerprint, WorkspaceError> {
    let bytes = fs::read(path).map_err(|source| WorkspaceError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    Ok(ArtifactFingerprint {
        path: relative_path.to_owned(),
        sha256: format!("{:x}", Sha256::digest(bytes)),
    })
}
