// Extension to category. The category picks the icon and the muted tone token
// (--type-*): color here carries information, as the chrome stays monochrome.
import type { Entry } from "../types";

export type FileCategory = "folder" | "document" | "image" | "code" | "archive" | "media" | "data" | "other";

const GROUPS: Record<Exclude<FileCategory, "folder" | "other">, string[]> = {
  document: ["pdf", "doc", "docx", "txt", "md", "rtf", "odt", "ppt", "pptx", "epub"],
  image: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "heic", "tif", "tiff", "psd", "raw", "cr2", "nef"],
  code: ["ts", "tsx", "js", "jsx", "mjs", "rs", "py", "java", "c", "cpp", "h", "cs", "go", "html", "css", "json", "toml", "yml", "yaml", "xml", "sh", "ps1", "sql"],
  archive: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso"],
  media: ["mp3", "wav", "flac", "aac", "ogg", "m4a", "mp4", "mkv", "mov", "avi", "webm", "wmv"],
  data: ["xls", "xlsx", "csv", "db", "sqlite", "ods", "parquet"],
};

const BY_EXT = new Map<string, FileCategory>(
  Object.entries(GROUPS).flatMap(([category, exts]) => exts.map((ext) => [ext, category as FileCategory] as const)),
);

export function categoryOf(entry: Pick<Entry, "kind" | "ext">): FileCategory {
  if (entry.kind === "dir") return "folder";
  return BY_EXT.get(entry.ext) ?? "other";
}
