use std::fs;

use serde::Serialize;

use crate::{paths, Workspace, WorkspaceError};

const MAX_TEXT_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactDescriptor {
    pub relative_path: String,
    pub kind: String,
    pub generated: bool,
    pub exists: bool,
}

impl Workspace {
    pub fn list_artifacts(&self) -> Result<Vec<ArtifactDescriptor>, WorkspaceError> {
        Ok(paths::ALL_ARTIFACTS
            .iter()
            .map(|relative_path| ArtifactDescriptor {
                relative_path: (*relative_path).to_owned(),
                kind: kind(relative_path).to_owned(),
                generated: matches!(*relative_path, paths::SCENARIOS | paths::OPPORTUNITY_REPORT),
                exists: self.root().join(relative_path).is_file(),
            })
            .collect())
    }

    pub fn read_artifact(&self, relative_path: &str) -> Result<String, WorkspaceError> {
        if !paths::ALL_ARTIFACTS.contains(&relative_path) {
            return Err(WorkspaceError::UnknownArtifact(relative_path.to_owned()));
        }
        let path = self.root().join(relative_path);
        let metadata = fs::metadata(&path).map_err(|source| WorkspaceError::Io { path: path.clone(), source })?;
        if metadata.len() > MAX_TEXT_BYTES {
            return Err(WorkspaceError::ArtifactTooLarge(path));
        }
        fs::read_to_string(&path).map_err(|source| WorkspaceError::Io { path, source })
    }
}

fn kind(path: &str) -> &'static str {
    if path.ends_with(".md") { "markdown" } else if path.ends_with(".csv") { "csv" } else if path.ends_with(".jsonl") { "jsonl" } else { "json" }
}
