import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildWevityEvent,
  mapWevityFields,
  parseWevityDetail,
  parseWevityList,
} from "@/lib/sources/scrapers/wevity";

const listHtml = readFileSync(
  join(__dirname, "fixtures", "wevity-list.html"),
  "utf-8",
);
const detailHtml = readFileSync(
  join(__dirname, "fixtures", "wevity-detail.html"),
  "utf-8",
);

// 고정 기준 시각: 2026-09-13 03:00 UTC = 2026-09-13 12:00 KST
const NOW = new Date("2026-09-13T03:00:00Z");

describe("parseWevityList (실제 페이지 스냅샷)", () => {
  it("접수중 행만 추출하고 필수 필드를 채운다", () => {
    const rows = parseWevityList(listHtml);
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) {
      expect(row.ix).toMatch(/^\d+$/);
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.title).not.toMatch(/SPECIAL|NEW|HOT/);
      expect(Number.isFinite(row.daysLeft)).toBe(true);
    }
  });

  it("같은 ix 중복(배너+본문)을 한 번만 담는다", () => {
    const rows = parseWevityList(listHtml);
    const ids = rows.map((r) => r.ix);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("parseWevityDetail (실제 상세 스냅샷)", () => {
  it("접수기간과 주최/주관을 추출한다", () => {
    const detail = parseWevityDetail(detailHtml);
    expect(detail.registrationStart).toBe("2026-07-31");
    expect(detail.registrationEnd).toBe("2026-10-17");
    expect(detail.organizer).toBe("하남시청소년수련관");
  });

  it("필드가 없으면 생략한다 (빈 성공으로 위장하지 않음)", () => {
    const detail = parseWevityDetail("<html><body>none</body></html>");
    expect(detail.registrationStart).toBeUndefined();
    expect(detail.organizer).toBeUndefined();
  });
});

describe("buildWevityEvent 날짜 처리", () => {
  const row = {
    ix: "12345",
    title: "테스트 공모전",
    fields: "웹/모바일/IT, 기타",
    organizer: "테스트 주최",
    daysLeft: 3,
  };

  it("상세가 없으면 D-N을 KST 달력 기준으로 환산한다", () => {
    const ev = buildWevityEvent(row, undefined, NOW);
    // 2026-09-13(KST) + 3일 = 2026-09-16 23:59 KST
    expect(ev.startDate).toBe("2026-09-16T23:59:00+09:00");
    expect(ev.registrationEnd).toBe(ev.startDate);
    expect(ev.allDay).toBe(true);
    expect(ev.type).toBe("CONTEST");
    expect(ev.fee).toBeNull(); // 참가비 미상 — 무료로 단정하지 않는다
  });

  it("KST 자정 직전(UTC 15시 이후)에도 날짜가 밀리지 않는다", () => {
    // 2026-09-13 23:30 KST = 2026-09-13 14:30 UTC (같은 날)
    // 2026-09-14 00:30 KST = 2026-09-13 15:30 UTC (KST로는 다음날)
    const kstNextDay = new Date("2026-09-13T15:30:00Z");
    const ev = buildWevityEvent(row, undefined, kstNextDay);
    expect(ev.startDate).toBe("2026-09-17T23:59:00+09:00");
  });

  it("상세의 접수기간이 있으면 그 값을 우선한다", () => {
    const ev = buildWevityEvent(
      row,
      {
        registrationStart: "2026-07-31",
        registrationEnd: "2026-10-17",
        organizer: "상세 주최",
      },
      NOW,
    );
    expect(ev.registrationStart).toBe("2026-07-31T00:00:00+09:00");
    expect(ev.registrationEnd).toBe("2026-10-17T23:59:00+09:00");
    expect(ev.startDate).toBe("2026-10-17T23:59:00+09:00");
    expect(ev.organizer).toBe("상세 주최");
  });
});

describe("mapWevityFields 분야 매핑", () => {
  it("첫 매칭 분야를 우선한다", () => {
    expect(mapWevityFields("웹/모바일/IT, 광고/마케팅", "t")).toBe("IT");
    expect(mapWevityFields("광고/마케팅, 웹/모바일/IT", "t")).toBe("MARKETING");
    expect(mapWevityFields("영상/UCC/사진", "t")).toBe("MEDIA");
    expect(mapWevityFields("논문/리포트", "t")).toBe("RESEARCH");
  });

  it("매핑 실패 시 키워드 분류→BUSINESS 폴백", () => {
    expect(mapWevityFields("기타", "아무 관련 없는 제목")).toBe("BUSINESS");
  });
});
