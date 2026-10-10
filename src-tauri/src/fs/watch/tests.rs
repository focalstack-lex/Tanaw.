#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use super::*;
use std::sync::mpsc;
use std::time::Duration;

#[test]
fn reports_a_change_in_the_watched_folder() {
    let dir = tempfile::tempdir().unwrap();
    let watchers = Watchers::default();
    let (sender, receiver) = mpsc::channel();
    watchers
        .watch("tab-1".into(), dir.path().to_path_buf(), move |path| {
            // The receiver outlives the test assertions; a send error only means it is gone.
            let _ = sender.send(path);
        })
        .unwrap();
    std::fs::write(dir.path().join("new.txt"), b"x").unwrap();
    let changed = receiver.recv_timeout(Duration::from_secs(5)).expect("no change event within 5 s");
    assert_eq!(changed, dir.path().display().to_string());
}

#[test]
fn one_watcher_per_tab_and_unwatch_releases_it() {
    let (first, second) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
    let watchers = Watchers::default();
    watchers.watch("tab-1".into(), first.path().to_path_buf(), |_| {}).unwrap();
    watchers.watch("tab-1".into(), second.path().to_path_buf(), |_| {}).unwrap();
    watchers.watch("tab-2".into(), first.path().to_path_buf(), |_| {}).unwrap();
    assert_eq!(watchers.count().unwrap(), 2);
    assert!(watchers.unwatch("tab-1").unwrap());
    assert!(!watchers.unwatch("tab-1").unwrap());
    assert_eq!(watchers.count().unwrap(), 1);
}

#[test]
fn a_missing_folder_cannot_be_watched() {
    let dir = tempfile::tempdir().unwrap();
    let missing = dir.path().join("gone");
    assert!(Watchers::default().watch("tab".into(), missing, |_| {}).is_err());
}
