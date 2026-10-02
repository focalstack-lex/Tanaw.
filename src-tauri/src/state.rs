//! Process-wide state managed by Tauri.

use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

use crate::error::TanawError;

/// The database connection sits behind a mutex because commands run on a
/// thread pool; SQLite in WAL mode makes the critical sections short.
pub struct AppState {
    db: Mutex<Connection>,
    pub data_dir: PathBuf,
    pub database_recovered: bool,
}

impl AppState {
    pub fn new(connection: Connection, data_dir: PathBuf, database_recovered: bool) -> Self {
        Self { db: Mutex::new(connection), data_dir, database_recovered }
    }

    /// Locks the connection. A poisoned mutex means an earlier command panicked
    /// while holding it; that is reported as a database error, never unwrapped.
    pub fn db(&self) -> Result<MutexGuard<'_, Connection>, TanawError> {
        self.db
            .lock()
            .map_err(|_| TanawError::db("the database lock was poisoned by an earlier failure"))
    }
}
