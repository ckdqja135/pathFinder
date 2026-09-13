// HTML 엔티티 디코딩과 태그 제거만 담당. cheerio 없이 처리하기 위한 최소 도구.

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&#160;": " ",
};

export function decodeEntities(s: string): string {
  let out = s.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39|#160);/g, (m) => ENTITY_MAP[m] ?? m);
  out = out.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
    String.fromCharCode(parseInt(code, 16)),
  );
  return out;
}

export function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

export function clean(s: string): string {
  return decodeEntities(stripTags(s)).replace(/\s+/g, " ").trim();
}
