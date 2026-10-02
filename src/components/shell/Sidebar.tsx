import type { ReactNode } from "react";
import { House, Settings } from "lucide-react";
import { activeTab, useTabs, type TabView } from "../../store/tabs";

interface NavItem {
  view: TabView;
  label: string;
  icon: ReactNode;
}

const TOP: NavItem[] = [{ view: "home", label: "Home", icon: <House size={16} /> }];
const BOTTOM: NavItem[] = [{ view: "settings", label: "Settings", icon: <Settings size={16} /> }];

function NavButton({ item, current, onSelect }: { item: NavItem; current: boolean; onSelect: (view: TabView) => void }) {
  return (
    <button
      type="button"
      className={current ? "nav-item is-active" : "nav-item"}
      aria-current={current ? "page" : undefined}
      title={item.label}
      onClick={() => onSelect(item.view)}
    >
      {item.icon}
      <span className="nav-label">{item.label}</span>
    </button>
  );
}

/** Collapses to an icon rail below 900 px (styles.css); drives and favorites join in piece 2. */
export function Sidebar() {
  const current = useTabs(activeTab);
  const activeId = useTabs((state) => state.activeId);
  const setView = useTabs((state) => state.setView);
  const select = (view: TabView) => setView(activeId, view);

  return (
    <nav className="sidebar" aria-label="Navigation" data-testid="sidebar">
      <div className="sidebar-section">
        {TOP.map((item) => <NavButton key={item.view} item={item} current={current.view === item.view} onSelect={select} />)}
      </div>
      <div className="sidebar-spacer" />
      <div className="sidebar-section">
        {BOTTOM.map((item) => <NavButton key={item.view} item={item} current={current.view === item.view} onSelect={select} />)}
      </div>
    </nav>
  );
}
