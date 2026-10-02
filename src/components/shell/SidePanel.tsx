import type { ReactNode } from "react";
import { Image, ListChecks, NotebookPen } from "lucide-react";
import type { PanelTab } from "../../types";
import { useSettings } from "../../store/settings";
import { EmptyState } from "../ui/EmptyState";

interface PanelTabSpec {
  id: PanelTab;
  label: string;
  icon: ReactNode;
  empty: string;
}

const TABS: PanelTabSpec[] = [
  { id: "preview", label: "Preview", icon: <Image size={14} />, empty: "Select a file to preview it." },
  { id: "notes", label: "Notes", icon: <NotebookPen size={14} />, empty: "No notes yet." },
  { id: "todos", label: "To-dos", icon: <ListChecks size={14} />, empty: "No to-dos yet." },
];

/** Preview, Notes and To-dos tabs; a fourth slot stays reserved for the assistant (spec 8.1). */
export function SidePanel() {
  const active = useSettings((state) => state.settings.panelTab);
  const update = useSettings((state) => state.update);
  const current = TABS.find((tab) => tab.id === active) ?? TABS[0];

  return (
    <aside className="panel" data-testid="side-panel" aria-label="Side panel">
      <div className="panel-tabs" role="tablist" aria-label="Side panel sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`panel-tab-${tab.id}`}
            aria-selected={tab.id === current.id}
            aria-controls="panel-content"
            className={tab.id === current.id ? "panel-tab is-active" : "panel-tab"}
            onClick={() => update("panelTab", tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div id="panel-content" className="panel-content" role="tabpanel" aria-labelledby={`panel-tab-${current.id}`}>
        <EmptyState message={current.empty} />
      </div>
    </aside>
  );
}
