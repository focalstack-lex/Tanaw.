import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Drive, KnownFolder } from "../types";

const drivesCalls: Array<{ resolve: (d: Drive[]) => void; reject: (e: unknown) => void }> = [];
let driveCount = 0;
let folderCount = 0;

vi.mock("../lib/ipc", () => ({
  ipc: {
    listDrives: () => {
      driveCount += 1;
      return new Promise<Drive[]>((resolve, reject) => drivesCalls.push({ resolve, reject }));
    },
    knownFolders: () => {
      folderCount += 1;
      return Promise.resolve([] as KnownFolder[]);
    },
  },
  toFilewellError: (raw: unknown) => ({ code: "io", message: String(raw) }),
}));

const { usePlaces } = await import("../store/places");
const { useUi } = await import("../store/ui");

const drive = (mountPoint: string): Drive => ({ mountPoint, label: mountPoint, totalBytes: 10, availableBytes: 5, kind: "fixed" });
const settle = () => new Promise((done) => setTimeout(done, 0));

describe("places store", () => {
  beforeEach(() => {
    drivesCalls.length = 0;
    driveCount = 0;
    folderCount = 0;
    usePlaces.setState({ drives: [], folders: [], loaded: false });
    useUi.setState({ toasts: [] });
  });

  it("replaces drives on a second load", async () => {
    const first = usePlaces.getState().load();
    drivesCalls[0].resolve([drive("C:\\\\")]);
    await first;
    const second = usePlaces.getState().load();
    drivesCalls[1].resolve([drive("C:\\\\"), drive("D:\\\\")]);
    await second;
    expect(usePlaces.getState().drives).toHaveLength(2);
  });

  it("keeps the first drives and stays quiet when a refresh fails", async () => {
    const first = usePlaces.getState().load();
    drivesCalls[0].resolve([drive("C:\\\\")]);
    await first;
    const second = usePlaces.getState().load();
    drivesCalls[1].reject(new Error("boom"));
    await second;
    expect(usePlaces.getState().drives).toHaveLength(1);
    expect(useUi.getState().toasts).toHaveLength(0);
  });

  it("toasts when the very first load fails", async () => {
    const first = usePlaces.getState().load();
    drivesCalls[0].reject(new Error("boom"));
    await first;
    expect(useUi.getState().toasts).toHaveLength(1);
  });

  it("shares one in-flight load between concurrent calls", async () => {
    const a = usePlaces.getState().load();
    const b = usePlaces.getState().load();
    await settle();
    expect(driveCount).toBe(1);
    expect(folderCount).toBe(1);
    drivesCalls[0].resolve([]);
    await Promise.all([a, b]);
  });
});
