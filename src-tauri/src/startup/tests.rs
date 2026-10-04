#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use super::*;
use crate::error::{ErrorCode, TanawError};
use std::path::Path;

#[test]
fn names_the_data_folder_the_cause_and_what_to_do() {
    let error = TanawError::db("the database could not be checked: database is locked");
    let message = failure_message(Some(Path::new("C:/Users/lex/AppData/Local/com.focalstack.tanaw")), &error);
    assert!(message.contains("C:/Users/lex/AppData/Local/com.focalstack.tanaw"), "{message}");
    assert!(message.contains("database is locked"), "{message}");
    assert!(message.contains("If Tanaw is already open"), "{message}");
}

#[test]
fn the_cause_reads_as_a_sentence() {
    let error = TanawError::db("the database could not be checked: unable to open database file");
    let message = failure_message(None, &error);
    assert!(message.contains("\n\nThe database could not be checked: unable to open database file.\n\n"), "{message}");
}

#[test]
fn still_explains_itself_when_there_is_no_data_folder() {
    let error = TanawError::new(ErrorCode::Io, "unknown path");
    let message = failure_message(None, &error);
    assert!(message.starts_with("Tanaw could not find its data folder."), "{message}");
    assert!(message.contains("Unknown path."), "{message}");
}
