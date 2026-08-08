use std::path::PathBuf;

use merchant_core::{competitor_statistics, Competitor, CompetitorStatistics, CostAssumptions, EvidenceSource, ProjectSnapshot};
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

    pub fn save_manifest(
        &self,
        root: &str,
        manifest: merchant_core::ProjectManifest,
    ) -> Result<ProjectSnapshot, AppError> {
        let workspace = Workspace::open(root)?;
        let manifest = workspace.save_manifest(&manifest)?;
        let snapshot = ProjectSnapshot {
            root: workspace.root().to_string_lossy().into_owned(),
            manifest,
        };
        self.recents
            .upsert(snapshot.manifest.name.clone(), snapshot.root.clone())?;
        Ok(snapshot)
    }

    pub fn load_evidence(&self, root: &str) -> Result<Vec<EvidenceSource>, AppError> {
        Ok(Workspace::open(root)?.load_evidence()?)
    }

    pub fn save_evidence(&self, root: &str, evidence: Vec<EvidenceSource>) -> Result<(), AppError> {
        Workspace::open(root)?.save_evidence(&evidence)?;
        Ok(())
    }

    pub fn load_competitors(&self, root: &str) -> Result<Vec<Competitor>, AppError> {
        Ok(Workspace::open(root)?.load_competitors()?)
    }

    pub fn save_competitors(&self, root: &str, competitors: Vec<Competitor>) -> Result<(), AppError> {
        Workspace::open(root)?.save_competitors(&competitors)?;
        Ok(())
    }

    pub fn competitor_statistics(&self, root: &str) -> Result<CompetitorStatistics, AppError> {
        Ok(competitor_statistics(&Workspace::open(root)?.load_competitors()?))
    }

    pub fn load_assumptions(&self, root: &str) -> Result<CostAssumptions, AppError> { Ok(Workspace::open(root)?.load_assumptions()?) }

    pub fn save_assumptions(&self, root: &str, assumptions: CostAssumptions) -> Result<(), AppError> { Ok(Workspace::open(root)?.save_assumptions(&assumptions)?) }

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
