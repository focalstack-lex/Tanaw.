import { ArrowLeft, ArrowRight, ArrowUp, LayoutGrid, List, RotateCw } from "lucide-react";
import { reloadTab } from "../../lib/fileActions";
import { parentPath } from "../../lib/paths";
import { useTabs, type Tab } from "../../store/tabs";
import type { ViewMode } from "../../types";
import { IconButton } from "../ui/IconButton";
import { Breadcrumb } from "./Breadcrumb";

export function Toolbar({ tab, viewMode }: { tab: Tab; viewMode: ViewMode }) {
  const tabs = () => useTabs.getState();
  const canGoUp = tab.path !== null && parentPath(tab.path) !== null;
  return (
    <div className="browser-toolbar" data-testid="browser-toolbar">
      <div className="toolbar-group">
        <IconButton label="Back (Alt+Left)" disabled={tab.history.back.length === 0} onClick={() => tabs().goBack(tab.id)} data-testid="nav-back">
          <ArrowLeft size={16} />
        </IconButton>
        <IconButton label="Forward (Alt+Right)" disabled={tab.history.forward.length === 0} onClick={() => tabs().goForward(tab.id)} data-testid="nav-forward">
          <ArrowRight size={16} />
        </IconButton>
        <IconButton label="Up to the parent folder (Alt+Up)" disabled={!canGoUp} onClick={() => tabs().goUp(tab.id)} data-testid="nav-up">
          <ArrowUp size={16} />
        </IconButton>
      </div>
      <Breadcrumb tab={tab} />
      <div className="toolbar-group">
        <IconButton label="Refresh (F5)" onClick={() => void reloadTab(tab.id)}>
          <RotateCw size={16} />
        </IconButton>
        <IconButton label="List view (Ctrl+Shift+1)" active={viewMode === "list"} onClick={() => tabs().setViewMode(tab.id, "list")} data-testid="view-list">
          <List size={16} />
        </IconButton>
        <IconButton label="Grid view (Ctrl+Shift+2)" active={viewMode === "grid"} onClick={() => tabs().setViewMode(tab.id, "grid")} data-testid="view-grid">
          <LayoutGrid size={16} />
        </IconButton>
      </div>
    </div>
  );
}
