#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use super::*;
use crate::error::ErrorCode;
use serde_json::json;

fn connection() -> Connection {
    let connection = Connection::open_in_memory().unwrap();
    crate::db::migrate(&connection).unwrap();
    connection
}

#[test]
fn defaults_when_the_table_is_empty() {
    assert_eq!(load(&connection()).unwrap(), Settings::default());
}

#[test]
fn stores_and_reloads_each_key() {
    let connection = connection();
    store(&connection, "theme", &json!("dark")).unwrap();
    store(&connection, "showHidden", &json!(true)).unwrap();
    store(&connection, "defaultView", &json!("grid")).unwrap();
    store(&connection, "checkUpdates", &json!(false)).unwrap();
    store(&connection, "panelWidth", &json!(400)).unwrap();
    store(&connection, "panelTab", &json!("notes")).unwrap();
    let settings = store(&connection, "sidebarWidth", &json!(260)).unwrap();
    let expected = Settings {
        theme: Theme::Dark,
        show_hidden: true,
        default_view: ViewMode::Grid,
        check_updates: false,
        panel_width: 400,
        panel_tab: PanelTab::Notes,
        sidebar_width: 260,
    };
    assert_eq!(settings, expected);
    assert_eq!(load(&connection).unwrap(), expected);
}

#[test]
fn overwriting_a_key_keeps_one_row() {
    let connection = connection();
    store(&connection, "theme", &json!("dark")).unwrap();
    store(&connection, "theme", &json!("light")).unwrap();
    let rows: i64 = connection.query_row("SELECT count(*) FROM settings", [], |row| row.get(0)).unwrap();
    assert_eq!(rows, 1);
    assert_eq!(load(&connection).unwrap().theme, Theme::Light);
}

#[test]
fn rejects_unknown_keys_and_bad_values_without_writing() {
    let connection = connection();
    assert_eq!(store(&connection, "colour", &json!("red")).unwrap_err().code, ErrorCode::Validation);
    assert_eq!(store(&connection, "theme", &json!("sepia")).unwrap_err().code, ErrorCode::Validation);
    assert_eq!(store(&connection, "showHidden", &json!("yes")).unwrap_err().code, ErrorCode::Validation);
    assert_eq!(store(&connection, "panelWidth", &json!(5000)).unwrap_err().code, ErrorCode::Validation);
    assert_eq!(store(&connection, "sidebarWidth", &json!(10)).unwrap_err().code, ErrorCode::Validation);
    let rows: i64 = connection.query_row("SELECT count(*) FROM settings", [], |row| row.get(0)).unwrap();
    assert_eq!(rows, 0);
}

#[test]
fn rows_from_a_newer_build_or_damaged_rows_are_skipped() {
    let connection = connection();
    connection.execute("INSERT INTO settings (key, value) VALUES ('futureKey', '1')", []).unwrap();
    connection.execute("INSERT INTO settings (key, value) VALUES ('theme', 'not json')", []).unwrap();
    assert_eq!(load(&connection).unwrap(), Settings::default());
}
