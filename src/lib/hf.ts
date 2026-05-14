import type { Persona, Sex } from "@/lib/types";

export type PersonaFilter = {
  sex?: Sex | "";
  ageMin: number;
  ageMax: number;
  province?: string | "";
  length: number;
};

type HfRowsResponse = {
  rows: Array<{ row: Record<string, unknown> }>;
  num_rows_total?: number;
};

const DATASET = "nvidia/Nemotron-Personas-Korea";
const TOTAL_ROWS = 1_000_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 6;

function normalizeProvince(value: string): string {
  return value
    .replace(/특별자치(시|도)$/u, "")
    .replace(/특별시$/u, "")
    .replace(/광역시$/u, "")
    .replace(/도$/u, "");
}

function sexToKorean(sex: Sex): "남자" | "여자" {
  return sex === "female" ? "여자" : "남자";
}

function sexFromKorean(value: unknown): Sex {
  return value === "여자" ? "female" : "male";
}

export function buildHfWhere(filter: PersonaFilter): string {
  const parts = [`age >= ${filter.ageMin}`, `age <= ${filter.ageMax}`];
  if (filter.sex) parts.push(`sex = '${sexToKorean(filter.sex)}'`);
  if (filter.province)
    parts.push(`province = '${normalizeProvince(filter.province)}'`);
  return parts.join(" AND ");
}

function buildHfRowsUrl(offset: number, length: number): string {
  const params = new URLSearchParams({
    dataset: DATASET,
    config: "default",
    split: "train",
    offset: String(offset),
    length: String(length),
  });
  return `https://datasets-server.huggingface.co/rows?${params.toString()}`;
}

function matches(row: Record<string, unknown>, filter: PersonaFilter): boolean {
  const age = row.age;
  if (typeof age !== "number") return false;
  if (age < filter.ageMin || age > filter.ageMax) return false;
  if (filter.sex && row.sex !== sexToKorean(filter.sex)) return false;
  if (filter.province) {
    const want = normalizeProvince(filter.province);
    if (row.province !== want) return false;
  }
  return true;
}

function pickString(row: Record<string, unknown>, key: string): string | undefined {
  const v = row[key];
  return typeof v === "string" ? v : undefined;
}

function toPersona(row: Record<string, unknown>): Persona {
  return {
    age: row.age as number,
    sex: sexFromKorean(row.sex),
    province: pickString(row, "province"),
    district: pickString(row, "district"),
    occupation: pickString(row, "occupation"),
    education_level: pickString(row, "education_level"),
    marital_status: pickString(row, "marital_status"),
    family_type: pickString(row, "family_type"),
    professional_persona: pickString(row, "professional_persona"),
    culinary_persona: pickString(row, "culinary_persona"),
    travel_persona: pickString(row, "travel_persona"),
    persona: pickString(row, "persona"),
  };
}

export async function fetchPersonas(filter: PersonaFilter) {
  const matched: Persona[] = [];
  const seen = new Set<string>();
  let total: number | null = null;
  let firstUrl = "";

  for (let i = 0; i < MAX_PAGES && matched.length < filter.length; i++) {
    const maxOffset = Math.max(0, TOTAL_ROWS - PAGE_SIZE);
    const offset = Math.floor(Math.random() * maxOffset);
    const url = buildHfRowsUrl(offset, PAGE_SIZE);
    if (!firstUrl) firstUrl = url;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HF API 오류 (HTTP ${res.status})`);
    const data = (await res.json()) as HfRowsResponse;
    total = data.num_rows_total ?? total;

    for (const r of data.rows || []) {
      const row = r.row;
      const uuid = pickString(row, "uuid");
      if (uuid) {
        if (seen.has(uuid)) continue;
        seen.add(uuid);
      }
      if (!matches(row, filter)) continue;
      matched.push(toPersona(row));
      if (matched.length >= filter.length) break;
    }
  }

  return {
    url: firstUrl,
    where: buildHfWhere(filter),
    total,
    personas: matched,
  };
}
