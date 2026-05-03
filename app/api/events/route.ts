import { NextResponse } from "next/server";
import { getAllEvents } from "@/lib/events-data";
import {
  ALL_CATEGORIES,
  ALL_TYPES,
  type Category,
  type EventType,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function parseList<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as T[];
  const filtered = parts.filter((p) => allowed.includes(p));
  return filtered.length ? filtered : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const events = await getAllEvents({
    categories: parseList<Category>(
      searchParams.get("category"),
      ALL_CATEGORIES,
    ),
    types: parseList<EventType>(searchParams.get("type"), ALL_TYPES),
    query: searchParams.get("q") ?? undefined,
  });

  return NextResponse.json({ events, total: events.length });
}
