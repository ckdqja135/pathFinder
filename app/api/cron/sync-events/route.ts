import { NextResponse } from "next/server";
import { isDbConfigured, prisma } from "@/lib/db";
import { collectFromAllSources } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when
  // CRON_SECRET is configured as an env var. Manual triggers must include the
  // same header.
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : null;

  if (expected && auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDbConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error: "DATABASE_URL is not set — skip sync.",
      },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  const { collected, perSource } = await collectFromAllSources();

  let upserted = 0;
  const failures: Array<{ externalId: string; error: string }> = [];

  for (const item of collected) {
    try {
      await prisma.event.upsert({
        where: {
          source_externalId: {
            source: item.source,
            externalId: item.externalId,
          },
        },
        create: {
          title: item.title,
          category: item.category,
          type: item.type,
          startDate: new Date(item.startDate),
          endDate: new Date(item.endDate),
          registrationStart: item.registrationStart
            ? new Date(item.registrationStart)
            : null,
          registrationEnd: item.registrationEnd
            ? new Date(item.registrationEnd)
            : null,
          organizer: item.organizer,
          location: item.location,
          isOnline: item.isOnline,
          fee: item.fee,
          link: item.link,
          description: item.description,
          source: item.source,
          externalId: item.externalId,
        },
        update: {
          title: item.title,
          category: item.category,
          type: item.type,
          startDate: new Date(item.startDate),
          endDate: new Date(item.endDate),
          registrationStart: item.registrationStart
            ? new Date(item.registrationStart)
            : null,
          registrationEnd: item.registrationEnd
            ? new Date(item.registrationEnd)
            : null,
          organizer: item.organizer,
          location: item.location,
          isOnline: item.isOnline,
          fee: item.fee,
          link: item.link,
          description: item.description,
        },
      });
      upserted++;
    } catch (err) {
      failures.push({
        externalId: item.externalId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    upserted,
    failures,
    perSource,
  });
}
