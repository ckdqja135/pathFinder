import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detailLookupUrl,
  detailLookupUrls,
  devEventSource,
  parseDevEventMarkdown,
  parseScheduleRange,
  splitMonthSections,
} from "@/lib/sources/scrapers/devevent";
import type { CollectContext } from "@/lib/sources/types";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

const markdown = fixture("devevent.md");

// 픽스처는 26년 09월 실제 항목들 + 합성 10월 섹션(연말 크로스 케이스)로 구성.
const NOW = new Date("2026-09-01T00:00:00Z");

describe("splitMonthSections", () => {
  it("월 섹션 헤더를 연/월로 파싱한다", () => {
    const sections = splitMonthSections(markdown);
    expect(sections.length).toBe(2);
    expect(sections[0]).toMatchObject({ year: 2026, month: 9 });
    expect(sections[1]).toMatchObject({ year: 2026, month: 10 });
  });
});

describe("parseScheduleRange", () => {
  it("시각이 있는 범위를 KST ISO로 변환한다", () => {
    const r = parseScheduleRange("09. 09(수) 18:30 ~ 09. 09(수) 21:30", 2026);
    expect(r).toEqual({
      startIso: "2026-09-09T18:30:00+09:00",
      endIso: "2026-09-09T21:30:00+09:00",
      allDay: false,
    });
  });

  it("날짜만 있으면 allDay로 표시한다 (시각을 만들지 않음)", () => {
    const r = parseScheduleRange("09. 19(토) ~ 09. 20(일)", 2026);
    expect(r?.allDay).toBe(true);
    expect(r?.startIso).toBe("2026-09-19T00:00:00+09:00");
    expect(r?.endIso).toBe("2026-09-20T00:00:00+09:00");
  });

  it("종료 월이 시작 월보다 작으면 해를 넘긴 것으로 본다", () => {
    const r = parseScheduleRange("12. 31(목) 23:00 ~ 01. 01(금) 01:00", 2026);
    expect(r?.startIso).toBe("2026-12-31T23:00:00+09:00");
    expect(r?.endIso).toBe("2027-01-01T01:00:00+09:00");
  });
});

describe("parseDevEventMarkdown (실제 README 스냅샷)", () => {
  const events = parseDevEventMarkdown(markdown, NOW);

  it("상세 정보가 없으면 일시가 명시된 항목만 수집한다 (접수 기간으로 추정 금지)", () => {
    // 픽스처: 일시 4건 + 접수만 9건 → 4건만
    expect(events.length).toBe(4);
    expect(events.every((e) => e.startDate.length > 0)).toBe(true);
    const titles = events.map((e) => e.title);
    expect(titles).toContain("AAIF Seoul Chapter Event");
    expect(titles).not.toContain(
      "AI WORLD 2026 : AI Shift – The New Economy", // 접수만 있는 항목
    );
  });

  it("분류 태그에서 장소/온라인/무료를 추출한다", () => {
    const aaif = events.find((e) => e.title === "AAIF Seoul Chapter Event")!;
    expect(aaif.location).toBe("서울 서초구");
    expect(aaif.isOnline).toBe(false);
    expect(aaif.fee).toBe(0); // `무료` 태그 명시
    expect(aaif.organizer).toBe("Agentic AI Foundation(AAIF)");
    expect(aaif.startDate).toBe("2026-09-09T18:30:00+09:00");
    expect(aaif.allDay).toBe(false);

    const online = events.find(
      (e) => e.title === "Tech Talk Talk - Server Developer",
    )!;
    expect(online.isOnline).toBe(true);
    expect(online.location).toBe("");
  });

  it("제목에 대괄호가 있어도 읽고, 하위 줄이 앞 항목을 덮어쓰지 않는다", () => {
    const md = [
      "## `26년 11월`",
      "- __[앞 행사](https://example.com/a)__",
      "  - 주최: 앞 주최",
      "  - 일시: 11. 03(화) 10:00 ~ 11. 03(화) 12:00",
      "- __[[KISA] DNS 운영 [고급] 실무](https://example.com/b)__",
      "  - 주최: 한국인터넷진흥원",
      "  - 일시: 11. 04(수) 09:30 ~ 11. 06(금) 17:30",
    ].join("\n");
    const events = parseDevEventMarkdown(md, NOW);
    expect(events.map((e) => [e.title, e.organizer])).toEqual([
      ["앞 행사", "앞 주최"],
      ["[KISA] DNS 운영 [고급] 실무", "한국인터넷진흥원"],
    ]);
  });

  it("60일보다 오래 지난 행사는 제외한다", () => {
    const future = new Date("2027-06-01T00:00:00Z");
    expect(parseDevEventMarkdown(markdown, future).length).toBe(0);
  });
});

describe("detailLookupUrl", () => {
  it("이벤터스·티켓타코 행사 상세는 신뢰 플랫폼으로 보고 쿼리를 뗀다", () => {
    expect(detailLookupUrl("https://event-us.kr/owasp/event/133675?utm_source=x")).toEqual({
      url: "https://event-us.kr/owasp/event/133675",
      trusted: true,
    });
    expect(detailLookupUrl("https://ticketa.co/event/zry4rrhh")?.trusted).toBe(true);
  });

  it("그 외 도메인은 쿼리를 유지하고 해시만 뗀다", () => {
    expect(detailLookupUrl("https://luma.com/sa692amj")).toEqual({
      url: "https://luma.com/sa692amj",
      trusted: false,
    });
    expect(
      detailLookupUrl("https://www.keit.re.kr/board.es?mid=a1&list_no=128385#top")?.url,
    ).toBe("https://www.keit.re.kr/board.es?mid=a1&list_no=128385");
    // 이벤터스라도 행사 상세 경로가 아니면 일반 도메인 취급 (robots가 판단)
    expect(detailLookupUrl("https://event-us.kr/search?q=x")?.trusted).toBe(false);
  });

  it("https가 아니거나 내부 주소면 조회하지 않는다", () => {
    expect(detailLookupUrl("http://example.com/event")).toBeNull();
    expect(detailLookupUrl("https://127.0.0.1/admin")).toBeNull();
    expect(detailLookupUrl("https://localhost/x")).toBeNull();
    expect(detailLookupUrl("https://[::1]/x")).toBeNull();
    expect(detailLookupUrl("not a url")).toBeNull();
  });
});

describe("detailLookupUrls", () => {
  it("일시가 없는 항목(도메인 무관)과 이벤터스·티켓타코 항목을 README 순서로 뽑는다", () => {
    expect(detailLookupUrls(markdown, NOW)).toEqual([
      "https://keystonellc.kr/sap/2026/0909_SAP_Connect_Day_for_Busan/0909_SAP_Connect_Day_for_Busan_eDM.html",
      "https://event-us.kr/itsman/event/132376",
      "https://event-us.kr/talkit/event/134235",
      "https://event-us.kr/mdsit/event/131386",
      "https://www.ai-world.kr/",
      "https://ticketa.co/event/796zfanx",
      "https://tech.channel.io/kr/articles/ai-product-frontiers-fba8c7be",
      "https://event-us.kr/ConventionSOOP/event/132554",
      "https://event-us.kr/2026bcmd/event/129785",
    ]);
  });

  it("일시가 있는 항목은 신뢰 플랫폼일 때만 조회한다", () => {
    const md = [
      "## `26년 11월`",
      "- __[루마 모임](https://luma.com/abc)__",
      "  - 일시: 11. 03(화) 19:00 ~ 11. 03(화) 21:00",
      "- __[티켓타코 행사](https://ticketa.co/event/xyz)__",
      "  - 일시: 11. 04(수) 10:00 ~ 11. 04(수) 18:00",
    ].join("\n");
    expect(detailLookupUrls(md, NOW)).toEqual(["https://ticketa.co/event/xyz"]);
  });

  it("기준일이 지난 60일 밖이면 조회하지 않는다", () => {
    expect(detailLookupUrls(markdown, new Date("2027-06-01T00:00:00Z"))).toEqual([]);
  });
});

describe("상세 페이지 JSON-LD 보강", () => {
  const OWASP_MD = [
    "## `26년 11월`",
    "- __[OWASP Korea Day](https://event-us.kr/owasp/event/133675)__",
    "  - 분류: `오프라인(서울 강남구)`, `유료`, `세미나`, `기술일반`",
    "  - 주최: OWASP Seoul Chapter",
    "  - 접수: 09. 14(월) ~ 11. 27(금) 23:30",
    "- __[.NET Conf 2026 @Seoul](https://ticketa.co/event/zry4rrhh)__",
    "  - 분류: `오프라인(서울 종로구)`, `무료`, `세미나`, `기술일반`",
    "  - 주최: Korea .NET User Group",
    "  - 일시: 09. 10(목) 14:00 ~ 11. 26(목) 15:00",
  ].join("\n");
  const now = new Date("2026-10-29T00:00:00Z");

  it("접수만 있는 항목도 상세 개최 일시가 있으면 수집하고, 접수 기간은 유지한다", () => {
    const details = new Map([
      [
        "https://event-us.kr/owasp/event/133675",
        {
          startIso: "2026-11-28T10:00:00+09:00",
          endIso: "2026-11-28T18:00:00+09:00",
          allDay: false,
        },
      ],
    ]);
    const owasp = parseDevEventMarkdown(OWASP_MD, now, details).find(
      (e) => e.title === "OWASP Korea Day",
    )!;
    expect(owasp.startDate).toBe("2026-11-28T10:00:00+09:00");
    expect(owasp.endDate).toBe("2026-11-28T18:00:00+09:00");
    expect(owasp.registrationEnd).toBe("2026-11-27T23:30:00+09:00");
    expect(owasp.location).toBe("서울 강남구");
  });

  it("상세 일시가 README 일시보다 우선한다", () => {
    const details = new Map([
      [
        "https://ticketa.co/event/zry4rrhh",
        {
          startIso: "2026-11-26T10:00:00+09:00",
          endIso: "2026-11-26T18:00:00+09:00",
          allDay: false,
        },
      ],
    ]);
    const events = parseDevEventMarkdown(OWASP_MD, now, details);
    // OWASP는 상세 정보가 없고 README에 접수만 있으므로 제외
    expect(events.map((e) => e.title)).toEqual([".NET Conf 2026 @Seoul"]);
    expect(events[0].startDate).toBe("2026-11-26T10:00:00+09:00");
    expect(events[0].endDate).toBe("2026-11-26T18:00:00+09:00");
  });
});

describe("공모전·해커톤 접수 마감 기준 표시", () => {
  // 2026-11-02 README 실제 항목 형식
  const CONTEST_MD = [
    "## `26년 11월`",
    "- __[항만 문제해결을 위한 AI 기술 공모전](https://dacon.io/competitions/official/236771/overview/description)__",
    "  - 분류: `온라인`, `무료`, `대회`, `AI`",
    "  - 주최: 데이콘",
    "  - 접수: 09. 30(수) ~ 11. 02(월) 10:00",
    "- __[OBA.RUN 2nd 해커톤](https://luma.com/ahvyoors)__",
    "  - 분류: `오프라인(서울 강남구)`, `무료`, `대회`, `AI`",
    "  - 주최: OBA",
    "  - 접수: 10. 30(금) ~ 11. 04(수)",
    "- __[[SK텔레콤] FLY AI Challenger 10기 모집](https://www.skttechacademy.com/notice/15)__",
    "  - 분류: `오프라인(서울)`, `무료`, `교육`, `AI`",
    "  - 주최: SK텔레콤",
    "  - 접수: 10. 14(수) ~ 11. 08(일)",
    "- __[접수 기간 없는 대회](https://example.com/no-reg)__",
    "  - 분류: `온라인`, `무료`, `대회`",
  ].join("\n");
  const now = new Date("2026-11-02T00:00:00Z");

  it("개최일이 없는 `대회` 항목은 접수 마감일에 공모전으로 올린다", () => {
    const dacon = parseDevEventMarkdown(CONTEST_MD, now).find((e) =>
      e.title.startsWith("항만"),
    )!;
    expect(dacon.type).toBe("CONTEST");
    expect(dacon.startDate).toBe("2026-11-02T10:00:00+09:00");
    expect(dacon.endDate).toBe(dacon.startDate);
    // 모달의 "접수 마감" 표기 조건(시작 = registrationEnd)
    expect(dacon.registrationEnd).toBe(dacon.startDate);
    expect(dacon.allDay).toBe(true);
  });

  it("상세 페이지에서 개최 일시를 찾으면 접수 마감 대신 그것을 쓴다", () => {
    const details = new Map([
      [
        "https://luma.com/ahvyoors",
        {
          startIso: "2026-11-07T09:30:00+09:00",
          endIso: "2026-11-07T21:00:00+09:00",
          allDay: false,
        },
      ],
    ]);
    const oba = parseDevEventMarkdown(CONTEST_MD, now, details).find((e) =>
      e.title.startsWith("OBA"),
    )!;
    expect(oba.startDate).toBe("2026-11-07T09:30:00+09:00");
    expect(oba.registrationEnd).not.toBe(oba.startDate);
  });

  it("`대회`가 아닌 접수-only 항목과 접수 기간 없는 대회는 제외한다", () => {
    const titles = parseDevEventMarkdown(CONTEST_MD, now).map((e) => e.title);
    expect(titles).not.toContain("[SK텔레콤] FLY AI Challenger 10기 모집");
    expect(titles).not.toContain("접수 기간 없는 대회");
  });
});

describe("devEventSource.collect (고정 샘플 + 상세 페이지 발췌)", () => {
  const pages: Record<string, string> = {
    "https://raw.githubusercontent.com/brave-people/Dev-Event/master/README.md":
      markdown,
    "https://event-us.kr/itsman/event/132376": fixture("eventus-detail-online.html"),
    "https://event-us.kr/2026bcmd/event/129785": fixture("eventus-detail-offline.html"),
    "https://ticketa.co/event/796zfanx": fixture("ticketa-detail.html"),
    // 합성: 자체 행사 사이트가 JSON-LD를 갖춘 경우
    "https://www.ai-world.kr/": `<script type="application/ld+json">${JSON.stringify({
      "@type": "Event",
      startDate: "2026-09-10T09:00:00+09:00",
      endDate: "2026-09-10T18:00:00+09:00",
    })}</script>`,
    // robots가 막는 페이지 — 조회되면 안 된다
    "https://tech.channel.io/kr/articles/ai-product-frontiers-fba8c7be": `<script type="application/ld+json">${JSON.stringify({
      "@type": "Event",
      startDate: "2026-09-11T19:00:00+09:00",
    })}</script>`,
  };
  function makeCtx() {
    const fetched: string[] = [];
    const robotsChecked: string[] = [];
    // ctx.cached의 계약: 성공한 결과만 저장, throw는 저장하지 않음
    const store = new Map<string, unknown>();
    const ctx: CollectContext = {
      now: NOW,
      // 나머지 상세 페이지는 조회 실패로 처리된다
      fetchDoc: async (url) => {
        fetched.push(url);
        if (!(url in pages)) throw new Error(`HTTP 404 for ${url}`);
        return { body: pages[url] };
      },
      robotsAllows: async (url) => {
        robotsChecked.push(url);
        return !url.startsWith("https://tech.channel.io/");
      },
      cached: async <T,>(key: string, compute: () => Promise<T>) => {
        if (store.has(key)) return store.get(key) as T;
        const value = await compute();
        store.set(key, value);
        return value;
      },
    };
    return { ctx, fetched, robotsChecked, store };
  }
  const { ctx, fetched } = makeCtx();

  it("상세 조회에 성공한 접수-only 항목을 추가하고, 실패·robots 차단 항목은 제외한다", async () => {
    const events = await devEventSource.collect(ctx);
    // 일시 4건 + 상세 성공 4건(이벤터스 2·티켓타코 1·자체 사이트 1)
    expect(events.length).toBe(8);
    expect(events.find((e) => e.title === "AI WORLD 2026 : AI Shift – The New Economy")!.startDate).toBe(
      "2026-09-10T09:00:00+09:00",
    );
    expect(fetched).not.toContain(
      "https://tech.channel.io/kr/articles/ai-product-frontiers-fba8c7be",
    );
    expect(events.some((e) => e.title.startsWith("AI Product Frontiers"))).toBe(false);

    const ghost = events.find((e) => e.link === "https://event-us.kr/itsman/event/132376")!;
    expect(ghost.startDate).toBe("2026-09-09T14:00:00+09:00");
    expect(ghost.endDate).toBe("2026-09-09T15:00:00+09:00");
    expect(ghost.allDay).toBe(false);
    expect(ghost.isOnline).toBe(true);
    expect(ghost.registrationStart).toBe("2026-08-24T00:00:00+09:00");

    const modernWork = events.find((e) => e.title === "Modern Work Conference Seoul 2026")!;
    expect(modernWork.startDate).toBe("2026-09-17T09:00:00+09:00");

    expect(events.some((e) => e.link === "https://event-us.kr/talkit/event/134235")).toBe(
      false,
    );
  });

  it("상세는 원문 대신 결과만 캐시해, 다음 수집에서는 실패한 조회만 다시 받는다", async () => {
    const run = makeCtx();
    const first = await devEventSource.collect(run.ctx);
    // 캐시에는 일정(또는 null)만 — 원문 HTML이 들어가지 않는다
    expect(run.store.get("detail:https://event-us.kr/itsman/event/132376")).toEqual({
      startIso: "2026-09-09T14:00:00+09:00",
      endIso: "2026-09-09T15:00:00+09:00",
      allDay: false,
    });
    // robots 차단은 null로 캐시, 404 실패는 캐시하지 않음
    expect(
      run.store.get("detail:https://tech.channel.io/kr/articles/ai-product-frontiers-fba8c7be"),
    ).toBeNull();
    expect(run.store.has("detail:https://event-us.kr/talkit/event/134235")).toBe(false);

    run.fetched.length = 0;
    run.robotsChecked.length = 0;
    const second = await devEventSource.collect(run.ctx);
    expect(second.map((e) => e.externalId)).toEqual(first.map((e) => e.externalId));
    expect(run.fetched).not.toContain("https://event-us.kr/itsman/event/132376");
    expect(run.fetched).toContain("https://event-us.kr/talkit/event/134235");
    expect(run.robotsChecked).not.toContain(
      "https://tech.channel.io/kr/articles/ai-product-frontiers-fba8c7be",
    );
  });
});
