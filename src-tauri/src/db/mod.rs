//! Database lifecycle: open with the pragmas from the spec (5.9), quarantine a
//! damaged file, and apply numbered migrations tracked by `user_version`.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::Connection;

use crate::error::TanawError;

#[cfg(test)]
mod tests;

pub const DB_FILE: &str = "tanaw.db";

/// Forward-only migrations. Index 0 brings `user_version` to 1, and so on.
const MIGRATIONS: &[&str] = &[include_str!("migrations/0001_init.sql")];

pub struct Opened {
    pub connection: Connection,
    /// True when an existing file failed its integrity check and was moved aside.
    pub recovered: bool,
}

pub fn open(data_dir: &Path) -> Result<Opened, TanawError> {
    std::fs::create_dir_all(data_dir)?;
    let path = data_dir.join(DB_FILE);
    let recovered = quarantine_if_damaged(&path)?;
    let connection = Connection::open(&path)?;
    configure(&connection)?;
    migrate(&connection)?;
    Ok(Opened { connection, recovered })
}

pub fn schema_version(connection: &Connection) -> Result<u32, TanawError> {
    Ok(connection.query_row("PRAGMA user_version", [], |row| row.get::<_, u32>(0))?)
}

/// Applies every migration above the current `user_version`, each in its own
/// transaction, and returns how many ran.
pub fn migrate(connection: &Connection) -> Result<usize, TanawError> {
    let current = schema_version(connection)? as usize;
    let mut applied = 0;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(current) {
        let next = u32::try_from(index + 1)
            .map_err(|_| TanawError::db("too many migrations for a 32-bit user_version"))?;
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(sql)?;
        transaction.pragma_update(None, "user_version", next)?;
        transaction.commit()?;
        applied += 1;
    }
    Ok(applied)
}

fn configure(connection: &Connection) -> Result<(), TanawError> {
    // journal_mode answers with the resulting mode as a row, so it is queried.
    connection.query_row("PRAGMA journal_mode = WAL", [], |_| Ok(()))?;
    connection.execute_batch(
        "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;",
    )?;
    Ok(())
}

/// Returns true when an existing file failed `integrity_check` and was moved
/// aside, with its WAL and SHM siblings, so a fresh database can be created.
fn quarantine_if_damaged(path: &Path) -> Result<bool, TanawError> {
    if !path.exists() || is_healthy(path) {
        return Ok(false);
    }
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis())
        .unwrap_or(0);
    for suffix in ["", "-wal", "-shm"] {
        let source = with_suffix(path, suffix);
        if source.exists() {
            let target = with_suffix(path, &format!(".corrupt-{stamp}{suffix}"));
            std::fs::rename(&source, &target)?;
            log::warn!("quarantined damaged database file {}", target.display());
        }
    }
    Ok(true)
}

fn is_healthy(path: &Path) -> bool {
    let Ok(connection) = Connection::open(path) else {
        return false;
    };
    let verdict: Result<String, rusqlite::Error> =
        connection.query_row("PRAGMA integrity_check", [], |row| row.get(0));
    matches!(verdict.as_deref(), Ok("ok"))
}

fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{suffix}", path.display()))
}
