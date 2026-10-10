import { PanelRight } from "lucide-react";
import { formatSize } from "../../lib/format";
import { useListings } from "../../store/listings";
import { usePanel } from "../../store/panel";
import { useSelection } from "../../store/selection";
import { useSettings } from "../../store/settings";
import { activeTab, tabTitle, useTabs } from "../../store/tabs";
import { IconButton } from "../ui/IconButton";

const count = (n: number) => `${n.toLocaleString()} ${n === 1 ? "item" : "items"}`;

export function StatusBar() {
  const tab = useTabs(activeTab);
  const listing = useListings((state) => state.byTab[tab.id]?.listing ?? null);
  const selection = useSelection((state) => state.byTab[tab.id]);
  const showHidden = useSettings((state) => state.settings.showHidden);
  const panelOpen = usePanel((state) => state.open);
  const togglePanel = usePanel((state) => state.toggle);

  const browsing = tab.view === "browser" && listing !== null;
  let selectedText = "";
  if (browsing && selection && selection.selected.size > 0) {
    const chosen = listing.entries.filter((entry) => selection.selected.has(entry.path));
    const bytes = chosen.filter((entry) => entry.kind === "file").reduce((sum, entry) => sum + entry.size, 0);
    selectedText = `${chosen.length.toLocaleString()} selected${bytes > 0 ? `, ${formatSize(bytes)}` : ""}`;
  }

  return (
    <footer className="statusbar" data-testid="statusbar">
      <span className="status-text" data-testid="status-items">
        {browsing ? count(listing.total) : tabTitle(tab)}
      </span>
      {selectedText && (
        <span className="status-text status-muted" data-testid="status-selection">
          {selectedText}
        </span>
      )}
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
