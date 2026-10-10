#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use super::*;
use crate::error::ErrorCode;

#[test]
fn accepts_an_absolute_path() {
    let dir = std::env::temp_dir();
    let raw = dir.display().to_string();
    assert_eq!(validate_path(&raw).unwrap(), dir);
}

#[test]
fn refuses_empty_relative_nul_and_parent_references() {
    for raw in ["", "   ", "relative/folder", "a\0b"] {
        assert_eq!(validate_path(raw).unwrap_err().code, ErrorCode::InvalidPath, "{raw:?}");
    }
    let sneaky = format!("{}{}..{}x", std::env::temp_dir().display(), std::path::MAIN_SEPARATOR, std::path::MAIN_SEPARATOR);
    let error = validate_path(&sneaky).unwrap_err();
    assert_eq!(error.code, ErrorCode::InvalidPath);
    assert_eq!(error.path.as_deref(), Some(sneaky.as_str()));
}

#[test]
fn refuses_a_path_longer_than_windows_allows() {
    let long = format!("{}{}", std::env::temp_dir().display(), "a".repeat(MAX_PATH_CHARS));
    assert_eq!(validate_path(&long).unwrap_err().code, ErrorCode::InvalidPath);
}

#[cfg(windows)]
#[test]
fn windows_drive_forms() {
    assert!(validate_path("C:\\").is_ok());
    assert!(validate_path("C:\\Users").is_ok());
    assert_eq!(validate_path("C:Users").unwrap_err().code, ErrorCode::InvalidPath);
    assert_eq!(validate_path("\\Users").unwrap_err().code, ErrorCode::InvalidPath);
}
