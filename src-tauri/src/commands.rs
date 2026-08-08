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
