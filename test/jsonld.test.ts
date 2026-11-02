import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractJsonLdSchedule } from "@/lib/sources/util/jsonld";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

function ld(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

describe("extractJsonLdSchedule (실제 상세 페이지 발췌)", () => {
  it("이벤터스 BusinessEvent(온라인) — Organization 블록은 건너뛴다", () => {
    expect(extractJsonLdSchedule(fixture("eventus-detail-online.html"))).toEqual({
      startIso: "2026-09-09T14:00:00+09:00",
      endIso: "2026-09-09T15:00:00+09:00",
      allDay: false,
    });
  });

  it("이벤터스 SocialEvent(오프라인)", () => {
    expect(extractJsonLdSchedule(fixture("eventus-detail-offline.html"))).toEqual({
      startIso: "2026-09-13T10:00:00+09:00",
      endIso: "2026-09-13T18:00:00+09:00",
      allDay: false,
    });
  });

  it("티켓타코 Event", () => {
    expect(extractJsonLdSchedule(fixture("ticketa-detail.html"))).toEqual({
      startIso: "2026-09-17T09:00:00+09:00",
      endIso: "2026-09-17T17:00:00+09:00",
      allDay: false,
    });
  });
});

describe("extractJsonLdSchedule 경계", () => {
  it("Event 블록이 없으면 null", () => {
    expect(extractJsonLdSchedule(ld({ "@type": "Organization", name: "x" }))).toBeNull();
    expect(extractJsonLdSchedule("<html></html>")).toBeNull();
  });

  it("깨진 JSON 블록은 건너뛰고 다음 블록을 읽는다", () => {
    const html =
      '<script type="application/ld+json">{broken</script>' +
      ld({ "@type": "Event", startDate: "2026-11-28T10:00:00+09:00" });
    expect(extractJsonLdSchedule(html)?.startIso).toBe("2026-11-28T10:00:00+09:00");
  });

  it("날짜만 있으면 allDay (시각을 만들지 않음)", () => {
    const r = extractJsonLdSchedule(
      ld({ "@type": "Event", startDate: "2026-11-14", endDate: "2026-11-15" }),
    );
    expect(r).toEqual({
      startIso: "2026-11-14T00:00:00+09:00",
      endIso: "2026-11-15T00:00:00+09:00",
      allDay: true,
    });
  });

  it("UTC 오프셋은 KST로 변환하고, 오프셋이 없으면 KST로 본다", () => {
    expect(
      extractJsonLdSchedule(ld({ "@type": "Event", startDate: "2026-11-28T01:00:00Z" }))
        ?.startIso,
    ).toBe("2026-11-28T10:00:00+09:00");
    expect(
      extractJsonLdSchedule(ld({ "@type": "Event", startDate: "2026-11-28T10:00:00" }))
        ?.startIso,
    ).toBe("2026-11-28T10:00:00+09:00");
  });

  it("endDate가 없거나 시작보다 앞서면 시작 시각으로 둔다", () => {
    expect(
      extractJsonLdSchedule(ld({ "@type": "Event", startDate: "2026-11-28T10:00:00+09:00" }))
        ?.endIso,
    ).toBe("2026-11-28T10:00:00+09:00");
    expect(
      extractJsonLdSchedule(
        ld({
          "@type": "Event",
          startDate: "2026-11-28T10:00:00+09:00",
          endDate: "2026-11-27T10:00:00+09:00",
        }),
      )?.endIso,
    ).toBe("2026-11-28T10:00:00+09:00");
  });

  it("@graph 안의 Event와 배열 @type도 찾는다", () => {
    const html = ld({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage" },
        { "@type": ["Event", "Thing"], startDate: "2026-12-01T09:00:00+09:00" },
      ],
    });
    expect(extractJsonLdSchedule(html)?.startIso).toBe("2026-12-01T09:00:00+09:00");
  });
});
