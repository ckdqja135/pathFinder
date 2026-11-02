import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildKintexEvent,
  kintexListUrl,
  kintexSource,
  kintexViewUrl,
  parseKintexDetail,
  parseKintexList,
} from "@/lib/sources/scrapers/kintex";
import type { CollectContext } from "@/lib/sources/types";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

const NOW = new Date("2026-10-29T00:00:00Z");
const listHtml = fixture("kintex-list.html");

describe("kintexListUrl", () => {
  it("전시·회의만, KST 기준 지난 60일 ~ 향후 183일을 요청한다", () => {
    const url = new URL(kintexListUrl(1, NOW));
    expect(url.searchParams.get("searchType")).toBe("11,23,");
    expect(url.searchParams.get("searchStartDt")).toBe("2026-08-30");
    expect(url.searchParams.get("searchEndDt")).toBe("2027-04-30");
    expect(url.searchParams.get("pageUnit")).toBe("100");
  });
});

describe("parseKintexList (실제 목록 발췌)", () => {
  const rows = parseKintexList(listHtml);

  it("카드에서 분류·행사명·전시홀·기간을 읽는다", () => {
    expect(rows.length).toBe(6);
    expect(rows[0]).toEqual({
      seq: "26042905",
      label: "전시회",
      title: "2026 국제 공구 및 스마트 용접 자동화전",
      halls: "전시홀 2A, 전시홀 2B-1",
      startIso: "2026-10-27T00:00:00+09:00",
      endIso: "2026-10-30T00:00:00+09:00",
    });
  });

  it("제목의 &middot; 엔티티를 풀고, 회의 분류도 읽는다", () => {
    expect(rows.map((r) => r.title)).toContain("2026 드론·도심항공모빌리티 박람회");
    const meeting = rows.find((r) => r.seq === "26102009")!;
    expect(meeting.label).toBe("회의");
  });
});

describe("parseKintexDetail (실제 상세 발췌)", () => {
  it("주최·입장료·홈페이지·품목을 읽고, 주석 처리된 블록은 무시한다", () => {
    const d = parseKintexDetail(fixture("kintex-detail.html"));
    expect(d.organizer).toBe("고양특례시");
    expect(d.admission).toBe("사전등록 시 무료 / 현장등록 시 12,000원");
    expect(d.homepage).toBe("https://www.k-dmts.com/ko");
    expect(d.items).toContain("XR·메타버스 및 실감형 기술");
    expect(d.admission).not.toContain("목금토"); // <!-- 기 타 --> 블록
  });

  it("'.' 같은 자리표시 품목은 비우고, 입장료 0은 그대로 둔다", () => {
    const d = parseKintexDetail(fixture("kintex-detail-meeting.html"));
    expect(d.organizer).toBe("자유와혁신 중앙당 선거관리위원회");
    expect(d.items).toBe("");
    expect(d.admission).toBe("0");
  });
});

describe("buildKintexEvent", () => {
  const rows = parseKintexList(listHtml);
  const dmts = rows.find((r) => r.seq === "26030311")!;

  it("전시회는 전시/박람회, 종일, 킨텍스 전시홀 위치로 만든다", () => {
    const ev = buildKintexEvent(dmts, parseKintexDetail(fixture("kintex-detail.html")))!;
    expect(ev.type).toBe("EXHIBITION");
    expect(ev.allDay).toBe(true);
    expect(ev.startDate).toBe("2026-11-04T00:00:00+09:00");
    expect(ev.endDate).toBe("2026-11-06T00:00:00+09:00");
    expect(ev.location).toBe("킨텍스 전시홀 2");
    expect(ev.organizer).toBe("고양특례시");
    // 링크는 행사별 고유한 킨텍스 상세, 홈페이지는 설명에
    expect(ev.link).toBe(kintexViewUrl("26030311"));
    expect(ev.description).toContain("홈페이지: https://www.k-dmts.com/ko");
    expect(ev.fee).toBeNull(); // 조건부 무료는 무료로 단정하지 않음
    expect(ev.category).toBe("IT"); // 행사명의 "테크"
  });

  it("분야는 행사명만으로 분류한다 (품목 문장의 키워드로 오분류하지 않음)", () => {
    const babyExpo = rows.find((r) => r.seq === "26091701")!;
    const ev = buildKintexEvent(babyExpo, {
      organizer: "",
      admission: "",
      items: "유아 인테리어 디자인 소품, 태아보험",
      purpose: "",
    })!;
    expect(ev.category).toBe("BUSINESS");
  });

  it("주최사 홈페이지가 같아도 행사마다 링크가 달라 중복 처리로 합쳐지지 않는다", () => {
    const shared = {
      organizer: "메가쇼",
      admission: "",
      homepage: "http://www.megashow.co.kr",
      items: "",
      purpose: "",
    };
    const a = buildKintexEvent(rows[0], shared)!;
    const b = buildKintexEvent(rows[1], shared)!;
    expect(a.link).not.toBe(b.link);
  });

  it("회의는 컨퍼런스, 입장료 0은 무료로 본다", () => {
    const meeting = rows.find((r) => r.seq === "26102009")!;
    const ev = buildKintexEvent(
      meeting,
      parseKintexDetail(fixture("kintex-detail-meeting.html")),
    )!;
    expect(ev.type).toBe("CONFERENCE");
    expect(ev.fee).toBe(0);
  });

  it("상세가 없으면 목록 정보만으로 만들고 킨텍스 상세로 링크한다", () => {
    const ev = buildKintexEvent(dmts)!;
    expect(ev.organizer).toBe("");
    expect(ev.fee).toBeNull();
    expect(ev.link).toBe(kintexViewUrl("26030311"));
  });

  it("채용·취업 박람회는 채용박람회로, 문화행사는 제외한다", () => {
    expect(buildKintexEvent({ ...dmts, title: "2026 고양시 일자리 박람회" })!.type).toBe(
      "JOB_FAIR",
    );
    expect(
      buildKintexEvent({ ...dmts, title: "2026 경기도교육청 직업계고 취창업박람회" })!.type,
    ).toBe("JOB_FAIR");
    expect(buildKintexEvent({ ...dmts, label: "문화행사" })).toBeNull();
  });
});

describe("kintexSource.collect", () => {
  const details: Record<string, string> = {
    [kintexViewUrl("26030311")]: fixture("kintex-detail.html"),
    [kintexViewUrl("26102009")]: fixture("kintex-detail-meeting.html"),
  };

  it("상세 조회 일부가 실패해도 목록 기준으로 전부 수집한다", async () => {
    const ctx: CollectContext = {
      now: NOW,
      robotsAllows: async () => true,
      fetchDoc: async (url) => {
        if (url.includes("/list.do")) return { body: listHtml };
        if (url in details) return { body: details[url] };
        throw new Error(`HTTP 500 for ${url}`);
      },
    };
    const events = await kintexSource.collect(ctx);
    expect(events.length).toBe(6);
    expect(events.filter((e) => e.type === "EXHIBITION").length).toBe(5);
    expect(events.find((e) => e.externalId === "kintex-26030311")!.organizer).toBe(
      "고양특례시",
    );
  });

  it("목록이 0건으로 파싱되면 빈 결과 대신 실패로 보고한다", async () => {
    const ctx: CollectContext = {
      now: NOW,
      robotsAllows: async () => true,
      fetchDoc: async () => ({ body: "<html><body>개편된 페이지</body></html>" }),
    };
    await expect(kintexSource.collect(ctx)).rejects.toThrow(/0 rows/);
  });
});
