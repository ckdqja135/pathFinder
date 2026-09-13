import { describe, expect, it } from "vitest";
import { addDaysKst, kstIso, kstParts } from "@/lib/sources/util/date";

describe("KST 날짜 유틸", () => {
  it("UTC 15시 이후는 KST 다음날로 계산한다", () => {
    // 2026-09-13 15:30 UTC = 2026-09-14 00:30 KST
    expect(kstParts(new Date("2026-09-13T15:30:00Z"))).toEqual({
      year: 2026,
      month: 9,
      day: 14,
    });
    // 2026-09-13 14:59 UTC = 2026-09-13 23:59 KST
    expect(kstParts(new Date("2026-09-13T14:59:00Z"))).toEqual({
      year: 2026,
      month: 9,
      day: 13,
    });
  });

  it("kstIso는 +09:00 오프셋을 명시한다", () => {
    expect(kstIso(2026, 1, 5)).toBe("2026-01-05T00:00:00+09:00");
    expect(kstIso(2026, 12, 31, 23, 59)).toBe("2026-12-31T23:59:00+09:00");
  });

  it("addDaysKst는 월/연 경계를 넘긴다", () => {
    expect(addDaysKst({ year: 2026, month: 12, day: 30 }, 3)).toEqual({
      year: 2027,
      month: 1,
      day: 2,
    });
    expect(addDaysKst({ year: 2026, month: 3, day: 1 }, -1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
  });
});
