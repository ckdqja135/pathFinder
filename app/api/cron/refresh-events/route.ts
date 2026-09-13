import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { collectFromAllSources } from "@/lib/sources";
import { SOURCES } from "@/lib/sources/registry";
import { sourceCacheTag } from "@/lib/sources/util/fetch";

// 예약 실행(Vercel Cron)용 갱신 라우트.
//
// 기본 조회는 이 Cron 없이도 동작한다: 사용자 요청이 출처별 fetch 캐시(1시간,
// stale-while-revalidate)를 채우고 갱신한다. 이 라우트는 트래픽이 없는 시간대에
// 캐시를 미리 데워 두는 용도다(예: 새벽 배포 직후 첫 방문 지연 방지).
//
// revalidateTag(tag, "max"): 출처 캐시를 즉시 stale로 표시한다. 바로 뒤의
// collectFromAllSources()가 그 캐시를 방문하면서 백그라운드 재수집을 트리거하고,
// 재수집이 실패하면 이전 성공 결과가 유지된다(단일 인자 형태는 Next 16에서 deprecated).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Vercel Cron은 CRON_SECRET 설정 시 `Authorization: Bearer <secret>`을 보낸다.
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : null;
  if (expected && auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  for (const source of SOURCES) {
    revalidateTag(sourceCacheTag(source.id), "max");
  }

  const { events, sources } = await collectFromAllSources();

  return NextResponse.json({
    ok: sources.some((s) => s.ok),
    refreshedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    totalEvents: events.length,
    sources,
  });
}
