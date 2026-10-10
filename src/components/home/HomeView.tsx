import { useEffect } from "react";
import { HardDrive, Usb } from "lucide-react";
import { formatSize } from "../../lib/format";
import { usePlaces } from "../../store/places";
import { activeTab, useTabs } from "../../store/tabs";
import { useUi } from "../../store/ui";
import { EmptyState } from "../ui/EmptyState";
import { driveLabel } from "../shell/Sidebar";

/** Drive cards now; favorites and recent files join in piece 2c. */
export function HomeView() {
  const info = useUi((state) => state.appInfo);
  const drives = usePlaces((state) => state.drives);
  const loaded = usePlaces((state) => state.loaded);
  const tabId = useTabs((state) => activeTab(state).id);

  useEffect(() => {
    void usePlaces.getState().load();
  }, []);

  return (
    <section className="view" data-testid="home-view">
      {info?.databaseRecovered && (
        <div className="notice" role="status">
          The Filewell database was damaged and has been reset. The damaged file was kept beside it.
        </div>
      )}
      <h1 className="view-title">Home</h1>
      <h2 className="section-heading">Drives</h2>
      {loaded && drives.length === 0 && <EmptyState message="No drives were found." />}
      <div className="drive-grid">
        {drives.map((drive) => {
          const used = Math.max(drive.totalBytes - drive.availableBytes, 0);
          const share = drive.totalBytes > 0 ? used / drive.totalBytes : 0;
          return (
            <button
              key={drive.mountPoint}
              type="button"
              className="drive-card"
              onClick={() => useTabs.getState().navigate(tabId, drive.mountPoint)}
              data-testid="drive-card"
            >
              <span className="drive-name">
                {drive.kind === "removable" ? <Usb size={16} aria-hidden="true" /> : <HardDrive size={16} aria-hidden="true" />}
                {driveLabel(drive)}
              </span>
              <span
                className="drive-bar"
                role="meter"
                aria-label={`${driveLabel(drive)} used space`}
                aria-valuemin={0}
                aria-valuemax={drive.totalBytes}
                aria-valuenow={used}
              >
                <span className={share >= 0.9 ? "drive-bar-fill is-nearly-full" : "drive-bar-fill"} style={{ width: `${Math.round(share * 100)}%` }} />
              </span>
              <span className="drive-free">
                {formatSize(drive.availableBytes)} free of {formatSize(drive.totalBytes)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
