import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseDevEventMarkdown,
  parseScheduleRange,
  splitMonthSections,
} from "@/lib/sources/scrapers/devevent";

const markdown = readFileSync(
  join(__dirname, "fixtures", "devevent.md"),
  "utf-8",
);

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

  it("일시가 명시된 항목만 수집한다 (접수만 있는 항목은 날짜 추정 금지)", () => {
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

  it("60일보다 오래 지난 행사는 제외한다", () => {
    const future = new Date("2027-06-01T00:00:00Z");
    expect(parseDevEventMarkdown(markdown, future).length).toBe(0);
  });
});
