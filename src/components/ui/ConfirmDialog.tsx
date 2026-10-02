import { useEffect, useRef, type KeyboardEvent } from "react";
import { useRestoreFocus } from "../../lib/useRestoreFocus";
import { useUi } from "../../store/ui";
import { Button } from "./Button";

/** Renders the pending question from the ui store; Escape and the backdrop answer no; focus returns to the opener. */
export function ConfirmDialog() {
  const confirm = useUi((state) => state.confirm);
  const answer = useUi((state) => state.answer);
  const primary = useRef<HTMLButtonElement>(null);

  // Declared before the focus effect so it records the opener, not the dialog's button.
  useRestoreFocus(Boolean(confirm));

  useEffect(() => {
    if (confirm) primary.current?.focus();
  }, [confirm]);

  if (!confirm) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      answer(false);
      return;
    }
    if (event.key === "Tab") {
      // Keep focus inside the dialog.
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const nextIndex = event.shiftKey ? (index - 1 + buttons.length) % buttons.length : (index + 1) % buttons.length;
      event.preventDefault();
      buttons[nextIndex]?.focus();
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={() => answer(false)} data-testid="confirm-dialog">
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <h2 id="dialog-title" className="dialog-title">{confirm.title}</h2>
        <p className="dialog-body">{confirm.body}</p>
        <div className="dialog-actions">
          <Button variant="ghost" onClick={() => answer(false)}>Cancel</Button>
          <Button ref={primary} variant={confirm.destructive ? "danger" : "primary"} onClick={() => answer(true)}>
            {confirm.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
