import { File, FileArchive, FileCode, FileImage, FileSpreadsheet, FileText, FileVideo, Folder } from "lucide-react";
import { categoryOf, type FileCategory } from "../../lib/fileTypes";
import type { Entry } from "../../types";

const ICONS: Record<FileCategory, typeof File> = {
  folder: Folder,
  document: FileText,
  image: FileImage,
  code: FileCode,
  archive: FileArchive,
  media: FileVideo,
  data: FileSpreadsheet,
  other: File,
};

export function FileIcon({ entry, size = 16 }: { entry: Pick<Entry, "kind" | "ext">; size?: number }) {
  const category = categoryOf(entry);
  const Icon = ICONS[category];
  return <Icon size={size} className={`file-icon tone-${category}`} aria-hidden="true" />;
}
