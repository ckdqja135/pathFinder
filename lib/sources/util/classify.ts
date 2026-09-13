import type { Category } from "@/lib/types";

// 외부 소스의 자체 분류 + 제목을 한국어 키워드로 우리 Category에 매핑.
// Why: 온오프믹스/위비티 같은 곳은 자체 카테고리 체계가 우리 8분류와 1:1이 아니라 휴리스틱이 필요.
// 매칭은 위에서 아래로 우선순위 — 더 좁은 키워드를 먼저 둔다.

// substring 매칭이라 한국어 변형도 같이 등록한다.
// 예: "디자인".includes("디자이너") = false ("디자이"+"너" vs "디자"+"인") → "디자이너" 별도 추가 필요.
const RULES: Array<{ category: Category; keywords: string[] }> = [
  {
    category: "IT",
    keywords: [
      "개발자", "개발", "프로그래밍", "프로그래머", "코딩", "코테", "코드",
      "엔지니어", "엔지니어링", "developer", "engineer", "software", "소프트웨어",
      "AI", "인공지능", "머신러닝", "딥러닝", "LLM", "ML", "데이터",
      "백엔드", "프론트엔드", "풀스택", "DevOps", "데브옵스", "클라우드",
      "리액트", "React", "Vue", "Next", "JavaScript", "TypeScript", "Python",
      "Java", "Kotlin", "Swift", "Go", "Rust", "C++",
      "GDG", "AWS", "GCP", "Azure", "Docker", "Kubernetes",
      "블록체인", "Web3", "DApp", "스마트컨트랙트",
      "보안", "해킹", "사이버", "네트워크", "인프라",
      "오픈소스", "해커톤", "테크",
    ],
  },
  {
    category: "DESIGN",
    keywords: [
      "디자인", "디자이너", "designer", "design",
      "UX", "UI", "UX/UI", "그래픽", "브랜딩", "아트워크",
      "타이포", "폰트", "일러스트", "포스터", "로고", "CI", "BI",
      "건축", "인테리어", "공간",
    ],
  },
  {
    category: "MARKETING",
    keywords: [
      "마케팅", "광고", "퍼포먼스", "콘텐츠 마케팅", "그로스", "SEO",
      "퍼블리시티", "캠페인", "브랜드", "MZ", "퍼포먼스마케팅",
    ],
  },
  {
    category: "MEDIA",
    keywords: [
      "영상", "유튜브", "숏폼", "촬영", "사진", "포토", "다큐",
      "음악", "공연", "방송", "MC", "라디오", "팟캐스트",
      "뮤직", "콘서트", "댄스", "필름", "UCC",
    ],
  },
  {
    category: "FINANCE",
    keywords: [
      "금융", "재무", "회계", "투자", "주식", "펀드", "보험",
      "은행", "핀테크", "회계사", "세무",
    ],
  },
  {
    category: "BUSINESS",
    keywords: [
      "창업", "스타트업", "비즈니스", "기획", "PM", "프로덕트",
      "경영", "전략", "MBA", "컨설팅", "리더십",
      "취업", "커리어", "채용", "이력서", "면접",
    ],
  },
  {
    category: "PUBLIC",
    keywords: [
      "행정", "공공", "정책", "공무원", "지방자치",
      "환경", "복지", "안전", "농림", "산림",
      "지속가능", "기후",
    ],
  },
  {
    category: "RESEARCH",
    keywords: [
      "논문", "학술", "연구", "리서치", "과학", "공학", "수학",
      "물리", "화학", "생물", "의학", "약학",
      "경진대회", "올림피아드",
    ],
  },
];

export function classifyByText(
  text: string,
  fallback: Category = "BUSINESS",
): Category {
  const haystack = text.toLowerCase();
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (haystack.includes(kw.toLowerCase())) return rule.category;
    }
  }
  return fallback;
}
