//! Database lifecycle: open with the pragmas from the spec (5.9), quarantine a
//! damaged file, and apply numbered migrations tracked by `user_version`.

use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rusqlite::Connection;

use crate::error::FilewellError;

#[cfg(test)]
mod tests;

pub const DB_FILE: &str = "filewell.db";

/// Forward-only migrations. Index 0 brings `user_version` to 1, and so on.
const MIGRATIONS: &[&str] = &[include_str!("migrations/0001_init.sql")];

pub struct Opened {
    pub connection: Connection,
    /// True when an existing file failed its integrity check and was moved aside.
    pub recovered: bool,
}

pub fn open(data_dir: &Path) -> Result<Opened, FilewellError> {
    std::fs::create_dir_all(data_dir)?;
    let path = data_dir.join(DB_FILE);
    let recovered = quarantine_if_damaged(&path)?;
    let connection = Connection::open(&path)?;
    configure(&connection)?;
    migrate(&connection)?;
    Ok(Opened { connection, recovered })
}

pub fn schema_version(connection: &Connection) -> Result<u32, FilewellError> {
    Ok(connection.query_row("PRAGMA user_version", [], |row| row.get::<_, u32>(0))?)
}

/// Applies every migration above the current `user_version`, each in its own
/// transaction, and returns how many ran.
pub fn migrate(connection: &Connection) -> Result<usize, FilewellError> {
    let current = schema_version(connection)? as usize;
    let mut applied = 0;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(current) {
        let next = u32::try_from(index + 1)
            .map_err(|_| FilewellError::db("too many migrations for a 32-bit user_version"))?;
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(sql)?;
        transaction.pragma_update(None, "user_version", next)?;
        transaction.commit()?;
        applied += 1;
    }
    Ok(applied)
}

fn configure(connection: &Connection) -> Result<(), FilewellError> {
    // journal_mode answers with the resulting mode as a row, so it is queried.
    connection.query_row("PRAGMA journal_mode = WAL", [], |_| Ok(()))?;
    connection.execute_batch(
        "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;",
    )?;
    Ok(())
}

/// How long the health probe waits for another connection's lock to clear.
const PROBE_BUSY_TIMEOUT: Duration = Duration::from_secs(5);

/// The health probe's verdict on an existing database file.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Health {
    Healthy,
    /// SQLite says the file is corrupt or is not a database.
    Damaged,
    /// The file could not be checked (locked by another process, I/O failure).
    /// It may be perfectly healthy, so it must never be moved aside.
    Unavailable(String),
}

/// Returns true when an existing file was found damaged and moved aside, with
/// its WAL and SHM siblings, so a fresh database can be created. A file that
/// cannot be checked is reported as an error instead: quarantining a healthy
/// database that was only locked would look to the user like lost data.
fn quarantine_if_damaged(path: &Path) -> Result<bool, FilewellError> {
    if !path.exists() {
        return Ok(false);
    }
    match probe(path) {
        Health::Healthy => return Ok(false),
        Health::Unavailable(reason) => {
            return Err(FilewellError::db(format!("the database could not be checked: {reason}"))
                .with_path(path.display().to_string()));
        }
        Health::Damaged => {}
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

fn probe(path: &Path) -> Health {
    let connection = match Connection::open(path) {
        Ok(connection) => connection,
        Err(error) => return classify(&error),
    };
    if let Err(error) = connection.busy_timeout(PROBE_BUSY_TIMEOUT) {
        return classify(&error);
    }
    match connection.query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0)) {
        Ok(verdict) if verdict == "ok" => Health::Healthy,
        Ok(_) => Health::Damaged,
        Err(error) => classify(&error),
    }
}

/// Only SQLite's own corruption codes count as damage; everything else means
/// the file could not be checked right now.
pub(crate) fn classify(error: &rusqlite::Error) -> Health {
    use rusqlite::ffi::ErrorCode;
    match error.sqlite_error_code() {
        Some(ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase) => Health::Damaged,
        _ => Health::Unavailable(error.to_string()),
    }
}

fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{suffix}", path.display()))
}
