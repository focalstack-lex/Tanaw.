import type { ErrorCode, TanawError } from "../types";

// Calm headlines per error code (spec 8.4). The raw message stays in `detail`.
const HEADLINES: Record<ErrorCode, string> = {
  notFound: "That item no longer exists.",
  permissionDenied: "Windows refused access.",
  alreadyExists: "Something with that name is already there.",
  invalidPath: "That location is not a valid path.",
  invalidName: "That name cannot be used.",
  protected: "Tanaw does not change that location.",
  cancelled: "The operation was cancelled.",
  io: "The file system reported a problem.",
  db: "Tanaw could not read or write its own data.",
  validation: "That value was not accepted.",
  unsupported: "That action is not available here.",
};

export function describeError(error: TanawError): { title: string; detail: string } {
  const where = error.path ? ` (${error.path})` : "";
  return { title: HEADLINES[error.code] ?? HEADLINES.io, detail: `${error.message}${where}` };
}
