use std::path::PathBuf;

use merchant_core::ProjectSnapshot;
use merchant_workspace::{Workspace, WorkspaceError};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::{RecentProject, RecentProjectsStore};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub parent_directory: String,
    pub name: String,
    pub objective: String,
    pub currency: String,
}

#[derive(Clone, Debug)]
pub struct MerchantService {
    recents: RecentProjectsStore,
}

impl MerchantService {
    pub fn new(recents: RecentProjectsStore) -> Self {
        Self { recents }
    }

    pub fn create_project(&self, request: CreateProjectRequest) -> Result<ProjectSnapshot, AppError> {
        let workspace = Workspace::create(
            &PathBuf::from(request.parent_directory),
            &request.name,
            &request.objective,
            &request.currency,
        )?;
        let snapshot = workspace.load_snapshot()?;
        self.recents
            .upsert(snapshot.manifest.name.clone(), snapshot.root.clone())?;
        Ok(snapshot)
    }

    pub fn open_project(&self, root: &str) -> Result<ProjectSnapshot, AppError> {
        let snapshot = Workspace::open(root)?.load_snapshot()?;
        self.recents
            .upsert(snapshot.manifest.name.clone(), snapshot.root.clone())?;
        Ok(snapshot)
    }

    pub fn list_recent_projects(&self) -> Result<Vec<RecentProject>, AppError> {
        self.recents.list()
    }

    pub fn remove_recent_project(&self, root: &str) -> Result<(), AppError> {
        self.recents.remove(root)
    }
}

#[derive(Debug, Error)]
pub enum AppError {
    #[error(transparent)]
    Workspace(#[from] WorkspaceError),
    #[error("Cannot access {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("Cannot read {path}: {source}")]
    Json {
        path: PathBuf,
        #[source]
        source: serde_json::Error,
    },
    #[error("Recent-projects store has no parent directory: {path}")]
    InvalidRecentStore { path: PathBuf },
}
