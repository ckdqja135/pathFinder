import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildContestKoreaEvent,
  inferEndYear,
  mapContestKoreaCategory,
  parseContestKoreaList,
} from "@/lib/sources/scrapers/contestkorea";

const html = readFileSync(
  join(__dirname, "fixtures", "contestkorea-list.html"),
  "utf-8",
);

// 픽스처(실측)의 접수기간은 2026년 9~10월 — 기준 시각을 그 시점으로 고정.
const NOW = new Date("2026-09-13T03:00:00Z"); // 2026-09-13 12:00 KST

describe("parseContestKoreaList (실제 페이지 스냅샷)", () => {
  const rows = parseContestKoreaList(html);

  it("접수중 항목을 필드와 함께 추출한다", () => {
    expect(rows.length).toBe(5);
    for (const row of rows) {
      expect(row.externalId).toMatch(/^\d+$/);
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.link).toMatch(
        /^https:\/\/www\.contestkorea\.com\/sub\/view\.php\?int_gbn=1&/,
      );
      expect(row.startMonth).toBeGreaterThanOrEqual(1);
      expect(row.endMonth).toBeLessThanOrEqual(12);
      expect(row.organizer.length).toBeGreaterThan(0);
    }
  });

  it("주최와 분야 라벨을 읽는다", () => {
    const erp = rows.find((r) => r.title.includes("ERP 아이디어"))!;
    expect(erp.categoryLabel).toBe("아이디어•건축•창업");
    expect(erp.startMonth).toBe(9);
    expect(erp.startDay).toBe(11);
    expect(erp.endMonth).toBe(10);
    expect(erp.endDay).toBe(6);
  });

  it("접수중이 아닌 블록·사이드바 링크는 걸러진다", () => {
    const noise =
      '<div class="title"><a href="view.php?int_gbn=1&str_no=1">' +
      '<span class="txt">마감된 대회</span></a></div>' +
      '<em>접수</em> 01.01~02.01 <span class="day">마감</span>' +
      '<span class="condition">심사중</span>';
    expect(parseContestKoreaList(noise).length).toBe(0);
  });
});

describe("inferEndYear", () => {
  it("접수중 마감일은 오늘 이후가 되는 가장 가까운 연도를 고른다", () => {
    expect(inferEndYear(10, 6, NOW)).toBe(2026); // 미래(같은 해)
    expect(inferEndYear(9, 13, NOW)).toBe(2026); // 오늘(당일 마감)
    expect(inferEndYear(1, 10, NOW)).toBe(2027); // 이미 지난 월일 → 내년
  });
});

describe("buildContestKoreaEvent", () => {
  const rows = parseContestKoreaList(html);

  it("접수 마감일을 캘린더 기준일로 쓰고 KST를 명시한다", () => {
    const ev = buildContestKoreaEvent(
      rows.find((r) => r.title.includes("ERP 아이디어"))!,
      NOW,
    );
    expect(ev.type).toBe("CONTEST");
    expect(ev.registrationStart).toBe("2026-09-11T00:00:00+09:00");
    expect(ev.registrationEnd).toBe("2026-10-06T23:59:00+09:00");
    expect(ev.startDate).toBe(ev.registrationEnd);
    expect(ev.allDay).toBe(true);
    expect(ev.fee).toBeNull();
    expect(ev.location).toBe("");
  });

  it("접수기간이 해를 넘기면 시작 연도를 한 해 앞으로 잡는다", () => {
    const ev = buildContestKoreaEvent(
      {
        externalId: "9",
        link: "https://www.contestkorea.com/sub/view.php?int_gbn=1&str_no=9",
        title: "연말 공모전",
        categoryLabel: "",
        organizer: "주최",
        target: "",
        startMonth: 12,
        startDay: 20,
        endMonth: 1,
        endDay: 10,
      },
      NOW,
    );
    expect(ev.registrationStart).toBe("2026-12-20T00:00:00+09:00");
    expect(ev.registrationEnd).toBe("2027-01-10T23:59:00+09:00");
  });
});

describe("mapContestKoreaCategory", () => {
  it("분야 라벨 토큰을 순서대로 매핑한다", () => {
    expect(mapContestKoreaCategory("음악•콩쿠르•댄스", "t")).toBe("MEDIA");
    expect(mapContestKoreaCategory("학문•과학•IT", "t")).toBe("RESEARCH");
    expect(mapContestKoreaCategory("아이디어•건축•창업", "t")).toBe("BUSINESS");
    expect(mapContestKoreaCategory("네이밍•슬로건", "t")).toBe("MARKETING");
    expect(mapContestKoreaCategory("게임•소프트웨어", "t")).toBe("IT");
  });

  it("라벨이 없으면 제목 키워드로 폴백한다", () => {
    expect(mapContestKoreaCategory("", "AI 개발 해커톤")).toBe("IT");
    expect(mapContestKoreaCategory("", "아무 관련 없는 것")).toBe("BUSINESS");
  });
});
