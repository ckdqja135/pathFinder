import { describe, expect, it } from "vitest";
import { dedupEvents } from "@/lib/sources/dedup";
import type { CollectedEvent } from "@/lib/sources/types";

function makeEvent(overrides: Partial<CollectedEvent>): CollectedEvent {
  return {
    source: "a",
    externalId: "1",
    title: "테스트 컨퍼런스 2026",
    category: "IT",
    type: "CONFERENCE",
    startDate: "2026-10-01T10:00:00+09:00",
    endDate: "2026-10-01T18:00:00+09:00",
    organizer: "주최",
    location: "서울",
    isOnline: false,
    fee: 0,
    link: "https://example.com/event/1",
    description: "",
    ...overrides,
  };
}

describe("dedupEvents", () => {
  it("원문 URL이 같으면 중복 처리한다 (www/트레일링 슬래시 무시)", () => {
    const events = [
      makeEvent({ source: "a", link: "https://www.example.com/event/1/" }),
      makeEvent({ source: "b", externalId: "x", link: "https://example.com/event/1" }),
    ];
    expect(dedupEvents(events).length).toBe(1);
  });

  it("정규화한 제목 + 시작 날짜가 같으면 중복 처리한다", () => {
    const events = [
      makeEvent({ link: "https://a.com/1", title: "테스트 컨퍼런스 2026" }),
      makeEvent({
        link: "https://b.com/2",
        title: "[테스트] 컨퍼런스 2026!",
        startDate: "2026-10-01T00:00:00+09:00",
        allDay: true,
      }),
    ];
    expect(dedupEvents(events).length).toBe(1);
  });

  it("제목이 같아도 날짜가 다르면 다른 행사로 본다 (보수적)", () => {
    const events = [
      makeEvent({ link: "https://a.com/1" }),
      makeEvent({
        link: "https://b.com/2",
        startDate: "2026-10-08T10:00:00+09:00",
        endDate: "2026-10-08T18:00:00+09:00",
      }),
    ];
    expect(dedupEvents(events).length).toBe(2);
  });

  it("중복이면 정보가 더 풍부한 레코드를 남긴다 (시각 > 종일)", () => {
    const allDayVersion = makeEvent({
      source: "gdg",
      link: "https://a.com/1",
      allDay: true,
      organizer: "",
      fee: null,
    });
    const timedVersion = makeEvent({
      source: "devevent",
      link: "https://a.com/1",
      allDay: false,
      organizer: "주최",
    });
    const kept = dedupEvents([allDayVersion, timedVersion]);
    expect(kept.length).toBe(1);
    expect(kept[0].source).toBe("devevent");
  });
});
