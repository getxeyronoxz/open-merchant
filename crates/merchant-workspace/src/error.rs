use std::path::PathBuf;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum WorkspaceError {
    #[error("Project folder already exists: {0}")]
    AlreadyExists(PathBuf),
    #[error("Project folder does not exist: {0}")]
    NotFound(PathBuf),
    #[error("Invalid Open Merchant project at {path}: {message}")]
    InvalidProject { path: PathBuf, message: String },
    #[error("Cannot use workspace path {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("Cannot read workspace file {path}: {source}")]
    Json {
        path: PathBuf,
        #[source]
        source: serde_json::Error,
    },
    #[error("Cannot read workspace CSV {path}: {source}")]
    Csv {
        path: PathBuf,
        #[source]
        source: csv::Error,
    },
    #[error("Invalid project input: {0}")]
    Validation(String),
    #[error("Unknown workspace artifact: {0}")]
    UnknownArtifact(String),
    #[error("Workspace artifact exceeds the 2 MiB text-viewer limit: {0}")]
    ArtifactTooLarge(PathBuf),
}
