// Watch and unwatch are async commands; issued back to back they could run out
// of order on the backend. One chain per tab keeps them in issue order.
const chains = new Map<string, Promise<void>>();

export function queueWatch(tabId: string, work: () => Promise<unknown>): Promise<void> {
  const previous = chains.get(tabId) ?? Promise.resolve();
  const next = previous.then(async () => {
    try {
      await work();
    } catch (error) {
      console.warn("Filewell could not update the folder watch", error);
    }
  });
  chains.set(tabId, next);
  return next;
}
