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
