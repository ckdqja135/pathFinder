import type { CollectedEvent } from "../types";

export const mediaConferenceSeeds: CollectedEvent[] = [
  {
    source: "conf-media",
    externalId: "bcwc-2026",
    title: "방송콘텐츠 미래포럼 (BCWC) 2026",
    category: "MEDIA",
    type: "CONFERENCE",
    startDate: "2026-09-10T10:00:00",
    endDate: "2026-09-11T18:00:00",
    organizer: "한국방송학회",
    location: "JW 메리어트 서울",
    isOnline: false,
    fee: 80000,
    link: "https://www.kabs.or.kr",
    description:
      "OTT·방송·콘텐츠 산업 종사자 대상 컨퍼런스. 트렌드, 정책, IP 전략.",
  },
  {
    source: "conf-media",
    externalId: "buc-2026",
    title: "부산 콘텐츠 마켓 (BCM) 2026",
    category: "MEDIA",
    type: "CONFERENCE",
    startDate: "2026-05-13T10:00:00",
    endDate: "2026-05-15T18:00:00",
    organizer: "부산콘텐츠마켓 조직위",
    location: "부산 BEXCO",
    isOnline: false,
    fee: 0,
    link: "https://www.ibcm.tv",
    description:
      "방송영상 콘텐츠 마켓·컨퍼런스. 글로벌 바이어, PD, 작가 대상 세션.",
  },
  {
    source: "conf-media",
    externalId: "youtube-creator-awards-2026",
    title: "유튜브 크리에이터 어워즈 2026",
    category: "MEDIA",
    type: "CONTEST",
    startDate: "2026-05-20T00:00:00",
    endDate: "2026-07-10T23:59:00",
    organizer: "YouTube Korea",
    location: "온라인 출품",
    isOnline: true,
    fee: 0,
    link: "https://www.youtube.com",
    description:
      "신인 크리에이터를 위한 영상 공모전. 부문별 시상 + 채널 그로스 멘토링 제공.",
  },
];
