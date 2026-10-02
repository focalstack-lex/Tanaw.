import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { isAvailable, listCommands, type Command, type CommandGroup } from "../../lib/commands";
import { useUi } from "../../store/ui";
import { Kbd } from "../ui/Kbd";

const GROUP_LABEL: Record<CommandGroup, string> = {
  tabs: "Tabs",
  navigate: "Navigate",
  view: "View",
  app: "App",
};

/** Ctrl+K: every available command, filtered by title, run with Enter or a click. */
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

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  const run = (command: Command) => {
    close();
    void command.run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((current) => Math.min(current + 1, Math.max(items.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = items[index];
      if (command) run(command);
    }
  };

  return (
    <div className="palette-backdrop" onMouseDown={close} data-testid="command-palette">
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}>
        <input
          ref={input}
          className="palette-input"
          placeholder="Type a command"
          aria-label="Search commands"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setIndex(0); }}
          onKeyDown={onKeyDown}
        />
        <ul className="palette-list" role="listbox" aria-label="Commands">
          {items.map((command, position) => (
            <li
              key={command.id}
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
