/**
 * Small in-process TTL cache for the real-time tax API. A checkout recalculates
 * tax several times (address, shipping, fee, payment, complete) with the same
 * address and products, and each lookup is a database round trip; keeping the
 * slow-changing answers for a few minutes makes repeat quotes free.
 *
 * Only the tax API uses this - admin pages and returns always read fresh.
 * Edits made in Quantum (a product's cost or mL, a state's rate) reach checkout
 * within the TTL of the entry that holds them.
 */
type Entry = { at: number; value: Promise<unknown> };

const store = ((globalThis as unknown as { __taxMemo?: Map<string, Entry> }).__taxMemo ??= new Map());
const MAX_ENTRIES = 5000;

export async function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as Promise<T>;
  // Store the promise, so concurrent callers share one database query.
  const value = load();
  store.set(key, { at: now, value });
  if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value!);
  // A failure is not cached: the next call tries again.
  value.catch(() => store.get(key)?.value === value && store.delete(key));
  return value;
}

/** Load key now and replace the cached entry once the load succeeds. */
export function refresh<T>(key: string, load: () => Promise<T>): Promise<T> {
  const value = load();
  value.then(() => store.set(key, { at: Date.now(), value }), () => {});
  return value;
}

export const MINUTE = 60_000;
