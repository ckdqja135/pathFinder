import type { CollectedEvent } from "../types";

export const businessConferenceSeeds: CollectedEvent[] = [
  {
    source: "conf-business",
    externalId: "next-rise-2026",
    title: "NextRise 2026, Seoul",
    category: "BUSINESS",
    type: "CONFERENCE",
    startDate: "2026-06-11T09:00:00",
    endDate: "2026-06-12T18:00:00",
    organizer: "한국무역협회·KDB산업은행",
    location: "코엑스",
    isOnline: false,
    fee: 0,
    link: "https://www.nextrise.co.kr",
    description:
      "아시아 최대 규모 스타트업 IR 행사. 200+ 스타트업 부스, VC 미팅, 채용 라운드.",
  },
  {
    source: "conf-business",
    externalId: "comeup-2026",
    title: "COMEUP 2026",
    category: "BUSINESS",
    type: "CONFERENCE",
    startDate: "2026-11-25T10:00:00",
    endDate: "2026-11-27T18:00:00",
    organizer: "중소벤처기업부·창업진흥원",
    location: "동대문디자인플라자 (DDP)",
    isOnline: false,
    fee: 0,
    link: "https://www.kcomeup.com",
    description:
      "정부 주관 글로벌 스타트업 페스티벌. 컨퍼런스 + 부스 + 글로벌 IR.",
  },
  {
    source: "conf-business",
    externalId: "wanted-join-2026",
    title: "스타트업 채용 페스티벌 'JOIN 2026'",
    category: "BUSINESS",
    type: "JOB_FAIR",
    startDate: "2026-06-05T11:00:00",
    endDate: "2026-06-06T18:00:00",
    organizer: "원티드랩",
    location: "DDP 동대문디자인플라자",
    isOnline: false,
    fee: 5000,
    link: "https://www.wanted.co.kr",
    description:
      "200+ 스타트업이 참여하는 합동 채용 박람회. 즉석 면접 + 포트폴리오 리뷰 부스.",
  },
];
