//! Validation for every path that enters a command (spec 5.2). Windows ACLs
//! govern everything else; protected targets join in piece 2b with the
//! operations that need them.

use std::path::{Component, Path, PathBuf};

use crate::error::{ErrorCode, FilewellError};

#[cfg(test)]
mod tests;

/// Windows' extended-length limit, in characters.
pub const MAX_PATH_CHARS: usize = 32_000;

pub fn validate_path(raw: &str) -> Result<PathBuf, FilewellError> {
    let invalid = |why: &str| FilewellError::new(ErrorCode::InvalidPath, why).with_path(raw);
    if raw.trim().is_empty() {
        return Err(invalid("The path is empty."));
    }
    if raw.contains('\0') {
        return Err(invalid("The path contains a NUL character."));
    }
    if raw.chars().count() > MAX_PATH_CHARS {
        return Err(invalid("The path is longer than Windows allows."));
    }
    let path = Path::new(raw);
    if !path.is_absolute() {
        return Err(invalid("The path is not absolute."));
    }
    if path.components().any(|component| matches!(component, Component::ParentDir)) {
        return Err(invalid("The path contains a parent folder reference."));
    }
    Ok(path.to_path_buf())
}
