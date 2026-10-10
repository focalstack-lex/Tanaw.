//! Live refresh (spec 5.8): one non-recursive watcher per tab, debounced at
//! 300 ms, emitting `dir-changed { path }`. Re-watching a tab replaces its
//! watcher; dropping a debouncer stops it.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::{ErrorCode, FilewellError};
use crate::paths::validate_path;
use crate::state::AppState;

#[cfg(test)]
mod tests;

const DEBOUNCE: Duration = Duration::from_millis(300);

#[derive(Default)]
pub struct Watchers {
    inner: Mutex<HashMap<String, Debouncer<RecommendedWatcher>>>,
}

impl Watchers {
    pub fn watch<F>(&self, tab_id: String, path: PathBuf, on_change: F) -> Result<(), FilewellError>
    where
        F: Fn(String) + Send + 'static,
    {
        let display = path.display().to_string();
        let reported = display.clone();
        let mut debouncer = new_debouncer(DEBOUNCE, move |result: DebounceEventResult| match result {
            Ok(events) if !events.is_empty() => on_change(reported.clone()),
            Ok(_) => {}
            Err(error) => log::warn!("watching {reported} failed: {error}"),
        })
        .map_err(|error| watch_error(&display, error))?;
        debouncer
            .watcher()
            .watch(&path, RecursiveMode::NonRecursive)
            .map_err(|error| watch_error(&display, error))?;
        self.lock()?.insert(tab_id, debouncer);
        Ok(())
    }

    /// True when the tab had a watcher.
    pub fn unwatch(&self, tab_id: &str) -> Result<bool, FilewellError> {
        Ok(self.lock()?.remove(tab_id).is_some())
    }

    #[cfg(test)]
    pub fn count(&self) -> Result<usize, FilewellError> {
        Ok(self.lock()?.len())
    }

    fn lock(&self) -> Result<MutexGuard<'_, HashMap<String, Debouncer<RecommendedWatcher>>>, FilewellError> {
        self.inner
            .lock()
            .map_err(|_| FilewellError::new(ErrorCode::Io, "The folder watcher registry was poisoned by an earlier failure."))
    }
}

fn watch_error(path: &str, error: impl std::fmt::Display) -> FilewellError {
    FilewellError::new(ErrorCode::Io, format!("Filewell cannot watch this folder for changes: {error}")).with_path(path)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DirChanged {
    path: String,
}

#[tauri::command]
pub fn watch_dir(app: AppHandle, state: State<'_, AppState>, tab_id: String, path: String) -> Result<(), FilewellError> {
    let path = validate_path(&path)?;
    state.watchers.watch(tab_id, path, move |changed| {
        if let Err(error) = app.emit("dir-changed", DirChanged { path: changed }) {
            log::warn!("could not emit dir-changed: {error}");
        }
    })
}

#[tauri::command]
pub fn unwatch(state: State<'_, AppState>, tab_id: String) -> Result<(), FilewellError> {
    state.watchers.unwatch(&tab_id).map(|_| ())
}
