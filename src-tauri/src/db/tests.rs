#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use super::*;

fn table_count(connection: &Connection) -> i64 {
    connection
        .query_row(
            "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name IN \
             ('settings', 'favorites', 'recent_files', 'notes', 'note_versions', 'todos')",
            [],
            |row| row.get(0),
        )
        .unwrap()
}

#[test]
fn open_creates_the_schema_at_the_latest_version() {
    let dir = tempfile::tempdir().unwrap();
    let opened = open(dir.path()).unwrap();
    assert!(!opened.recovered);
    assert_eq!(schema_version(&opened.connection).unwrap(), MIGRATIONS.len() as u32);
    assert_eq!(table_count(&opened.connection), 6);
}

#[test]
fn reopening_applies_no_further_migrations() {
    let dir = tempfile::tempdir().unwrap();
    drop(open(dir.path()).unwrap());
    let opened = open(dir.path()).unwrap();
    assert_eq!(migrate(&opened.connection).unwrap(), 0);
}

#[test]
fn pragmas_are_applied() {
    let dir = tempfile::tempdir().unwrap();
    let opened = open(dir.path()).unwrap();
    let mode: String = opened.connection.query_row("PRAGMA journal_mode", [], |row| row.get(0)).unwrap();
    assert_eq!(mode, "wal");
    let foreign_keys: i64 = opened.connection.query_row("PRAGMA foreign_keys", [], |row| row.get(0)).unwrap();
    assert_eq!(foreign_keys, 1);
}

#[test]
fn a_damaged_file_is_quarantined_and_replaced() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join(DB_FILE), b"this is not a database").unwrap();
    let opened = open(dir.path()).unwrap();
    assert!(opened.recovered);
    assert_eq!(schema_version(&opened.connection).unwrap(), MIGRATIONS.len() as u32);
    let quarantined = std::fs::read_dir(dir.path())
        .unwrap()
        .filter_map(Result::ok)
        .any(|entry| entry.file_name().to_string_lossy().starts_with("tanaw.db.corrupt-"));
    assert!(quarantined);
}

fn sqlite_error(code: std::os::raw::c_int) -> rusqlite::Error {
    rusqlite::Error::SqliteFailure(rusqlite::ffi::Error::new(code), None)
}

#[test]
fn only_corruption_verdicts_count_as_damage() {
    assert_eq!(classify(&sqlite_error(rusqlite::ffi::SQLITE_CORRUPT)), Health::Damaged);
    assert_eq!(classify(&sqlite_error(rusqlite::ffi::SQLITE_NOTADB)), Health::Damaged);
    for code in [rusqlite::ffi::SQLITE_BUSY, rusqlite::ffi::SQLITE_LOCKED, rusqlite::ffi::SQLITE_IOERR, rusqlite::ffi::SQLITE_CANTOPEN] {
        assert!(
            matches!(classify(&sqlite_error(code)), Health::Unavailable(_)),
            "code {code} must not be treated as damage"
        );
    }
}

#[test]
fn a_locked_healthy_database_is_reported_not_quarantined() {
    let dir = tempfile::tempdir().unwrap();
    drop(open(dir.path()).unwrap());

    // Another process (a second Tanaw instance, a backup tool) holds the file exclusively.
    let holder = Connection::open(dir.path().join(DB_FILE)).unwrap();
    holder
        .execute_batch("PRAGMA locking_mode = EXCLUSIVE; BEGIN EXCLUSIVE; INSERT INTO settings (key, value) VALUES ('theme', '\"dark\"'); COMMIT;")
        .unwrap();

    let error = match open(dir.path()) {
        Ok(_) => panic!("open succeeded while another connection held the database exclusively"),
        Err(error) => error,
    };
    assert_eq!(error.code, crate::error::ErrorCode::Db, "{error:?}");
    assert!(dir.path().join(DB_FILE).exists());
    let quarantined = std::fs::read_dir(dir.path())
        .unwrap()
        .filter_map(Result::ok)
        .any(|entry| entry.file_name().to_string_lossy().contains(".corrupt-"));
    assert!(!quarantined, "a healthy database was moved aside");
}
