//! The Windows shell: drives, known folders, the default app, Open with and
//! Show in Explorer. Every command validates its path and refuses a missing
//! item before Windows is asked.

use std::path::Path;

use serde::Serialize;
use sysinfo::Disks;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::error::{ErrorCode, FilewellError};
use crate::fs::run_blocking;
use crate::paths::validate_path;

#[cfg(test)]
mod tests;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DriveKind {
    Fixed,
    Removable,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Drive {
    pub mount_point: String,
    pub label: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub kind: DriveKind,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownFolder {
    pub id: String,
    pub label: String,
    pub path: String,
}

pub fn drives() -> Vec<Drive> {
    let disks = Disks::new_with_refreshed_list();
    let mut list: Vec<Drive> = disks
        .list()
        .iter()
        .map(|disk| {
            let name = disk.name().to_string_lossy().trim().to_string();
            Drive {
                mount_point: disk.mount_point().display().to_string(),
                label: if name.is_empty() { "Local Disk".to_string() } else { name },
                total_bytes: disk.total_space(),
                available_bytes: disk.available_space().min(disk.total_space()),
                kind: if disk.is_removable() { DriveKind::Removable } else { DriveKind::Fixed },
            }
        })
        .collect();
    list.sort_by(|a, b| a.mount_point.cmp(&b.mount_point));
    list.dedup_by(|a, b| a.mount_point == b.mount_point);
    list
}

pub fn known() -> Vec<KnownFolder> {
    [
        ("desktop", "Desktop", dirs::desktop_dir()),
        ("documents", "Documents", dirs::document_dir()),
        ("downloads", "Downloads", dirs::download_dir()),
        ("pictures", "Pictures", dirs::picture_dir()),
        ("music", "Music", dirs::audio_dir()),
        ("videos", "Videos", dirs::video_dir()),
        ("home", "Home folder", dirs::home_dir()),
    ]
    .into_iter()
    .filter_map(|(id, label, path)| {
        path.filter(|path| path.is_dir()).map(|path| KnownFolder {
            id: id.to_string(),
            label: label.to_string(),
            path: path.display().to_string(),
        })
    })
    .collect()
}

pub fn must_exist(path: &Path) -> Result<(), FilewellError> {
    if path.exists() {
        Ok(())
    } else {
        Err(FilewellError::new(ErrorCode::NotFound, "That item no longer exists.").with_path(path.display().to_string()))
    }
}

#[tauri::command]
pub async fn list_drives() -> Result<Vec<Drive>, FilewellError> {
    run_blocking(|| Ok(drives())).await
}

#[tauri::command]
pub fn known_folders() -> Vec<KnownFolder> {
    known()
}

#[tauri::command]
pub async fn open_path(app: AppHandle, path: String) -> Result<(), FilewellError> {
    let path = validate_path(&path)?;
    run_blocking(move || {
        must_exist(&path)?;
        let display = path.display().to_string();
        app.opener()
            .open_path(display.as_str(), None::<&str>)
            .map_err(|error| FilewellError::new(ErrorCode::Io, format!("Windows could not open it: {error}")).with_path(display))
    })
    .await
}

#[tauri::command]
pub async fn reveal_in_explorer(path: String) -> Result<(), FilewellError> {
    let path = validate_path(&path)?;
    run_blocking(move || {
        must_exist(&path)?;
        tauri_plugin_opener::reveal_item_in_dir(&path).map_err(|error| {
            FilewellError::new(ErrorCode::Io, format!("Explorer could not show it: {error}")).with_path(path.display().to_string())
        })
    })
    .await
}

#[tauri::command]
pub async fn open_with(path: String) -> Result<(), FilewellError> {
    let path = validate_path(&path)?;
    run_blocking(move || {
        must_exist(&path)?;
        show_open_with(&path)
    })
    .await
}

/// The Windows "How do you want to open this file?" dialog. Cancelling it is not an error.
#[cfg(windows)]
#[allow(unsafe_code)]
fn show_open_with(path: &Path) -> Result<(), FilewellError> {
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::{SHOpenWithDialog, OAIF_ALLOW_REGISTRATION, OAIF_EXEC, OPENASINFO};

    /// HRESULT_FROM_WIN32(ERROR_CANCELLED): the user closed the dialog.
    const CANCELLED: u32 = 0x8007_04C7;

    let file = HSTRING::from(path.as_os_str());
    let info = OPENASINFO {
        pcszFile: PCWSTR(file.as_ptr()),
        pcszClass: PCWSTR::null(),
        oaifInFlags: OAIF_ALLOW_REGISTRATION | OAIF_EXEC,
    };
    // SAFETY: COM is initialized on this blocking-pool thread and released before
    // returning; `file` outlives the call, and the dialog only reads `info`.
    let result = unsafe {
        let com = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let shown = SHOpenWithDialog(None, &info);
        if com.is_ok() {
            CoUninitialize();
        }
        shown
    };
    match result {
        Ok(()) => Ok(()),
        Err(error) if error.code().0 as u32 == CANCELLED => Ok(()),
        Err(error) => Err(FilewellError::new(ErrorCode::Io, format!("Windows could not show Open with: {error}"))
            .with_path(path.display().to_string())),
    }
}

#[cfg(not(windows))]
fn show_open_with(path: &Path) -> Result<(), FilewellError> {
    Err(FilewellError::new(ErrorCode::Unsupported, "Open with is only available on Windows.").with_path(path.display().to_string()))
}
