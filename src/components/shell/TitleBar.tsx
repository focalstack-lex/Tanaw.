import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Plus, Square, X } from "lucide-react";
import { isTauriHost } from "../../lib/ipc";
import { tabTitle, useTabs } from "../../store/tabs";
import { IconButton } from "../ui/IconButton";

type WindowAction = "minimize" | "toggleMaximize" | "close";

function windowControl(action: WindowAction): void {
  if (!isTauriHost()) return;
  getCurrentWindow()[action]().catch((error: unknown) => {
    console.error(`window ${action} failed`, error);
  });
}

/** Tabs on the left, window controls on the right, a drag region between (spec 8.1). */
export function TitleBar() {
  const tabs = useTabs((state) => state.tabs);
  const activeId = useTabs((state) => state.activeId);
  const activate = useTabs((state) => state.activate);
  const closeTab = useTabs((state) => state.closeTab);
  const newTab = useTabs((state) => state.newTab);
  const [maximized, setMaximized] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // Tabs scroll when they outnumber the strip; keep the active one in view.
  useEffect(() => {
    scroller.current?.querySelector(".tab.is-active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, tabs.length]);

  useEffect(() => {
    if (!isTauriHost()) return;
    const win = getCurrentWindow();
    let stop: (() => void) | undefined;
    const refresh = () => {
      win.isMaximized().then(setMaximized).catch((error: unknown) => console.warn("isMaximized failed", error));
    };
    refresh();
    win.onResized(refresh).then((unlisten) => { stop = unlisten; }).catch((error: unknown) => console.warn("onResized failed", error));
    return () => stop?.();
  }, []);

  return (
    <header className="titlebar" data-tauri-drag-region data-testid="titlebar">
      <div className="titlebar-tabs">
        <div
          ref={scroller}
          className="tab-scroller"
          role="tablist"
          aria-label="Tabs"
          onWheel={(event) => {
            // A vertical wheel scrolls the strip sideways, as in browsers.
            if (event.deltaX === 0) event.currentTarget.scrollLeft += event.deltaY;
          }}
        >
        {tabs.map((tab) => {
          const title = tabTitle(tab);
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              className={active ? "tab is-active" : "tab"}
              role="tab"
              aria-selected={active}
              title={title}
              tabIndex={0}
              onClick={() => activate(tab.id)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") activate(tab.id); }}
              onAuxClick={(event) => { if (event.button === 1) closeTab(tab.id); }}
              data-testid="tab"
            >
              <span className="tab-title">{title}</span>
              <button
                type="button"
                className="tab-close"
                aria-label={`Close ${title}`}
                onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
        </div>
        <IconButton label="New tab" onClick={() => newTab("home")} data-testid="tab-new">
          <Plus size={14} />
        </IconButton>
      </div>
      <div className="titlebar-drag" data-tauri-drag-region />
      <div className="window-controls">
        <button type="button" className="window-control" aria-label="Minimize" onClick={() => windowControl("minimize")}>
          <Minus size={14} />
        </button>
        <button type="button" className="window-control" aria-label={maximized ? "Restore" : "Maximize"} onClick={() => windowControl("toggleMaximize")}>
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button type="button" className="window-control window-control-close" aria-label="Close" onClick={() => windowControl("close")}>
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
