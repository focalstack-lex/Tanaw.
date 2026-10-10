import { useEffect, type CSSProperties } from "react";
import { ensureAppCommands } from "./lib/appCommands";
import { commandForKey } from "./lib/commands";
import { describeError } from "./lib/errors";
import { ipc, toFilewellError } from "./lib/ipc";
import { OVERLAY_QUERY, usePanel } from "./store/panel";
import { usePlaces } from "./store/places";
import { useSettings } from "./store/settings";
import { activeTab, useTabs } from "./store/tabs";
import { useUi } from "./store/ui";
import { BrowserView } from "./components/browser/BrowserView";
import { HomeView } from "./components/home/HomeView";
import { CommandPalette } from "./components/palette/CommandPalette";
import { SettingsView } from "./components/settings/SettingsView";
import { Sidebar } from "./components/shell/Sidebar";
import { SidePanel } from "./components/shell/SidePanel";
import { StatusBar } from "./components/shell/StatusBar";
import { TitleBar } from "./components/shell/TitleBar";
import { ConfirmDialog } from "./components/ui/ConfirmDialog";
import { Toasts } from "./components/ui/Toasts";

export default function App() {
  const load = useSettings((state) => state.load);
  const settings = useSettings((state) => state.settings);
  const setAppInfo = useUi((state) => state.setAppInfo);
  const tab = useTabs(activeTab);
  const panelOpen = usePanel((state) => state.open);

  // Boot: commands, persisted settings (which paint the theme), app facts.
  useEffect(() => {
    ensureAppCommands();
    void load();
    void usePlaces.getState().load();
    ipc.getAppInfo().then(setAppInfo).catch((raw: unknown) => {
      const { title, detail } = describeError(toFilewellError(raw));
      useUi.getState().toast("error", title, detail);
    });
  }, [load, setAppInfo]);

  // Crossing the overlay breakpoint closes the panel (it would cover the content)
  // and widening past it docks the panel open again.
  useEffect(() => {
    const media = window.matchMedia(OVERLAY_QUERY);
    const onChange = () => usePanel.getState().setOpen(!media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // One key handler for every shortcut; overlays own their keys while open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ui = useUi.getState();
      if (ui.paletteOpen || ui.confirm) return;
      // Escape dismisses the panel when it is overlaying the content.
      if (event.key === "Escape" && usePanel.getState().open && window.matchMedia(OVERLAY_QUERY).matches) {
        event.preventDefault();
        usePanel.getState().setOpen(false);
        return;
      }
      const command = commandForKey(event);
      if (!command) return;
      event.preventDefault();
      void command.run();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const style = {
    "--sidebar-width": `${settings.sidebarWidth}px`,
    "--panel-width": `${settings.panelWidth}px`,
  } as CSSProperties;

  return (
    <div className={panelOpen ? "app has-panel" : "app"} style={style} data-testid="app">
      <TitleBar />
      <Sidebar />
      <main className="content" data-testid="content">
        {tab.view === "settings" ? <SettingsView /> : tab.view === "browser" ? <BrowserView key={tab.id} tab={tab} /> : <HomeView />}
      </main>
      {panelOpen && <SidePanel />}
      <StatusBar />
      <CommandPalette />
      <ConfirmDialog />
      <Toasts />
    </div>
  );
}
