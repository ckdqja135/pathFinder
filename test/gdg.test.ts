import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  chapterName,
  parseGdgChapterPage,
  slugToTitle,
  splitGdgCards,
} from "@/lib/sources/scrapers/gdg";

const html = readFileSync(
  join(__dirname, "fixtures", "gdg-chapter.html"),
  "utf-8",
);

// 픽스처(gdg-seoul 실측)에는 2026-05-02 / 2025-11-30 / 2025-08-09 / 2025-05-24
// 카드 4장이 들어 있다.
const NOW = new Date("2026-09-13T03:00:00Z");

describe("splitGdgCards (실제 챕터 페이지 스냅샷)", () => {
  it("이벤트 카드를 분리한다", () => {
    expect(splitGdgCards(html).length).toBe(4);
  });
});

describe("parseGdgChapterPage", () => {
  it("지난 60일 이전 행사는 제외한다", () => {
    const events = parseGdgChapterPage(html, "gdg-seoul", NOW);
    // NOW 기준 60일 이내 과거 + 미래 = 2026-05-02 행사는 60일 이전이므로 제외...
    // (2026-05-02는 NOW보다 134일 전) → 남는 카드 없음
    expect(events.length).toBe(0);

    const earlier = new Date("2026-05-10T00:00:00Z");
    const events2 = parseGdgChapterPage(html, "gdg-seoul", earlier);
    expect(events2.length).toBe(1);
    const ev = events2[0];
    expect(ev.startDate).toBe("2026-05-02T00:00:00+09:00");
    expect(ev.allDay).toBe(true); // 카드에 시각 정보 없음
    expect(ev.fee).toBeNull(); // 참가비 정보 없음
    expect(ev.location).toBe(""); // 장소 정보 없음
    expect(ev.organizer).toBe("GDG Seoul");
    expect(ev.link).toMatch(/^https:\/\/gdg\.community\.dev\/events\/details\//);
  });

  it("같은 카드가 중복돼도 externalId로 걸러낸다", () => {
    const doubled = html.replace("</body>", "") + html;
    const earlier = new Date("2026-05-10T00:00:00Z");
    const events = parseGdgChapterPage(doubled, "gdg-seoul", earlier);
    const ids = events.map((e) => e.externalId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("slug 변환", () => {
  it("이벤트 슬러그에서 제목을 만든다", () => {
    expect(
      slugToTitle("google-gdg-seoul-presents-build-with-ai-seoul-2026-with-google-deepmind"),
    ).toBe("Build With AI Seoul 2026 With Google Deepmind");
  });

  it("챕터 슬러그에서 챕터명을 만든다", () => {
    expect(chapterName("gdg-seoul")).toBe("Seoul");
    expect(chapterName("gdg-campus-korea")).toBe("Campus Korea");
  });
});
