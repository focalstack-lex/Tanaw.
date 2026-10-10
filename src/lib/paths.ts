// Windows path helpers for the renderer. Paths arrive from Rust in Windows form
// (C:\Users\dev or \\server\share\docs); people type either separator.

const SEP = "\\";
const DRIVE = /^([A-Za-z]):(?:[\\/]|$)/;
const UNC = /^[\\/]{2}([^\\/]+)[\\/]+([^\\/]+)(?:[\\/]|$)/;

interface Split {
  root: string;
  parts: string[];
}

function rest(tail: string): string[] {
  return tail.split(/[\\/]+/).filter(Boolean);
}

function split(path: string): Split | null {
  const drive = DRIVE.exec(path);
  if (drive) return { root: `${drive[1].toUpperCase()}:${SEP}`, parts: rest(path.slice(drive[0].length)) };
  const unc = UNC.exec(path);
  if (unc) return { root: `${SEP}${SEP}${unc[1]}${SEP}${unc[2]}${SEP}`, parts: rest(path.slice(unc[0].length)) };
  return null;
}

function join({ root, parts }: Split): string {
  return root + parts.join(SEP);
}

/** The containing folder, or null at a drive or share root. */
export function parentPath(path: string): string | null {
  const parsed = split(path);
  if (!parsed || parsed.parts.length === 0) return null;
  return join({ root: parsed.root, parts: parsed.parts.slice(0, -1) });
}

export interface Crumb {
  label: string;
  path: string;
}

export function breadcrumbs(path: string): Crumb[] {
  const parsed = split(path);
  if (!parsed) return [{ label: path, path }];
  const rootLabel = parsed.root.endsWith(`:${SEP}`) ? parsed.root.slice(0, 2) : parsed.root.slice(0, -1);
  const crumbs: Crumb[] = [{ label: rootLabel, path: parsed.root }];
  parsed.parts.forEach((part, index) => {
    crumbs.push({ label: part, path: join({ root: parsed.root, parts: parsed.parts.slice(0, index + 1) }) });
  });
  return crumbs;
}

/** Cleans a typed or pasted path; null when it is not a full Windows path. */
export function normalizeInputPath(raw: string): string | null {
  let text = raw.trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1).trim();
  if (!text) return null;
  const parsed = split(text);
  return parsed ? join(parsed) : null;
}

/** Windows compares paths without case and without a trailing separator. */
export function samePath(a: string, b: string): boolean {
  const canonical = (path: string) => (normalizeInputPath(path) ?? path).toLowerCase();
  return canonical(a) === canonical(b);
}
