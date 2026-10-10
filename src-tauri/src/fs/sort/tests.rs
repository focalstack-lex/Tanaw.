use super::*;
use std::cmp::Ordering;

fn sorted(names: &[&str]) -> Vec<String> {
    let mut list: Vec<String> = names.iter().map(|name| name.to_string()).collect();
    list.sort_by(|a, b| natural_cmp(a, b));
    list
}

#[test]
fn numbers_compare_by_value_and_case_is_ignored() {
    assert_eq!(sorted(&["file10", "file2", "File1"]), ["File1", "file2", "file10"]);
    assert_eq!(sorted(&["b", "A", "c"]), ["A", "b", "c"]);
    assert_eq!(sorted(&["img7", "img007", "img10"]), ["img7", "img007", "img10"]);
}

#[test]
fn ties_break_deterministically() {
    assert_eq!(natural_cmp("a", "a"), Ordering::Equal);
    assert_eq!(natural_cmp("A", "a"), Ordering::Less);
    assert_eq!(natural_cmp("a", "ab"), Ordering::Less);
}

#[test]
fn handles_digits_at_the_end_and_unicode() {
    assert_eq!(sorted(&["2026-10-02", "2026-9-30"]), ["2026-9-30", "2026-10-02"]);
    // Case-folded equal, so the exact-order tie-break decides: still a total order.
    assert!(natural_cmp("\u{e4}lpha", "\u{c4}lpha").is_ne());
}
