//! The one error type every command returns. Serialized for the renderer as
//! `{ code, message, path? }`; the renderer maps `code` to calm copy.

use serde::Serialize;

/// Stable error categories (spec 5.12).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    NotFound,
    PermissionDenied,
    AlreadyExists,
    InvalidPath,
    InvalidName,
    Protected,
    Cancelled,
    Io,
    Db,
    Validation,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, thiserror::Error)]
#[error("{message}")]
#[serde(rename_all = "camelCase")]
pub struct FilewellError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

impl FilewellError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), path: None }
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Validation, message)
    }

    pub fn db(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Db, message)
    }

    pub fn with_path(mut self, path: impl Into<String>) -> Self {
        self.path = Some(path.into());
        self
    }
}

impl From<std::io::Error> for FilewellError {
    fn from(error: std::io::Error) -> Self {
        use std::io::ErrorKind;
        let code = match error.kind() {
            ErrorKind::NotFound => ErrorCode::NotFound,
            ErrorKind::PermissionDenied => ErrorCode::PermissionDenied,
            ErrorKind::AlreadyExists => ErrorCode::AlreadyExists,
            _ => ErrorCode::Io,
        };
        Self::new(code, error.to_string())
    }
}

impl From<rusqlite::Error> for FilewellError {
    fn from(error: rusqlite::Error) -> Self {
        Self::db(error.to_string())
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::*;

    #[test]
    fn io_errors_map_to_their_category() {
        let error: FilewellError = std::io::Error::new(std::io::ErrorKind::NotFound, "gone").into();
        assert_eq!(error.code, ErrorCode::NotFound);
        let error: FilewellError = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "no").into();
        assert_eq!(error.code, ErrorCode::PermissionDenied);
        let error: FilewellError = std::io::Error::other("other").into();
        assert_eq!(error.code, ErrorCode::Io);
    }

    #[test]
    fn serializes_in_camel_case_without_an_empty_path() {
        let json = serde_json::to_value(FilewellError::validation("bad")).unwrap();
        assert_eq!(json, serde_json::json!({ "code": "validation", "message": "bad" }));
        let json = serde_json::to_value(FilewellError::validation("bad").with_path("C:/x")).unwrap();
        assert_eq!(json["path"], "C:/x");
    }
}
