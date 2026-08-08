use std::path::PathBuf;

use merchant_core::{calculate_scenarios, competitor_statistics, render_opportunity_report, Competitor, CompetitorStatistics, CostAssumptions, EconomicsScenario, EvidenceSource, ProjectSnapshot, ReportInput, ReportSections};
use merchant_workspace::{ArtifactDescriptor, Workspace, WorkspaceError};
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

    pub fn calculate_and_save_scenarios(&self, root: &str) -> Result<Vec<EconomicsScenario>, AppError> {
        let workspace = Workspace::open(root)?;
        let scenarios = calculate_scenarios(&workspace.load_assumptions()?).map_err(|error| AppError::Domain(error.to_string()))?;
        workspace.save_scenarios(&scenarios)?;
        Ok(scenarios)
    }

    pub fn generate_report(&self, root: &str) -> Result<String, AppError> { let workspace = Workspace::open(root)?; let assumptions = workspace.load_assumptions()?; let scenarios = calculate_scenarios(&assumptions).map_err(|error| AppError::Domain(error.to_string()))?; workspace.save_scenarios(&scenarios)?; let input = ReportInput { manifest: workspace.load_snapshot()?.manifest, sections: workspace.load_report_sections()?, evidence: workspace.load_evidence()?, assumptions, scenarios, run_id: format!("RUN-{}", uuid::Uuid::new_v4()), generated_at: chrono::Utc::now() }; let markdown = render_opportunity_report(&input); workspace.write_opportunity_report(&markdown)?; Ok(markdown) }
    pub fn save_report_sections(&self, root: &str, sections: ReportSections) -> Result<(), AppError> { Ok(Workspace::open(root)?.save_report_sections(&sections)?) }

    pub fn list_artifacts(&self, root: &str) -> Result<Vec<ArtifactDescriptor>, AppError> { Ok(Workspace::open(root)?.list_artifacts()?) }
    pub fn read_artifact(&self, root: &str, relative_path: &str) -> Result<String, AppError> { Ok(Workspace::open(root)?.read_artifact(relative_path)?) }

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
    #[error("Calculation cannot run: {0}")]
    Domain(String),
}
