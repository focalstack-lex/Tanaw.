//! Filewell native core. Every side effect (database, filesystem, shell) lives
//! here behind `#[tauri::command]` functions that validate their input; the
//! renderer only displays what these commands return.

mod app;
mod data;
mod db;
mod error;
mod fs;
mod paths;
mod shell;
mod startup;
mod state;

pub use error::{ErrorCode, FilewellError};

use tauri::Manager;

/// Builds and runs the application. When it cannot start (the shell fails to
/// build, or the data folder or database cannot be opened), it logs the cause,
/// tells the user (`startup::fail`) and exits with status 1 instead of panicking,
/// because release builds abort on panic.
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
                    tauri_plugin_log::TargetKind::LogDir { file_name: Some("filewell".into()) },
                )])
                .level(log_level)
                .max_file_size(5 * 1024 * 1024)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(3))
                .build(),
        )
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // An Err returned from setup becomes a panic inside Tauri, and release
            // builds abort on panic with no console: the window would flash and
            // vanish with nothing logged. Startup failures are reported instead.
            let data_dir = match app.path().app_local_data_dir() {
                Ok(dir) => dir,
                Err(error) => startup::fail(&startup::failure_message(
                    None,
                    &FilewellError::new(ErrorCode::Io, error.to_string()),
                )),
            };
            let opened = match db::open(&data_dir) {
                Ok(opened) => opened,
                Err(error) => startup::fail(&startup::failure_message(Some(&data_dir), &error)),
            };
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
            fs::listing::list_dir,
            fs::listing::stat,
            fs::watch::watch_dir,
            fs::watch::unwatch,
            shell::list_drives,
            shell::known_folders,
            shell::open_path,
            shell::open_with,
            shell::reveal_in_explorer,
        ]);

    if let Err(error) = builder.run(tauri::generate_context!()) {
        log::error!("Filewell could not start: {error}");
        std::process::exit(1);
    }
}
