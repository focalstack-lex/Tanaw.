import type { ReactNode } from "react";
import { Download, FileText, Folder, HardDrive, House, Image, Monitor, Music, Settings, Usb, Video } from "lucide-react";
import { samePath } from "../../lib/paths";
import { usePlaces } from "../../store/places";
import { activeTab, useTabs, type TabView } from "../../store/tabs";
import type { Drive } from "../../types";

const FOLDER_ICONS: Record<string, ReactNode> = {
  desktop: <Monitor size={16} />,
  documents: <FileText size={16} />,
  downloads: <Download size={16} />,
  pictures: <Image size={16} />,
  music: <Music size={16} />,
  videos: <Video size={16} />,
  home: <Folder size={16} />,
};

/** "Local Disk (C:)", as Explorer names drives. */
export function driveLabel(drive: Drive): string {
  return `${drive.label} (${drive.mountPoint.replace(/[\\/]+$/, "")})`;
}

interface NavButtonProps {
  label: string;
  icon: ReactNode;
  current: boolean;
  onSelect: () => void;
  testId?: string;
}

function NavButton({ label, icon, current, onSelect, testId }: NavButtonProps) {
  return (
    <button
      type="button"
      className={current ? "nav-item is-active" : "nav-item"}
      aria-current={current ? "page" : undefined}
      title={label}
      onClick={onSelect}
      data-testid={testId}
    >
      {icon}
      <span className="nav-label">{label}</span>
    </button>
  );
}

/** Home, then This PC (drives), then the known folders; collapses to an icon rail below 900 px. */
export function Sidebar() {
  const tab = useTabs(activeTab);
  const drives = usePlaces((state) => state.drives);
  const folders = usePlaces((state) => state.folders);
  const show = (view: TabView) => useTabs.getState().setView(tab.id, view);
  const go = (path: string) => useTabs.getState().navigate(tab.id, path);
  const at = (path: string) => tab.view === "browser" && tab.path !== null && samePath(tab.path, path);

  return (
    <nav className="sidebar" aria-label="Navigation" data-testid="sidebar">
      <div className="sidebar-section">
        <NavButton label="Home" icon={<House size={16} />} current={tab.view === "home"} onSelect={() => show("home")} />
      </div>
      {drives.length > 0 && (
        <div className="sidebar-section" role="group" aria-label="This PC">
          <p className="sidebar-heading">This PC</p>
          {drives.map((drive) => (
            <NavButton
              key={drive.mountPoint}
              label={driveLabel(drive)}
              icon={drive.kind === "removable" ? <Usb size={16} /> : <HardDrive size={16} />}
              current={at(drive.mountPoint)}
              onSelect={() => go(drive.mountPoint)}
              testId="place-drive"
            />
          ))}
        </div>
      )}
      {folders.length > 0 && (
        <div className="sidebar-section" role="group" aria-label="Folders">
          <p className="sidebar-heading">Folders</p>
          {folders.map((folder) => (
            <NavButton
              key={folder.id}
              label={folder.label}
              icon={FOLDER_ICONS[folder.id] ?? <Folder size={16} />}
              current={at(folder.path)}
              onSelect={() => go(folder.path)}
              testId="place-folder"
            />
          ))}
        </div>
      )}
      <div className="sidebar-spacer" />
      <div className="sidebar-section">
        <NavButton label="Settings" icon={<Settings size={16} />} current={tab.view === "settings"} onSelect={() => show("settings")} />
      </div>
    </nav>
  );
}
