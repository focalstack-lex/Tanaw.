// The command registry: the single source of truth for titles and shortcuts.
// The palette lists it, the key handler executes it, docs/FEATURE_MAP.md is
// checked against it by a test.
import { isEditableTarget, matchesShortcut, parseShortcut, type KeyLike, type Shortcut } from "./shortcuts";

export type CommandGroup = "tabs" | "navigate" | "view" | "app";

export interface Command {
  id: string;
  title: string;
  group: CommandGroup;
  /** Written form, for example "Ctrl+Shift+N". Palette-only commands have none. */
  shortcut?: string;
  /** Global shortcuts fire even while a text field has focus. */
  global?: boolean;
  /** Returning false hides the command from the palette and ignores its shortcut. */
  when?: () => boolean;
  run: () => void | Promise<void>;
}

interface Registered {
  command: Command;
  parsed: Shortcut | null;
}

let registry: Registered[] = [];

function sameShortcut(a: Shortcut, b: Shortcut): boolean {
  return a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt && a.key === b.key;
}

export function registerCommands(commands: Command[]): void {
  for (const command of commands) {
    if (registry.some((entry) => entry.command.id === command.id)) {
      throw new Error(`Duplicate command id: ${command.id}`);
    }
    const parsed = command.shortcut ? parseShortcut(command.shortcut) : null;
    if (parsed && registry.some((entry) => entry.parsed && sameShortcut(entry.parsed, parsed))) {
      throw new Error(`Shortcut ${command.shortcut} is already bound (${command.id})`);
    }
    registry.push({ command, parsed });
  }
}

export function listCommands(): Command[] {
  return registry.map((entry) => entry.command);
}

export function findCommand(id: string): Command | undefined {
  return registry.find((entry) => entry.command.id === id)?.command;
}

export function isAvailable(command: Command): boolean {
  return command.when ? command.when() : true;
}

/** Runs a command by id; false when it is unknown or unavailable. */
export async function runCommand(id: string): Promise<boolean> {
  const command = findCommand(id);
  if (!command || !isAvailable(command)) return false;
  await command.run();
  return true;
}

/** Resolves a key event to the command it should run, honouring focus context. */
export function commandForKey(event: KeyLike & { target?: EventTarget | null }): Command | null {
  const editable = isEditableTarget(event.target ?? null);
  for (const { command, parsed } of registry) {
    if (!parsed || !matchesShortcut(event, parsed)) continue;
    if (editable && !command.global) continue;
    if (!isAvailable(command)) continue;
    return command;
  }
  return null;
}

/** Test helper. */
export function resetCommands(): void {
  registry = [];
}
