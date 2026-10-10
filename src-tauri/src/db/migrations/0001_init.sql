-- Filewell schema, version 1 (spec 5.9). Ids are UUID v4 strings so backups
-- merge across machines; timestamps are Unix milliseconds; due_date is an
-- ISO calendar date.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('file', 'dir')),
  position INTEGER NOT NULL,
  added_at INTEGER NOT NULL
);

CREATE TABLE recent_files (
  path TEXT PRIMARY KEY,
  opened_at INTEGER NOT NULL,
  open_count INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE note_versions (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX note_versions_note ON note_versions(note_id, created_at);

CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
