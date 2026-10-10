//! What happens when Filewell cannot start. A failure inside Tauri's setup closure
//! would otherwise become a panic, and release builds abort on panic with no
//! console, so the user would see the window flash and vanish with nothing in
//! the log. Instead the cause is logged, shown in a native message box, and the
//! process exits with status 1.

use std::path::Path;

use crate::error::FilewellError;

#[cfg(test)]
mod tests;

const TITLE: &str = "Filewell could not start";
const ADVICE: &str = "If Filewell is already open, close it and start it again. If this keeps happening, \
check that the folder exists, has free space and is not read-only.";

/// The sentence the user reads: where, why, and what to try.
pub fn failure_message(data_dir: Option<&Path>, error: &FilewellError) -> String {
    let headline = match data_dir {
        Some(dir) => format!("Filewell could not open its data folder at {}.", dir.display()),
        None => "Filewell could not find its data folder.".to_string(),
    };
    format!("{headline}\n\n{}\n\n{ADVICE}", as_sentence(&error.message))
}

/// Error messages from SQLite and std read as fragments; the user gets a sentence.
fn as_sentence(text: &str) -> String {
    let text = text.trim();
    let mut chars = text.chars();
    let mut sentence = match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect::<String>(),
        None => return String::new(),
    };
    if !sentence.ends_with(['.', '!', '?']) {
        sentence.push('.');
    }
    sentence
}

/// Logs the failure, tells the user, and exits. Never returns.
pub fn fail(message: &str) -> ! {
    log::error!("{TITLE}: {}", message.replace('\n', " "));
    log::logger().flush();
    show_error(TITLE, message);
    std::process::exit(1);
}

#[cfg(windows)]
#[allow(unsafe_code)]
fn show_error(title: &str, message: &str) {
    use windows::core::HSTRING;
    use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
    let (text, caption) = (HSTRING::from(message), HSTRING::from(title));
    // SAFETY: MessageBoxW only reads the two null-terminated UTF-16 strings,
    // which live until the call returns; it takes no ownership of anything.
    unsafe {
        MessageBoxW(None, &text, &caption, MB_OK | MB_ICONERROR);
    }
}

#[cfg(not(windows))]
fn show_error(_title: &str, _message: &str) {}
