import { shortcutKeys } from "../../lib/shortcuts";

export function Kbd({ shortcut }: { shortcut: string }) {
  return (
    <span className="kbd" aria-label={shortcut}>
      {shortcutKeys(shortcut).map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  );
}
