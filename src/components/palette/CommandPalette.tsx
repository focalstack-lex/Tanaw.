import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { isAvailable, listCommands, type Command, type CommandGroup } from "../../lib/commands";
import { useRestoreFocus } from "../../lib/useRestoreFocus";
import { useUi } from "../../store/ui";
import { Kbd } from "../ui/Kbd";

const GROUP_LABEL: Record<CommandGroup, string> = {
  tabs: "Tabs",
  navigate: "Navigate",
  view: "View",
  app: "App",
};

const LIST_ID = "palette-list";
const optionId = (command: Command) => `palette-option-${command.id}`;

/**
 * Ctrl+K: every available command, filtered by title, run with Enter or a click.
 * Focus stays on the input (a combobox over the listbox); the active option is
 * announced through aria-activedescendant and scrolled into view. Focus returns
 * to whatever had it before the palette opened.
 */
export function CommandPalette() {
  const open = useUi((state) => state.paletteOpen);
  const close = useUi((state) => state.closePalette);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // Computed on every render: the registry fills after the first mount, and a
  // memo keyed on the query alone would show an empty list on first open.
  const needle = query.trim().toLowerCase();
  const items = listCommands().filter((command) => isAvailable(command) && (needle === "" || command.title.toLowerCase().includes(needle)));
  const active = items[index];

  useRestoreFocus(open);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    // Synchronous: the input is mounted by the time effects run, and a deferred
    // focus would leave a frame in which keys still go to the opener.
    input.current?.focus();
  }, [open]);

  // Escape and Tab are claimed at the document while the palette is open, so
  // they work wherever focus is. Stopping propagation keeps the app's own
  // Escape (dismissing the overlay panel) from firing on the same key press.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === "Tab") {
        // The input is the palette's only stop; Tab never leaves the modal.
        event.preventDefault();
        event.stopPropagation();
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, close]);

  const activeId = active ? optionId(active) : undefined;
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  if (!open) return null;

  const run = (command: Command) => {
    close();
    void command.run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((current) => Math.min(current + 1, Math.max(items.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active) run(active);
    }
  };

  return (
    <div className="palette-backdrop" onMouseDown={close} data-testid="command-palette">
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <input
          ref={input}
          className="palette-input"
          placeholder="Type a command"
          aria-label="Search commands"
          role="combobox"
          aria-expanded="true"
          aria-controls={LIST_ID}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setIndex(0); }}
        />
        <ul id={LIST_ID} className="palette-list" role="listbox" aria-label="Commands" tabIndex={-1}>
          {items.map((command, position) => (
            <li
              key={command.id}
              id={optionId(command)}
              role="option"
              aria-selected={position === index}
              className={position === index ? "palette-item is-active" : "palette-item"}
              onMouseEnter={() => setIndex(position)}
              onClick={() => run(command)}
            >
              <span className="palette-group micro">{GROUP_LABEL[command.group]}</span>
              <span className="palette-title">{command.title}</span>
              {command.shortcut && <Kbd shortcut={command.shortcut} />}
            </li>
          ))}
          {items.length === 0 && <li className="palette-empty">Nothing matches {query}.</li>}
        </ul>
      </div>
    </div>
  );
}
