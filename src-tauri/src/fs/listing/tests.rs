#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use super::*;
use crate::error::ErrorCode;
use std::fs;

fn names(listing: &DirListing) -> Vec<&str> {
    listing.entries.iter().map(|entry| entry.name.as_str()).collect()
}

fn fixture() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    fs::create_dir(dir.path().join("b-folder")).unwrap();
    fs::create_dir(dir.path().join("A-folder")).unwrap();
    fs::write(dir.path().join("file10.txt"), b"0123456789").unwrap();
    fs::write(dir.path().join("file2.txt"), b"01").unwrap();
    fs::write(dir.path().join("File1.txt"), b"0").unwrap();
    fs::write(dir.path().join("Photo.JPG"), b"jpg").unwrap();
    dir
}

#[test]
fn folders_first_then_natural_name_order() {
    let dir = fixture();
    let listing = list(dir.path(), true, Sort::default()).unwrap();
    assert_eq!(names(&listing), ["A-folder", "b-folder", "File1.txt", "file2.txt", "file10.txt", "Photo.JPG"]);
    assert_eq!(listing.total, 6);
    assert!(!listing.truncated);
    assert_eq!(listing.skipped, 0);
}

#[test]
fn entries_carry_kind_size_and_a_lowercase_extension() {
    let dir = fixture();
    let listing = list(dir.path(), true, Sort::default()).unwrap();
    let folder = &listing.entries[0];
    assert_eq!((folder.kind, folder.size, folder.ext.as_str(), folder.is_link), (EntryKind::Dir, 0, "", false));
    let photo = listing.entries.iter().find(|entry| entry.name == "Photo.JPG").unwrap();
    assert_eq!((photo.kind, photo.size, photo.ext.as_str()), (EntryKind::File, 3, "jpg"));
    assert!(photo.modified > 0);
    assert_eq!(photo.path, dir.path().join("Photo.JPG").display().to_string());
}

#[test]
fn descending_size_keeps_folders_first() {
    let dir = fixture();
    let sort = Sort { key: SortKey::Size, dir: SortDir::Desc };
    let listing = list(dir.path(), true, sort).unwrap();
    assert_eq!(names(&listing), ["b-folder", "A-folder", "file10.txt", "Photo.JPG", "file2.txt", "File1.txt"]);
}

#[test]
fn a_file_or_a_missing_path_is_a_clear_error() {
    let dir = fixture();
    let file = dir.path().join("file2.txt");
    let error = list(&file, true, Sort::default()).unwrap_err();
    assert_eq!(error.code, ErrorCode::Validation);
    assert_eq!(error.path.as_deref(), Some(file.display().to_string().as_str()));
    let missing = dir.path().join("nope");
    assert_eq!(list(&missing, true, Sort::default()).unwrap_err().code, ErrorCode::NotFound);
}

#[test]
fn the_cap_truncates_but_reports_the_total() {
    let dir = fixture();
    let listing = list(dir.path(), true, Sort::default()).unwrap();
    let capped = assemble(listing.path.clone(), listing.entries.clone(), 2, Sort::default(), 4);
    assert_eq!(capped.entries.len(), 4);
    assert_eq!(capped.total, 6);
    assert!(capped.truncated);
    assert_eq!(capped.skipped, 2);
}

#[test]
fn stat_describes_one_entry() {
    let dir = fixture();
    let entry = stat_entry(&dir.path().join("file10.txt")).unwrap();
    assert_eq!((entry.name.as_str(), entry.size, entry.kind), ("file10.txt", 10, EntryKind::File));
}

#[cfg(windows)]
#[test]
fn hidden_and_system_files_are_filtered_unless_asked() {
    let dir = fixture();
    let secret = dir.path().join("secret.txt");
    fs::write(&secret, b"x").unwrap();
    let status = std::process::Command::new("attrib").arg("+h").arg(&secret).status().unwrap();
    assert!(status.success());
    let visible = list(dir.path(), false, Sort::default()).unwrap();
    assert!(!names(&visible).contains(&"secret.txt"));
    let all = list(dir.path(), true, Sort::default()).unwrap();
    let entry = all.entries.iter().find(|entry| entry.name == "secret.txt").unwrap();
    assert!(entry.hidden);
}

/// Spec 3, done criterion 3. Run with: cargo test --release -- --ignored ten_thousand
#[test]
#[ignore = "performance check; run in release mode"]
fn ten_thousand_entries_list_in_under_150_ms() {
    let dir = tempfile::tempdir().unwrap();
    for index in 0..10_000 {
        fs::write(dir.path().join(format!("file-{index:05}.txt")), b"").unwrap();
    }
    let started = std::time::Instant::now();
    let listing = list(dir.path(), false, Sort::default()).unwrap();
    let elapsed = started.elapsed();
    assert_eq!(listing.total, 10_000);
    assert!(elapsed.as_millis() < 150, "listing took {elapsed:?}");
}
