#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use super::*;
use crate::error::ErrorCode;

#[test]
fn drives_have_a_mount_point_and_a_size() {
    let list = drives();
    assert!(!list.is_empty());
    for drive in &list {
        assert!(!drive.mount_point.is_empty());
        assert!(!drive.label.is_empty());
        assert!(drive.available_bytes <= drive.total_bytes, "{drive:?}");
    }
    #[cfg(windows)]
    assert!(list.iter().any(|drive| drive.mount_point.eq_ignore_ascii_case("C:\\")), "{list:?}");
}

#[test]
fn known_folders_exist_and_include_home() {
    let folders = known();
    assert!(folders.iter().any(|folder| folder.id == "home"));
    for folder in &folders {
        assert!(std::path::Path::new(&folder.path).is_dir(), "{folder:?}");
    }
}

#[test]
fn a_missing_item_is_reported_before_the_shell_is_asked() {
    let dir = tempfile::tempdir().unwrap();
    let missing = dir.path().join("gone.txt");
    assert_eq!(must_exist(&missing).unwrap_err().code, ErrorCode::NotFound);
    assert!(must_exist(dir.path()).is_ok());
}
