import { useEffect } from "react";

/**
 * While `active` is true, remembers the element that had focus when it became
 * true and gives focus back to it afterwards, if it is still in the document.
 * Call it before the overlay moves focus into itself (the palette and the
 * confirm dialog both focus their first control after this effect runs).
 */
export function useRestoreFocus(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [active]);
}
