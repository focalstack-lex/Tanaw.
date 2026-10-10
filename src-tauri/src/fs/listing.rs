//! Folder listings (spec 5.3): one read, hidden filter, natural sort in Rust,
//! capped at 50,000 entries.

use std::fs::Metadata;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use super::run_blocking;
use super::sort::natural_cmp;
use crate::error::{ErrorCode, FilewellError};
use crate::paths::validate_path;

#[cfg(test)]
mod tests;

pub const LISTING_CAP: usize = 50_000;

/// What the entry is, following links: a link to a folder opens like a folder.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Dir,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
    pub size: u64,
    pub modified: u64,
    pub created: u64,
    pub hidden: bool,
    pub readonly: bool,
    pub is_link: bool,
    pub ext: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirListing {
    pub path: String,
    pub entries: Vec<Entry>,
    pub total: usize,
    pub truncated: bool,
    /// Entries whose details could not be read (for example, no permission).
    pub skipped: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortKey {
    Name,
    Size,
    Modified,
    Kind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortDir {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
pub struct Sort {
    pub key: SortKey,
    pub dir: SortDir,
}

impl Default for Sort {
    fn default() -> Self {
        Self { key: SortKey::Name, dir: SortDir::Asc }
    }
}

pub fn list(path: &Path, show_hidden: bool, sort: Sort) -> Result<DirListing, FilewellError> {
    list_capped(path, show_hidden, sort, LISTING_CAP)
}

pub(crate) fn list_capped(path: &Path, show_hidden: bool, sort: Sort, cap: usize) -> Result<DirListing, FilewellError> {
    let display = path.display().to_string();
    let meta = std::fs::metadata(path).map_err(|error| FilewellError::from(error).with_path(display.as_str()))?;
    if !meta.is_dir() {
        return Err(FilewellError::new(ErrorCode::Validation, "That is a file, not a folder.").with_path(display));
    }
    let at_root = path.parent().is_none();
    let reader = std::fs::read_dir(path).map_err(|error| FilewellError::from(error).with_path(display.as_str()))?;
    let mut entries = Vec::new();
    let mut skipped = 0;
    for item in reader {
        let item = match item {
            Ok(item) => item,
            Err(error) => {
                skipped += 1;
                log::debug!("skipped an unreadable entry in {display}: {error}");
                continue;
            }
        };
        // On Windows DirEntry::metadata comes from the directory scan itself,
        // so this costs no extra system call per file.
        let built = item
            .metadata()
            .map(|link_meta| build_entry(item.file_name().to_string_lossy().into_owned(), &item.path(), link_meta, at_root));
        match built {
            Ok(entry) if show_hidden || !entry.hidden => entries.push(entry),
            Ok(_) => {}
            Err(error) => {
                skipped += 1;
                log::debug!("skipped {}: {error}", item.path().display());
            }
        }
    }
    Ok(assemble(display, entries, skipped, sort, cap))
}

pub fn stat_entry(path: &Path) -> Result<Entry, FilewellError> {
    let display = path.display().to_string();
    let link_meta = std::fs::symlink_metadata(path).map_err(|error| FilewellError::from(error).with_path(display.as_str()))?;
    let name = path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_else(|| display.clone());
    Ok(build_entry(name, path, link_meta, false))
}

pub fn sort_entries(entries: &mut [Entry], sort: Sort) {
    entries.sort_by(|a, b| {
        let folders_first = (b.kind == EntryKind::Dir).cmp(&(a.kind == EntryKind::Dir));
        folders_first.then_with(|| {
            let by_name = || natural_cmp(&a.name, &b.name);
            let order = match sort.key {
                SortKey::Name => by_name(),
                SortKey::Size => a.size.cmp(&b.size).then_with(by_name),
                SortKey::Modified => a.modified.cmp(&b.modified).then_with(by_name),
                SortKey::Kind => a.ext.cmp(&b.ext).then_with(by_name),
            };
            if sort.dir == SortDir::Desc { order.reverse() } else { order }
        })
    });
}

pub(crate) fn assemble(path: String, mut entries: Vec<Entry>, skipped: usize, sort: Sort, cap: usize) -> DirListing {
    sort_entries(&mut entries, sort);
    let total = entries.len();
    entries.truncate(cap);
    DirListing { path, entries, total, truncated: total > cap, skipped }
}

fn build_entry(name: String, path: &Path, link_meta: Metadata, at_root: bool) -> Entry {
    let is_link = link_meta.file_type().is_symlink();
    // A broken link keeps its own metadata and shows as a file.
    let meta = if is_link { std::fs::metadata(path).unwrap_or_else(|_| link_meta.clone()) } else { link_meta.clone() };
    let kind = if meta.is_dir() { EntryKind::Dir } else { EntryKind::File };
    let ext = match kind {
        EntryKind::Dir => String::new(),
        EntryKind::File => path.extension().map(|ext| ext.to_string_lossy().to_lowercase()).unwrap_or_default(),
    };
    Entry {
        hidden: is_hidden(&name, &link_meta, at_root),
        name,
        path: path.display().to_string(),
        kind,
        size: if kind == EntryKind::Dir { 0 } else { meta.len() },
        modified: millis(meta.modified()),
        created: millis(meta.created()),
        readonly: meta.permissions().readonly(),
        is_link,
        ext,
    }
}

/// Hidden or system attribute, plus `$` names at a drive root (spec 5.3).
fn is_hidden(name: &str, link_meta: &Metadata, at_root: bool) -> bool {
    has_hidden_attribute(link_meta) || (at_root && name.starts_with('$')) || (cfg!(not(windows)) && name.starts_with('.'))
}

#[cfg(windows)]
fn has_hidden_attribute(meta: &Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
    const FILE_ATTRIBUTE_SYSTEM: u32 = 0x4;
    meta.file_attributes() & (FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM) != 0
}

#[cfg(not(windows))]
fn has_hidden_attribute(_meta: &Metadata) -> bool {
    false
}

fn millis(time: std::io::Result<SystemTime>) -> u64 {
    time.ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}

#[tauri::command]
pub async fn list_dir(path: String, show_hidden: bool, sort: Option<Sort>) -> Result<DirListing, FilewellError> {
    let path = validate_path(&path)?;
    run_blocking(move || list(&path, show_hidden, sort.unwrap_or_default())).await
}

#[tauri::command]
pub async fn stat(path: String) -> Result<Entry, FilewellError> {
    let path = validate_path(&path)?;
    run_blocking(move || stat_entry(&path)).await
}
