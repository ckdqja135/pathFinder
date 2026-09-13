import { NextResponse } from "next/server";
import { getEventsPayload } from "@/lib/events-data";
import {
  ALL_CATEGORIES,
  ALL_TYPES,
  type Category,
  type EventType,
} from "@/lib/types";

// 응답 자체는 매번 조립하되(필터가 쿼리스트링에 의존), 외부 수집은
// lib/sources의 fetch Data Cache(출처별 1시간)를 공유한다.
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

  const payload = await getEventsPayload({
    categories: parseList<Category>(
      searchParams.get("category"),
      ALL_CATEGORIES,
    ),
    types: parseList<EventType>(searchParams.get("type"), ALL_TYPES),
    query: searchParams.get("q") ?? undefined,
  });

  return NextResponse.json(payload);
}
