import type { Brand } from "@/lib/types";

export const DEFAULT_BRANDS: Brand[] = [
  {
    id: "butter-butler",
    name: "Butter Butler",
    tag: "버터 피낭시에 · 검증된 파트너십",
    desc: "일본 슈크레이社의 고급 버터 피낭시에 브랜드. 도쿄 밀크 치즈 팩토리 계열로 한국 물류 경험 보유. 고급스러운 버터 풍미와 선물용 패키징이 특징. 백화점·공항 중심 유통.",
  },
  {
    id: "brulee-merize",
    name: "BRULEE MERIZE",
    tag: "도쿄역 핫플 · 라이징 스타(2024~25)",
    desc: "2024~2025년 도쿄역에서 폭발적 인기를 얻은 브륄레 디저트 신예 브랜드. 크리스피한 브륄레 표면과 크리미한 내부가 특징인 비주얼 디저트. SNS에서 줄서는 맛집으로 유명.",
  },
  {
    id: "nyc-sand",
    name: "N.Y.C. SAND",
    tag: "일본 여행 필수템 1위 · 마케팅 리스크 낮음",
    desc: '도쿄 타마야의 뉴욕 스타일 쿠키 샌드위치. 일본 여행객 기념품 구매 1위 브랜드. "일본 가면 무조건 사와야 하는 것"으로 SNS·유튜브에서 압도적 인지도 보유.',
  },
];

const STORAGE_KEY = "ss_brands_v1";

export function loadBrandsFromStorage(): Brand[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Brand[];
  } catch {
    return null;
  }
}

export function saveBrandsToStorage(brands: Brand[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(brands));
}

export function normalizeBrandId(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

