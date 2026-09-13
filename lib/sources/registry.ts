import type { EventSource } from "./types";
import { devEventSource } from "./scrapers/devevent";
import { gdgSource } from "./scrapers/gdg";
import { wevitySource } from "./scrapers/wevity";

// 활성 출처 목록. 새 출처는 scrapers/에 EventSource를 구현하고 여기에 추가한다.
//
// 등록 기준 (2026-09 실측):
// - robots.txt가 일반 수집기를 허용할 것 (차단 우회 금지)
// - 서버 렌더링 HTML / 공개 raw 파일 등 로그인 없이 접근 가능할 것
// - 실제 페이지와 대조해 파서가 동작할 것
//
// 조사했지만 제외한 출처:
// - onoffmix.com   → robots.txt가 허용 목록 외 봇 전면 차단(User-agent: * Disallow: /)
// - event-us.kr    → 목록이 클라이언트 렌더링(JS)이라 HTML에 데이터 없음
// - coex.co.kr     → 전시 일정 페이지가 JS 렌더링
// - kiise.or.kr    → JSF 세션 기반이라 직접 URL 접근 불가
// - 10times.com    → Cloudflare 챌린지로 봇 차단
// - work24.go.kr   → 채용행사 목록이 세션 기반 POST 필요
// - festa.io       → 행사 플랫폼 종료(정적 홍보 사이트로 전환)
export const SOURCES: EventSource[] = [devEventSource, gdgSource, wevitySource];

export function getSourceById(id: string): EventSource | undefined {
  return SOURCES.find((s) => s.id === id);
}
