#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use super::*;

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
