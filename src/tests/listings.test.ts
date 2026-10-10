import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DirListing } from "../types";

const pending: Array<{ path: string; resolve: (l: DirListing) => void; reject: (e: unknown) => void }> = [];

vi.mock("../lib/ipc", () => ({
  ipc: {
    listDir: (path: string) => new Promise<DirListing>((resolve, reject) => pending.push({ path, resolve, reject })),
  },
  toFilewellError: (raw: unknown) => raw,
}));

const { useListings } = await import("../store/listings");

const listing = (path: string): DirListing => ({ path, entries: [], total: 0, truncated: false, skipped: 0 });
const sort = { key: "name", dir: "asc" } as const;

describe("listings store", () => {
  beforeEach(() => { pending.length = 0; useListings.setState({ byTab: {} }); });

  it("keeps only the newest answer when two loads race", async () => {
    const first = useListings.getState().load("t", "C:\\A", false, sort);
    const second = useListings.getState().load("t", "C:\\B", false, sort);
    pending[1].resolve(listing("C:\\B"));
    await second;
    pending[0].resolve(listing("C:\\A"));
    await first;
    const state = useListings.getState().byTab.t;
    expect(state.status).toBe("ready");
    expect(state.listing?.path).toBe("C:\\B");
  });

  it("reports an error as a typed value", async () => {
    const load = useListings.getState().load("t", "C:\\gone", false, sort);
    pending[0].reject({ code: "notFound", message: "missing", path: "C:\\gone" });
    await load;
    const state = useListings.getState().byTab.t;
    expect(state.status).toBe("error");
    expect(state.error?.code).toBe("notFound");
  });

  it("keeps showing the old rows while the same folder reloads", async () => {
    const first = useListings.getState().load("t", "C:\\A", false, sort);
    pending[0].resolve(listing("C:\\A"));
    await first;
    void useListings.getState().load("t", "C:\\A", false, sort);
    const state = useListings.getState().byTab.t;
    expect(state.status).toBe("loading");
    expect(state.listing?.path).toBe("C:\\A");
  });
});
