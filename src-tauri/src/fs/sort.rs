//! Natural, case-insensitive name order (spec 5.3): "file2" before "file10".

use std::cmp::Ordering;
use std::iter::Peekable;
use std::str::Chars;

#[cfg(test)]
mod tests;

pub fn natural_cmp(a: &str, b: &str) -> Ordering {
    let (mut left, mut right) = (a.chars().peekable(), b.chars().peekable());
    loop {
        match (left.peek().copied(), right.peek().copied()) {
            // Equal ignoring case and number padding: fall back to exact order so
            // the result is a total order and sorting is deterministic.
            (None, None) => return a.cmp(b),
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) if x.is_ascii_digit() && y.is_ascii_digit() => {
                let (digits_a, digits_b) = (take_digits(&mut left), take_digits(&mut right));
                let (value_a, value_b) = (digits_a.trim_start_matches('0'), digits_b.trim_start_matches('0'));
                let order = value_a
                    .len()
                    .cmp(&value_b.len())
                    .then_with(|| value_a.cmp(value_b))
                    .then_with(|| digits_a.len().cmp(&digits_b.len()));
                if order != Ordering::Equal {
                    return order;
                }
            }
            (Some(x), Some(y)) => {
                let order = fold(x).cmp(&fold(y));
                if order != Ordering::Equal {
                    return order;
                }
                left.next();
                right.next();
            }
        }
    }
}

fn take_digits(chars: &mut Peekable<Chars<'_>>) -> String {
    let mut digits = String::new();
    while let Some(c) = chars.peek().copied().filter(char::is_ascii_digit) {
        digits.push(c);
        chars.next();
    }
    digits
}

fn fold(c: char) -> char {
    c.to_lowercase().next().unwrap_or(c)
}
