/**
 * Stand-in for the 'astro:content' virtual module (aliased in vitest.config.ts).
 *
 * Tests seed collections with __setCollection(); getCollection honours the same
 * (name, filter) signature the real module has, so code under test (e.g. getPosts's
 * draft filter) runs unmodified.
 */
type Entry = { id: string; body?: string; data: Record<string, unknown> };

const store = new Map<string, Entry[]>();

export function __setCollection(name: string, entries: Entry[]): void {
  store.set(name, entries);
}

export function __reset(): void {
  store.clear();
}

export async function getCollection(
  name: string,
  filter?: (entry: Entry) => boolean,
): Promise<Entry[]> {
  const entries = store.get(name) ?? [];
  return filter ? entries.filter(filter) : [...entries];
}

export async function getEntry(name: string, id: string): Promise<Entry | undefined> {
  return (store.get(name) ?? []).find((e) => e.id === id);
}
