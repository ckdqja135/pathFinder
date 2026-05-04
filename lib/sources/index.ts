import { conferencesSource } from "./conferences";
import { seedSource } from "./seed";
import type { CollectedEvent, EventSource } from "./types";

const SOURCES: EventSource[] = [seedSource, conferencesSource];

export interface CollectionResult {
  collected: CollectedEvent[];
  perSource: Array<{
    name: string;
    count: number;
    error?: string;
  }>;
}

export async function collectFromAllSources(): Promise<CollectionResult> {
  const collected: CollectedEvent[] = [];
  const perSource: CollectionResult["perSource"] = [];

  for (const source of SOURCES) {
    try {
      const items = await source.collect();
      collected.push(...items);
      perSource.push({ name: source.name, count: items.length });
    } catch (err) {
      perSource.push({
        name: source.name,
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { collected, perSource };
}
