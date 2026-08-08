use merchant_core::ProjectSnapshot;
use serde::Serialize;
use tauri::State;

use crate::application::{AppError, CreateProjectRequest, MerchantService, RecentProject};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: String,
    pub message: String,
    pub detail: String,
}

impl From<AppError> for CommandError {
    fn from(error: AppError) -> Self {
        let code = match &error {
            AppError::Workspace(merchant_workspace::WorkspaceError::AlreadyExists(_)) => "already-exists",
            AppError::Workspace(merchant_workspace::WorkspaceError::NotFound(_)) => "not-a-project",
            AppError::Workspace(merchant_workspace::WorkspaceError::Validation(_)) => "invalid-input",
            AppError::Workspace(merchant_workspace::WorkspaceError::InvalidProject { .. }) => "invalid-project",
            _ => "storage-error",
        };
        Self {
            code: code.to_owned(),
            message: error.to_string(),
            detail: format!("{error:?}"),
        }
    }
}

#[tauri::command]
pub fn create_project(
    service: State<'_, MerchantService>,
    request: CreateProjectRequest,
) -> Result<ProjectSnapshot, CommandError> {
    service.create_project(request).map_err(Into::into)
}

#[tauri::command]
pub fn open_project(
    service: State<'_, MerchantService>,
    root: String,
) -> Result<ProjectSnapshot, CommandError> {
    service.open_project(&root).map_err(Into::into)
}

#[tauri::command]
pub fn save_manifest(
    service: State<'_, MerchantService>,
    root: String,
    manifest: merchant_core::ProjectManifest,
) -> Result<ProjectSnapshot, CommandError> {
    service.save_manifest(&root, manifest).map_err(Into::into)
}

#[tauri::command]
pub fn load_evidence(
    service: State<'_, MerchantService>,
    root: String,
) -> Result<Vec<merchant_core::EvidenceSource>, CommandError> {
    service.load_evidence(&root).map_err(Into::into)
}

#[tauri::command]
pub fn save_evidence(
    service: State<'_, MerchantService>,
    root: String,
    evidence: Vec<merchant_core::EvidenceSource>,
) -> Result<(), CommandError> {
    service.save_evidence(&root, evidence).map_err(Into::into)
}

#[tauri::command]
pub fn load_competitors(service: State<'_, MerchantService>, root: String) -> Result<Vec<merchant_core::Competitor>, CommandError> {
    service.load_competitors(&root).map_err(Into::into)
}

#[tauri::command]
pub fn save_competitors(service: State<'_, MerchantService>, root: String, competitors: Vec<merchant_core::Competitor>) -> Result<(), CommandError> {
    service.save_competitors(&root, competitors).map_err(Into::into)
}

#[tauri::command]
pub fn competitor_statistics(service: State<'_, MerchantService>, root: String) -> Result<merchant_core::CompetitorStatistics, CommandError> {
    service.competitor_statistics(&root).map_err(Into::into)
}

#[tauri::command]
pub fn load_assumptions(service: State<'_, MerchantService>, root: String) -> Result<merchant_core::CostAssumptions, CommandError> { service.load_assumptions(&root).map_err(Into::into) }

#[tauri::command]
pub fn save_assumptions(service: State<'_, MerchantService>, root: String, assumptions: merchant_core::CostAssumptions) -> Result<(), CommandError> { service.save_assumptions(&root, assumptions).map_err(Into::into) }

#[tauri::command]
pub fn calculate_and_save_scenarios(service: State<'_, MerchantService>, root: String) -> Result<Vec<merchant_core::EconomicsScenario>, CommandError> { service.calculate_and_save_scenarios(&root).map_err(Into::into) }

#[tauri::command]
pub fn list_recent_projects(
    service: State<'_, MerchantService>,
) -> Result<Vec<RecentProject>, CommandError> {
    service.list_recent_projects().map_err(Into::into)
}

#[tauri::command]
pub fn remove_recent_project(
    service: State<'_, MerchantService>,
    root: String,
) -> Result<(), CommandError> {
    service.remove_recent_project(&root).map_err(Into::into)
}
