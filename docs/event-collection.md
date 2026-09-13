# 행사 수집 구조 (DB 없이 Next.js + Vercel)

별도 DB·Redis·외부 저장소 없이, 외부 공개 출처를 Next.js fetch Data Cache로
캐싱해 캘린더에 표시한다. `DATABASE_URL` 없이 빌드·실행된다.

## 구성

```
lib/sources/
├── registry.ts          # 활성 출처 목록 + 제외 출처 조사 기록
├── index.ts             # 공통 수집 계층 (병렬 실행·부분 실패·시간 예산)
├── dedup.ts             # 출처 간 중복 처리 (URL / 제목+날짜, 보수적)
├── types.ts             # CollectedEvent / EventSource / CollectContext
├── scrapers/
│   ├── devevent.ts      # brave-people/Dev-Event (GitHub raw 마크다운, IT)
│   ├── gdg.ts           # GDG 챕터 페이지 (HTML, IT 커뮤니티)
│   └── wevity.ts        # 위비티 공모전 (HTML 리스트+상세, 전 분야)
└── util/
    ├── fetch.ts         # 캐시 적용 fetch + 동시성 제한
    ├── date.ts          # KST(+09:00) 명시적 날짜 처리
    ├── html.ts          # 엔티티 디코딩/태그 제거
    └── classify.ts      # 키워드 → 분야 분류
```

페이지(`app/page.tsx`)와 `/api/events`(`app/api/events/route.ts`)는 모두
`lib/events-data.ts`의 `getEventsPayload()` 하나를 거친다.

## 캐시 방식

현재 Next.js 버전(16.2.4)의 **이전 모델(Previous Model) 캐싱**을 사용한다
(`cacheComponents` 미사용). 근거 문서:
`node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`,
`.../01-getting-started/08-caching.md`, `.../02-guides/how-revalidation-works.md`.

- 외부 요청마다 `fetch(url, { next: { revalidate: 3600, tags: ["events-src:<id>"] } })`
  → URL 단위 Data Cache, **출처별 태그로 분리**, 갱신 주기 1시간.
- 1시간 경과 후에는 **stale-while-revalidate**: 이전 성공 결과를 즉시 반환하며
  백그라운드에서 재수집한다. 재수집이 실패하면 이전 결과가 유지된다
  (Next는 HTTP 200 응답만 캐시에 쓴다 — `next/dist/server/lib/patch-fetch.js`).
- 수집 오류·파싱 실패는 캐시되지 않는다. 파서가 0건을 반환하는 것이 마크업 변경을
  의미하는 출처(위비티 리스트, Dev-Event 섹션)는 빈 결과 대신 오류를 던진다.
- 캐시가 아예 없는 상태(첫 배포 직후 등)에서 수집이 실패하면 해당 출처는
  `sources[].ok=false`로 내려가고 UI가 "일부/전체 수집 실패"를 표시한다.
- 전역 변수·로컬 파일·`/tmp`를 저장소로 쓰지 않는다. 캐시는 Next/Vercel의
  Data Cache에만 의존하며, 영구 보관을 보장하지 않는다(원문에서 사라진 행사나
  변경 이력 보존은 약속하지 않는다).

## 요청 기반 갱신 vs 예약 실행

| | 요청 기반 (기본) | 예약 실행 (`/api/cron/refresh-events`) |
|---|---|---|
| 트리거 | 사용자/API 요청이 캐시를 방문할 때 | Vercel Cron (`vercel.json`, 매일 21:00 UTC = 06:00 KST) |
| 동작 | 1시간 지난 캐시는 stale 반환 + 백그라운드 재수집 | `revalidateTag(tag, "max")`로 전 출처를 stale 처리 후 즉시 재수집해 캐시를 데움 |
| 필요성 | **Cron 없이도 이것만으로 동작한다** | 선택 사항 — 트래픽 없는 시간대 캐시 예열용 |

- Vercel Hobby 플랜은 Cron이 하루 1회로 제한되므로 일 1회 예열로 두었다.
  시간 단위 갱신은 요청 기반 재검증이 담당한다.
- `CRON_SECRET` 환경변수를 설정하면 Cron 라우트가 Bearer 토큰을 검사한다
  (Vercel Cron은 해당 헤더를 자동으로 붙인다). 미설정 시 검사 생략.

## 작업량 제한

- 출처별 시간 예산 20초(`SOURCE_BUDGET_MS`) — 초과 시 해당 출처만 실패 처리.
- 요청(fetch)별 타임아웃 8–12초.
- 동시 요청 제한: GDG 챕터 4개, 위비티 상세 3개 (`mapWithConcurrency`).
- 순회 상한: 위비티 리스트 2페이지·상세 10건, GDG 챕터 8개.
- 한 출처의 실패는 다른 출처에 영향을 주지 않는다(`Promise.all` + 출처별 try/catch).
- 응답 후 방치되는 자체 비동기 작업 없음 — 백그라운드 재검증은 Next/Vercel 런타임이 관리한다.

## 데이터 정확성 규칙

- ISO 날짜는 항상 `+09:00`(KST) 오프셋을 명시한다 (`lib/sources/util/date.ts`).
- 원문에 시각이 없으면 시각을 만들어 넣지 않고 `allDay: true`(시간 미정)로 표시.
- `fee: null` = 가격 정보 없음(무료와 구분), `fee: 0` = 원문에 무료 명시.
- `location: ""` = 장소 미정. 원문에 없는 장소를 넣지 않는다.
- 공모전(위비티)은 개최일이 원문에 없으므로 **접수 마감일**을 캘린더 기준일로
  쓰고(`registrationEnd`와 동일 값), 모달에 "접수 마감"으로 표기한다.
- Dev-Event는 "일시"가 명시된 항목만 수집한다. "접수"만 있는 항목은 개최일을
  추정하지 않고 제외한다.
- 출처 간 중복은 ① 정규화한 원문 URL ② 정규화한 제목+시작 날짜로만 판정하고
  (보수적), 중복 시 정보가 더 풍부한 레코드를 남긴다 (`lib/sources/dedup.ts`).

## 출처 등록 기준과 조사 기록

등록 기준: robots.txt가 일반 수집기를 허용 + 로그인 없이 접근 가능 +
서버 렌더링(또는 raw 파일) + 실제 페이지와 대조해 파서 검증.

2026-09 조사에서 제외한 출처와 사유는 `lib/sources/registry.ts` 주석 참고
(onoffmix: robots 전면 차단, event-us/COEX: JS 렌더링, 10times: Cloudflare 차단,
work24: 세션 필요, KIISE: JSF 세션, festa: 서비스 종료).

새 출처 추가: `lib/sources/scrapers/`에 `EventSource` 구현(파서는 순수 함수로
분리해 테스트 가능하게) → `registry.ts`의 `SOURCES`에 추가 → `test/`에 고정
샘플 테스트 추가.

## 검증

- `npm test` — 고정 샘플(실제 페이지 스냅샷, `test/fixtures/`) 기반:
  파싱, KST 날짜 처리, 중복 처리, 부분 실패.
- `npm run lint`, `npm run build` — `DATABASE_URL` 없이 통과해야 한다.
- 로컬 E2E: `npm run build && npx next start` 후 `GET /api/events`.

## Vercel 설정

- 필수 환경변수 없음. 선택: `CRON_SECRET`(Cron 라우트 보호).
- `vercel.json`의 crons가 배포 시 자동 등록된다.
- 함수 실행 시간: 콜드 캐시 첫 수집이 5–10초 수준이므로 기본 한도로 충분하다.
