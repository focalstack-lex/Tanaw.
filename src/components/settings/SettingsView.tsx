import type { Theme, ViewMode } from "../../types";
import { useSettings } from "../../store/settings";
import { useUi } from "../../store/ui";
import { Field } from "../ui/Field";

export function SettingsView() {
  const settings = useSettings((state) => state.settings);
  const update = useSettings((state) => state.update);
  const info = useUi((state) => state.appInfo);

  return (
    <section className="view" data-testid="settings-view">
      <h1 className="view-title">Settings</h1>

      <div className="settings-group">
        <h2 className="settings-heading">Appearance</h2>
        <Field label="Theme" hint="System follows the Windows setting.">
          <select
            className="input"
            value={settings.theme}
            onChange={(event) => update("theme", event.target.value as Theme)}
            data-testid="setting-theme"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Field>
        <Field label="Default view" hint="How a folder opens the first time.">
          <select
            className="input"
            value={settings.defaultView}
            onChange={(event) => update("defaultView", event.target.value as ViewMode)}
          >
            <option value="list">List</option>
            <option value="grid">Grid</option>
          </select>
        </Field>
      </div>

      <div className="settings-group">
        <h2 className="settings-heading">Files</h2>
        <Field label="Show hidden and system files" hint="Ctrl+H toggles this while browsing.">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.showHidden}
            onChange={(event) => update("showHidden", event.target.checked)}
          />
        </Field>
      </div>

      <div className="settings-group">
        <h2 className="settings-heading">Updates</h2>
        <Field label="Check for updates when Filewell starts" hint="The only network request Filewell makes. Installing always asks first.">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.checkUpdates}
            onChange={(event) => update("checkUpdates", event.target.checked)}
          />
        </Field>
      </div>

      <div className="settings-group">
        <h2 className="settings-heading">About</h2>
        <dl className="about">
          <dt>Version</dt>
          <dd className="mono">{info?.version ?? ""}</dd>
          <dt>Data folder</dt>
          <dd className="mono">{info?.dataDir ?? ""}</dd>
        </dl>
      </div>
    </section>
  );
}
