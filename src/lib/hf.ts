import type { Persona, Sex } from "@/lib/types";

export type PersonaFilter = {
  sex?: Sex | "";
  ageMin: number;
  ageMax: number;
  province?: string | "";
  length: number;
};

export type HfFilterResponse = {
  rows: Array<{ row: Persona }>;
  num_rows_total?: number;
};

const DATASET = "nvidia/Nemotron-Personas-Korea";

export function buildHfWhere(filter: PersonaFilter) {
  const parts = [`age >= ${filter.ageMin}`, `age <= ${filter.ageMax}`];
  if (filter.sex) parts.push(`sex = '${filter.sex}'`);
  if (filter.province) parts.push(`province = '${filter.province}'`);
  return parts.join(" AND ");
}

export function buildHfFilterUrl(filter: PersonaFilter) {
  const where = buildHfWhere(filter);
  const offset = Math.floor(Math.random() * 200);
  return `https://datasets-server.huggingface.co/filter?dataset=${encodeURIComponent(
    DATASET,
  )}&config=default&split=train&where=${encodeURIComponent(
    where,
  )}&offset=${offset}&length=${filter.length}`;
}

export async function fetchPersonas(filter: PersonaFilter) {
  const url = buildHfFilterUrl(filter);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HF API 오류 (HTTP ${res.status})`);
  const data = (await res.json()) as HfFilterResponse;
  const personas = (data.rows || []).map((r) => r.row);
  return {
    url,
    where: buildHfWhere(filter),
    total: data.num_rows_total ?? null,
    personas,
  };
}
