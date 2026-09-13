import { describe, expect, it } from "vitest";
import { collectFromSources } from "@/lib/sources";
import type { CollectedEvent, EventSource } from "@/lib/sources/types";

function makeEvent(id: string, day: number): CollectedEvent {
  return {
    source: "ok",
    externalId: id,
    title: `행사 ${id}`,
    category: "IT",
    type: "CONFERENCE",
    startDate: `2026-10-${String(day).padStart(2, "0")}T10:00:00+09:00`,
    endDate: `2026-10-${String(day).padStart(2, "0")}T18:00:00+09:00`,
    organizer: "주최",
    location: "서울",
    isOnline: false,
    fee: 0,
    link: `https://ok.example/${id}`,
    description: "",
  };
}

function fakeSource(
  id: string,
  impl: () => Promise<CollectedEvent[]>,
): EventSource {
  return {
    id,
    label: id,
    homepage: "https://example.com",
    method: "html",
    defaultCategory: "IT",
    collect: impl,
  };
}

describe("collectFromSources 부분 실패", () => {
  it("한 출처가 실패해도 다른 출처 결과는 반환한다", async () => {
    const good = fakeSource("good", async () => [
      makeEvent("b", 8),
      makeEvent("a", 1),
    ]);
    const bad = fakeSource("bad", async () => {
      throw new Error("boom");
    });

    const { events, sources } = await collectFromSources([bad, good]);

    expect(events.length).toBe(2);
    // 시작일 오름차순 정렬
    expect(events[0].externalId).toBe("a");

    const badStatus = sources.find((s) => s.id === "bad")!;
    expect(badStatus.ok).toBe(false);
    expect(badStatus.count).toBe(0);

    const goodStatus = sources.find((s) => s.id === "good")!;
    expect(goodStatus.ok).toBe(true);
    expect(goodStatus.count).toBe(2);
  });

  it("모든 출처가 실패하면 빈 목록 + 전원 실패 상태를 반환한다", async () => {
    const bad1 = fakeSource("bad1", async () => {
      throw new Error("boom1");
    });
    const bad2 = fakeSource("bad2", async () => {
      throw new Error("boom2");
    });

    const { events, sources } = await collectFromSources([bad1, bad2]);
    expect(events.length).toBe(0);
    expect(sources.every((s) => !s.ok)).toBe(true);
  });
});
