//! Filesystem reading and watching. Everything here runs off the main thread.

pub mod listing;
pub mod sort;
pub mod watch;

use crate::error::{ErrorCode, FilewellError};

/// Runs disk work on Tauri's blocking pool so the main thread never waits on IO.
pub async fn run_blocking<T, F>(work: F) -> Result<T, FilewellError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, FilewellError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|error| FilewellError::new(ErrorCode::Io, format!("The background task stopped: {error}")))?
}
