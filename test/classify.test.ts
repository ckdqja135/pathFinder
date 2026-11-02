import { describe, expect, it } from "vitest";
import { classifyByText } from "@/lib/sources/util/classify";

describe("classifyByText", () => {
  it("영문 키워드는 단어 일부에 걸리지 않는다 (실측 오분류 사례)", () => {
    // "SEO" ⊂ "Seoul" 로 마케팅에 분류되던 Dev-Event 항목들
    expect(classifyByText(".NET Conf 2026 @Seoul", "IT")).toBe("IT");
    expect(classifyByText("DDD Seoul 2026", "IT")).toBe("IT");
    expect(classifyByText("2026 NASA International Space Apps Challenge Seoul", "IT")).toBe("IT");
    // "AI" ⊂ "chain", "ML" ⊂ "html", "UI" ⊂ "build"
    expect(classifyByText("Supply chain fair")).toBe("BUSINESS");
    expect(classifyByText("html build guide")).toBe("BUSINESS");
  });

  it("영문 키워드가 단어로 쓰이면 매칭한다 (한글·기호와 붙어 있어도)", () => {
    expect(classifyByText("2026 AI활용 창업 해커톤")).toBe("IT");
    expect(classifyByText("SEO 실무 세미나")).toBe("MARKETING");
    expect(classifyByText("UX/UI 포트폴리오 리뷰")).toBe("DESIGN");
    expect(classifyByText("C++ 스터디")).toBe("IT");
    expect(classifyByText("Next.js Conf")).toBe("IT");
  });

  it("한글 키워드는 복합어 안에서도 매칭한다", () => {
    expect(classifyByText("퍼포먼스마케팅팀 채용설명회")).toBe("MARKETING");
    expect(classifyByText("2026 디지털미디어테크쇼")).toBe("IT");
  });

  it("아무것도 맞지 않으면 폴백", () => {
    expect(classifyByText("2026 메가주 일산 시즌2", "BUSINESS")).toBe("BUSINESS");
  });
});
