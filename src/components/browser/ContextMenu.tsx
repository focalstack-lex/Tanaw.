import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { copyPaths, openEntry, openWithEntry, revealEntry } from "../../lib/fileActions";
import { useRestoreFocus } from "../../lib/useRestoreFocus";
import { useSelection } from "../../store/selection";
import type { Tab } from "../../store/tabs";
import type { Entry } from "../../types";

/** What a list or grid asks the browser view to do with an entry. */
export type EntryAction = { kind: "open"; entry: Entry } | { kind: "menu"; entry: Entry; x: number; y: number };

interface MenuItem {
  label: string;
  run: () => Promise<void>;
}

interface ContextMenuProps {
  tab: Tab;
  entry: Entry;
  x: number;
  y: number;
  onClose: () => void;
}

/**
 * Rendered into document.body so no transformed ancestor (the virtualized rows
 * use transforms) becomes its containing block. Arrow keys move, Enter runs,
 * Escape or Tab closes, and focus returns to the file view.
 */
export function ContextMenu({ tab, entry, x, y, onClose }: ContextMenuProps) {
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  useRestoreFocus(true);

  const selected = useSelection.getState().of(tab.id).selected;
  const targets = selected.has(entry.path) ? [...selected] : [entry.path];
  const items: MenuItem[] = [
    { label: "Open", run: () => openEntry(tab.id, entry) },
    ...(entry.kind === "file" ? [{ label: "Open with", run: () => openWithEntry(entry) }] : []),
    { label: "Show in Explorer", run: () => revealEntry(entry) },
    { label: targets.length > 1 ? `Copy ${targets.length} paths` : "Copy path", run: () => copyPaths(targets) },
  ];

  useLayoutEffect(() => {
    const element = menu.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setPosition({
      left: Math.max(4, Math.min(x, window.innerWidth - rect.width - 4)),
      top: Math.max(4, Math.min(y, window.innerHeight - rect.height - 4)),
    });
  }, [x, y]);

  // A passive effect, so it runs after useRestoreFocus has recorded the opener
  // (layout effects would move focus into the menu first).
  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);

  useEffect(() => {
    const away = (event: Event) => {
      if (menu.current && event.target instanceof Node && menu.current.contains(event.target)) return;
      onClose();
    };
    window.addEventListener("mousedown", away, true);
    window.addEventListener("wheel", away, true);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", away, true);
      window.removeEventListener("wheel", away, true);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const index = buttons.findIndex((button) => button === document.activeElement);
    const move = (to: number) => {
      event.preventDefault();
      buttons[(to + buttons.length) % buttons.length]?.focus();
    };
    if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(buttons.length - 1);
    else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return createPortal(
    <div
      ref={menu}
      className="context-menu"
      role="menu"
      aria-label={`Actions for ${entry.name}`}
      style={position}
      onKeyDown={onKeyDown}
      data-testid="context-menu"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className="menu-item"
          onClick={() => {
            onClose();
            void item.run();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
