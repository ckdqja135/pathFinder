// KST(+09:00) 명시적 날짜 처리 유틸.
// Vercel 서버는 UTC로 돌기 때문에 `new Date().getHours()` 같은 로컬 시간 연산을
// 그대로 쓰면 KST 기준 페이지(위비티 D-N 등)와 하루가 어긋날 수 있다.
// 모든 출력 ISO 문자열은 +09:00 오프셋을 명시한다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface KstParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/** 주어진 시각의 KST 달력 날짜 구성요소 */
export function kstParts(date: Date): KstParts {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** KST 달력 값으로 +09:00 오프셋이 붙은 ISO 문자열을 만든다. */
export function kstIso(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): string {
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00+09:00`;
}

/** KST 달력 날짜에 일수를 더한다 (월/년 넘어감 처리 포함). */
export function addDaysKst(parts: KstParts, days: number): KstParts {
  const base = Date.UTC(parts.year, parts.month - 1, parts.day + days);
  const d = new Date(base);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/** ISO 문자열(오프셋 포함)을 epoch ms로. 파싱 실패 시 NaN. */
export function isoToMs(iso: string): number {
  return new Date(iso).getTime();
}
