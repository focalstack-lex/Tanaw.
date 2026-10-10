//! Settings: a key/value table behind a typed struct. Keys and bounds are the
//! spec's (5.9). Unknown keys are refused on write and skipped with a warning
//! on read, so a newer backup never breaks an older build.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::error::FilewellError;
use crate::state::AppState;

#[cfg(test)]
mod tests;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ViewMode {
    List,
    Grid,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PanelTab {
    Preview,
    Notes,
    Todos,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme: Theme,
    pub show_hidden: bool,
    pub default_view: ViewMode,
    pub check_updates: bool,
    pub panel_width: u32,
    pub panel_tab: PanelTab,
    pub sidebar_width: u32,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: Theme::System,
            show_hidden: false,
            default_view: ViewMode::List,
            check_updates: true,
            panel_width: 320,
            panel_tab: PanelTab::Preview,
            sidebar_width: 220,
        }
    }
}

/// Inclusive pixel bounds for the two persisted widths.
pub const PANEL_WIDTH: (u32, u32) = (200, 800);
pub const SIDEBAR_WIDTH: (u32, u32) = (160, 480);

pub fn load(connection: &Connection) -> Result<Settings, FilewellError> {
    let mut settings = Settings::default();
    let mut statement = connection.prepare("SELECT key, value FROM settings")?;
    let rows = statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
    for row in rows {
        let (key, raw) = row?;
        let value: Value = match serde_json::from_str(&raw) {
            Ok(value) => value,
            Err(error) => {
                log::warn!("setting {key} holds unreadable JSON ({error}); using the default");
                continue;
            }
        };
        if let Err(error) = apply(&mut settings, &key, &value) {
            log::warn!("setting {key} ignored: {}", error.message);
        }
    }
    Ok(settings)
}

/// Validates one key against the current settings, then persists it as JSON.
pub fn store(connection: &Connection, key: &str, value: &Value) -> Result<Settings, FilewellError> {
    let mut settings = load(connection)?;
    apply(&mut settings, key, value)?;
    connection.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value.to_string()],
    )?;
    Ok(settings)
}

fn apply(settings: &mut Settings, key: &str, value: &Value) -> Result<(), FilewellError> {
    match key {
        "theme" => settings.theme = parse(key, value)?,
        "showHidden" => settings.show_hidden = parse(key, value)?,
        "defaultView" => settings.default_view = parse(key, value)?,
        "checkUpdates" => settings.check_updates = parse(key, value)?,
        "panelWidth" => settings.panel_width = bounded(key, value, PANEL_WIDTH)?,
        "panelTab" => settings.panel_tab = parse(key, value)?,
        "sidebarWidth" => settings.sidebar_width = bounded(key, value, SIDEBAR_WIDTH)?,
        _ => return Err(FilewellError::validation(format!("{key} is not a setting"))),
    }
    Ok(())
}

fn parse<T: serde::de::DeserializeOwned>(key: &str, value: &Value) -> Result<T, FilewellError> {
    serde_json::from_value(value.clone())
        .map_err(|error| FilewellError::validation(format!("{key} does not accept {value}: {error}")))
}

fn bounded(key: &str, value: &Value, (min, max): (u32, u32)) -> Result<u32, FilewellError> {
    let number: u32 = parse(key, value)?;
    if number < min || number > max {
        return Err(FilewellError::validation(format!(
            "{key} must be between {min} and {max}, not {number}"
        )));
    }
    Ok(number)
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings, FilewellError> {
    let db = state.db()?;
    load(&db)
}

#[tauri::command]
pub fn set_setting(state: State<'_, AppState>, key: String, value: Value) -> Result<Settings, FilewellError> {
    let db = state.db()?;
    store(&db, &key, &value)
}
