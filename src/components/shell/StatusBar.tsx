import { PanelRight } from "lucide-react";
import { usePanel } from "../../store/panel";
import { useSettings } from "../../store/settings";
import { activeTab, tabTitle, useTabs } from "../../store/tabs";
import { IconButton } from "../ui/IconButton";

export function StatusBar() {
  const tab = useTabs(activeTab);
  const showHidden = useSettings((state) => state.settings.showHidden);
  const panelOpen = usePanel((state) => state.open);
  const togglePanel = usePanel((state) => state.toggle);

  return (
    <footer className="statusbar" data-testid="statusbar">
      <span className="status-text">{tabTitle(tab)}</span>
      <span className="status-text status-muted" data-testid="status-hidden">
        {showHidden ? "Hidden files shown" : ""}
      </span>
      <span className="status-spacer" />
      <IconButton label="Show or hide the side panel" active={panelOpen} onClick={togglePanel}>
        <PanelRight size={14} />
      </IconButton>
    </footer>
  );
}
