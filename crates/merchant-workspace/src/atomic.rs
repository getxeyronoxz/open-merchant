use std::{fs, path::Path};

use crate::WorkspaceError;

pub fn write(path: &Path, contents: &[u8]) -> Result<(), WorkspaceError> {
    let parent = path.parent().ok_or_else(|| WorkspaceError::InvalidProject {
        path: path.to_path_buf(),
        message: "file has no parent directory".to_owned(),
    })?;
    fs::create_dir_all(parent).map_err(|source| WorkspaceError::Io {
        path: parent.to_path_buf(),
        source,
    })?;

    let file_name = path.file_name().and_then(|name| name.to_str()).ok_or_else(|| {
        WorkspaceError::InvalidProject {
            path: path.to_path_buf(),
            message: "file name is not valid UTF-8".to_owned(),
        }
    })?;
    let temporary = parent.join(format!(".{file_name}.tmp"));
    fs::write(&temporary, contents).map_err(|source| WorkspaceError::Io {
        path: temporary.clone(),
        source,
    })?;
    fs::rename(&temporary, path).map_err(|source| WorkspaceError::Io {
        path: path.to_path_buf(),
        source,
    })
}
