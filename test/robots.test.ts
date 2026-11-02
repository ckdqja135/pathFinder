import { describe, expect, it } from "vitest";
import { isAllowedByRobots } from "@/lib/sources/util/robots";

// event-us.kr/robots.txt 실측(2026-10-29) — 콜론 뒤 공백 없음, 특정 행사 차단 포함
const EVENTUS = `User-agent:*
Allow:/
Disallow:/Project/New
Disallow:/teralabs/event/3845
Disallow:/mbnforum/event/38443
Disallow:/user/applicant/*
Disallow:/*/user/applicant/*
Disallow:/rss/event
Disallow:/biz/*
Disallow:/dev/event/
Sitemap: https://event-us.kr/sitemap.xml`;

describe("isAllowedByRobots", () => {
  it("이벤터스 실측 robots: 행사 상세는 허용, 차단 경로는 거부", () => {
    expect(isAllowedByRobots(EVENTUS, "/owasp/event/133675")).toBe(true);
    expect(isAllowedByRobots(EVENTUS, "/dev/event/123")).toBe(false);
    expect(isAllowedByRobots(EVENTUS, "/teralabs/event/3845")).toBe(false);
    expect(isAllowedByRobots(EVENTUS, "/rss/event")).toBe(false);
    expect(isAllowedByRobots(EVENTUS, "/owasp/user/applicant/1")).toBe(false);
  });

  it("빈 파일·빈 Disallow는 제한 없음", () => {
    expect(isAllowedByRobots("", "/anything")).toBe(true);
    expect(isAllowedByRobots("User-agent: *\nDisallow:", "/anything")).toBe(true);
  });

  it("우리 토큰 전용 그룹이 있으면 * 그룹 대신 그것을 따른다", () => {
    const txt = [
      "User-agent: *",
      "Disallow: /",
      "",
      "User-agent: PathFinderBot",
      "Allow: /events/",
      "Disallow: /",
    ].join("\n");
    expect(isAllowedByRobots(txt, "/events/1")).toBe(true);
    expect(isAllowedByRobots(txt, "/admin")).toBe(false);
    // 다른 봇 전용 그룹은 무시하고 * 를 따른다
    expect(isAllowedByRobots("User-agent: GPTBot\nDisallow: /\n", "/x")).toBe(true);
  });

  it("User-agent 여러 줄은 한 그룹으로 묶인다", () => {
    const txt = "User-agent: GPTBot\nUser-agent: *\nDisallow: /private\n";
    expect(isAllowedByRobots(txt, "/private/a")).toBe(false);
    expect(isAllowedByRobots(txt, "/public")).toBe(true);
  });

  it("가장 긴 규칙이 이기고, 길이가 같으면 Allow", () => {
    const txt = "User-agent: *\nDisallow: /conf\nAllow: /conf/2026/\n";
    expect(isAllowedByRobots(txt, "/conf/2026/")).toBe(true);
    expect(isAllowedByRobots(txt, "/conf/2025/")).toBe(false);
    expect(isAllowedByRobots("User-agent: *\nDisallow: /a\nAllow: /a\n", "/a")).toBe(true);
  });

  it("* 와일드카드와 $ 끝 고정, 쿼리 포함 경로", () => {
    const txt = "User-agent: *\nDisallow: /*.pdf$\nDisallow: /*?session=\n";
    expect(isAllowedByRobots(txt, "/files/a.pdf")).toBe(false);
    expect(isAllowedByRobots(txt, "/files/a.pdf?x=1")).toBe(true);
    expect(isAllowedByRobots(txt, "/list?session=abc")).toBe(false);
  });

  it("주석과 대소문자 지시어를 처리하고, 그룹 밖 규칙은 무시한다", () => {
    const txt = "Disallow: /orphan\n# comment\nUSER-AGENT: * # all\nDISALLOW: /x # no\n";
    expect(isAllowedByRobots(txt, "/orphan")).toBe(true);
    expect(isAllowedByRobots(txt, "/x/y")).toBe(false);
  });
});
