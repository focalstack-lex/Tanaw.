import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { breadcrumbs, normalizeInputPath } from "../../lib/paths";
import { useTabs, type Tab } from "../../store/tabs";
import { useUi } from "../../store/ui";

/** Click a crumb to jump; click the empty space or press Ctrl+L to type a path. */
export function Breadcrumb({ tab }: { tab: Tab }) {
  const path = tab.path ?? "";
  const editRequest = useUi((state) => state.pathEditRequest);
  const seenRequest = useRef(editRequest);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(path);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const strip = useRef<HTMLElement>(null);

  const startEditing = () => {
    setDraft(path);
    setProblem(null);
    setEditing(true);
  };

  useEffect(() => {
    if (editRequest === seenRequest.current) return;
    seenRequest.current = editRequest;
    startEditing();
    // startEditing reads the current path; the request counter is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest]);

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);

  // Long paths keep their deepest folders in view.
  useEffect(() => {
    if (strip.current) strip.current.scrollLeft = strip.current.scrollWidth;
  }, [path, editing]);

  const stopEditing = () => {
    setEditing(false);
    setProblem(null);
  };

  // The field unmounts on Enter or Escape; hand focus back to the file view after the re-render.
  const returnFocus = () => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-testid="file-list"], [data-testid="file-grid"]')?.focus();
    });
  };

  const commit = () => {
    const target = normalizeInputPath(draft);
    if (!target) {
      setProblem("Type a full path, such as C:\\Users.");
      return;
    }
    stopEditing();
    useTabs.getState().navigate(tab.id, target);
    useUi.getState().requestViewFocus(target);
  };

  if (editing) {
    return (
      <div className="breadcrumb is-editing">
        <input
          ref={input}
          className="breadcrumb-input"
          value={draft}
          aria-label="Folder path"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? "path-problem" : undefined}
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              stopEditing();
              returnFocus();
            }
          }}
          onBlur={stopEditing}
          data-testid="path-input"
        />
        {problem && (
          <span id="path-problem" className="breadcrumb-problem" role="alert">
            {problem}
          </span>
        )}
      </div>
    );
  }

  const crumbs = breadcrumbs(path);
  return (
    <nav
      ref={strip}
      className="breadcrumb"
      aria-label="Folder path"
      onClick={(event) => {
        if (event.target === event.currentTarget) startEditing();
      }}
      data-testid="breadcrumb"
    >
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <Fragment key={crumb.path}>
            {index > 0 && <ChevronRight size={12} className="crumb-separator" aria-hidden="true" />}
            <button
              type="button"
              className={last ? "crumb is-current" : "crumb"}
              aria-current={last ? "location" : undefined}
              onClick={() => useTabs.getState().navigate(tab.id, crumb.path)}
            >
              {crumb.label}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
