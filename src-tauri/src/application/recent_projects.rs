use std::{fs, path::{Path, PathBuf}};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::AppError;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub last_opened_at: DateTime<Utc>,
}

#[derive(Clone, Debug)]
pub struct RecentProjectsStore {
    path: PathBuf,
}

impl RecentProjectsStore {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    pub fn list(&self) -> Result<Vec<RecentProject>, AppError> {
        if !self.path.exists() {
            return Ok(Vec::new());
        }
        let contents = fs::read_to_string(&self.path).map_err(|source| AppError::Io {
            path: self.path.clone(),
            source,
        })?;
        serde_json::from_str(&contents).map_err(|source| AppError::Json {
            path: self.path.clone(),
            source,
        })
    }

    pub fn upsert(&self, name: String, path: String) -> Result<(), AppError> {
        let mut projects = self.list()?;
        projects.retain(|project| project.path != path);
        projects.insert(0, RecentProject {
            name,
            path,
            last_opened_at: Utc::now(),
        });
        projects.truncate(20);
        self.save(&projects)
    }

    pub fn remove(&self, root: &str) -> Result<(), AppError> {
        let mut projects = self.list()?;
        projects.retain(|project| project.path != root);
        self.save(&projects)
    }

    fn save(&self, projects: &[RecentProject]) -> Result<(), AppError> {
        let parent = self.path.parent().ok_or_else(|| AppError::InvalidRecentStore {
            path: self.path.clone(),
        })?;
        fs::create_dir_all(parent).map_err(|source| AppError::Io {
            path: parent.to_path_buf(),
            source,
        })?;
        let contents = serde_json::to_vec_pretty(projects).map_err(|source| AppError::Json {
            path: self.path.clone(),
            source,
        })?;
        let temporary = self.path.with_extension("json.tmp");
        fs::write(&temporary, contents).map_err(|source| AppError::Io {
            path: temporary.clone(),
            source,
        })?;
        if self.path.exists() {
            fs::remove_file(&self.path).map_err(|source| AppError::Io {
                path: self.path.clone(),
                source,
            })?;
        }
        fs::rename(&temporary, &self.path).map_err(|source| AppError::Io {
            path: self.path.clone(),
            source,
        })
    }
}

impl AsRef<Path> for RecentProjectsStore {
    fn as_ref(&self) -> &Path {
        &self.path
    }
}
