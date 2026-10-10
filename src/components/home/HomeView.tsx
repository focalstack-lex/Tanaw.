import { useUi } from "../../store/ui";

/** Drive cards, favorites and recent files arrive in piece 2; today Home is honest about being empty. */
export function HomeView() {
  const info = useUi((state) => state.appInfo);
  return (
    <section className="view" data-testid="home-view">
      {info?.databaseRecovered && (
        <div className="notice" role="status">
          The Filewell database was damaged and has been reset. The damaged file was kept beside it.
        </div>
      )}
      <h1 className="view-title">Home</h1>
      <p className="view-lead">Nothing to show yet.</p>
    </section>
  );
}
