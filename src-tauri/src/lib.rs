//! Tanaw native core. Every side effect (database, filesystem, shell) lives
//! here behind `#[tauri::command]` functions that validate their input; the
//! renderer only displays what these commands return.

mod app;
mod data;
mod db;
mod error;
mod state;

pub use error::{ErrorCode, TanawError};

use tauri::Manager;

/// Builds and runs the application. Exits with status 1 instead of panicking
/// when the shell cannot start, because release builds abort on panic.
pub fn run() {
    let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };

    let builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir { file_name: Some("tanaw".into()) },
                )])
                .level(log_level)
                .max_file_size(5 * 1024 * 1024)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(3))
                .build(),
        )
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let data_dir = app.path().app_local_data_dir()?;
            let opened = db::open(&data_dir)?;
            if opened.recovered {
                log::warn!("the database was damaged; a fresh one was created in {}", data_dir.display());
            }
            app.manage(state::AppState::new(opened.connection, data_dir, opened.recovered));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app::get_app_info,
            data::settings::get_settings,
            data::settings::set_setting,
        ]);

    if let Err(error) = builder.run(tauri::generate_context!()) {
        log::error!("Tanaw could not start: {error}");
        std::process::exit(1);
    }
}
