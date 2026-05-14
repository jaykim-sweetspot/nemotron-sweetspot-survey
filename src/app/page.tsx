"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";

import {
  DEFAULT_BRANDS,
  loadBrandsFromStorage,
  normalizeBrandId,
  saveBrandsToStorage,
} from "@/lib/brands";
import { fetchPersonas } from "@/lib/hf";
import type { Brand, Persona, SurveyScores } from "@/lib/types";

const PROVINCES = [
  { label: "전체", value: "" },
  { label: "서울", value: "서울특별시" },
  { label: "경기", value: "경기도" },
  { label: "부산", value: "부산광역시" },
  { label: "인천", value: "인천광역시" },
  { label: "대구", value: "대구광역시" },
  { label: "광주", value: "광주광역시" },
  { label: "대전", value: "대전광역시" },
  { label: "제주", value: "제주특별자치도" },
];

type PersonaStatus =
  | { status: "loading" }
  | { status: "ok"; scores: SurveyScores }
  | { status: "error"; error: string };

const NewBrandSchema = z.object({
  name: z.string().min(1, "브랜드명을 입력하세요."),
  tag: z.string().min(1, "태그/한 줄 설명을 입력하세요."),
  desc: z.string().min(1, "브랜드 설명을 입력하세요."),
});

function chipClass(v: number) {
  if (v >= 4) return "border-[var(--accent)] text-[var(--accent)]";
  if (v === 3) return "border-[var(--warn)] text-[var(--warn)]";
  return "border-[var(--danger)] text-[var(--danger)]";
}

function scoreText(v: number) {
  return (["", "낮음", "낮음", "보통", "높음", "매우 높음"][v] ?? String(v)) as
    | string
    | number;
}

function DistributionChart({
  title,
  counts,
}: {
  title: string;
  counts: number[];
}) {
  const data = [1, 2, 3, 4, 5].map((s) => ({
    score: String(s),
    count: counts[s] ?? 0,
  }));

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
        {title}
      </div>
      <div className="h-[140px] w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 6, left: -8, right: 8 }}>
            <CartesianGrid stroke="#222" vertical={false} />
            <XAxis
              dataKey="score"
              tick={{ fill: "#666", fontSize: 11 }}
              axisLine={{ stroke: "#222" }}
              tickLine={{ stroke: "#222" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#666", fontSize: 11 }}
              axisLine={{ stroke: "#222" }}
              tickLine={{ stroke: "#222" }}
              width={24}
            />
            <Tooltip
              contentStyle={{
                background: "#0f0f0f",
                border: "1px solid #222",
                borderRadius: 8,
                color: "#eee",
                fontSize: 12,
              }}
              cursor={{ fill: "rgba(200,240,100,0.08)" }}
            />
            <Bar dataKey="count" fill="var(--accent2)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function getErrorMessage(e: unknown) {
  return e instanceof Error ? e.message : "알 수 없는 오류";
}

export default function Home() {
  const [filterSex, setFilterSex] = useState<"" | "female" | "male">("");
  const [ageMin, setAgeMin] = useState(20);
  const [ageMax, setAgeMax] = useState(39);
  const [province, setProvince] = useState("");
  const [fetchCount, setFetchCount] = useState(5);

  const [hfMeta, setHfMeta] = useState<{
    url?: string;
    where?: string;
    total?: number | null;
  }>({});

  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());

  const [brands, setBrands] = useState<Brand[]>(DEFAULT_BRANDS);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [newBrand, setNewBrand] = useState({ name: "", tag: "", desc: "" });
  const [brandError, setBrandError] = useState<string | null>(null);

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === selectedBrandId) ?? null,
    [brands, selectedBrandId],
  );

  const [isRunning, setIsRunning] = useState(false);
  const [perPersona, setPerPersona] = useState<Record<number, PersonaStatus>>(
    {},
  );

  useEffect(() => {
    const stored = loadBrandsFromStorage();
    if (stored && stored.length) setBrands(stored);
  }, []);

  useEffect(() => {
    saveBrandsToStorage(brands);
  }, [brands]);

  async function onFetchPersonas() {
    setIsFetching(true);
    setFetchError(null);
    setSelectedIdx(new Set());
    setPersonas([]);
    setPerPersona({});

    try {
      const { personas, total, url, where } = await fetchPersonas({
        sex: filterSex,
        ageMin,
        ageMax,
        province,
        length: fetchCount,
      });
      setPersonas(personas);
      setHfMeta({ total, url, where });
      if (!personas.length) setFetchError("조건에 맞는 페르소나가 없습니다.");
    } catch (e: unknown) {
      setFetchError(getErrorMessage(e) || "불러오기 실패");
    } finally {
      setIsFetching(false);
    }
  }

  function togglePersona(i: number) {
    setSelectedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function addBrand() {
    setBrandError(null);
    const parsed = NewBrandSchema.safeParse(newBrand);
    if (!parsed.success) {
      setBrandError(parsed.error.issues[0]?.message || "입력값을 확인하세요.");
      return;
    }

    const idBase = normalizeBrandId(parsed.data.name) || "brand";
    let id = idBase;
    let n = 2;
    while (brands.some((b) => b.id === id)) {
      id = `${idBase}-${n++}`;
    }

    const next: Brand = { id, ...parsed.data };
    setBrands((prev) => [next, ...prev]);
    setSelectedBrandId(id);
    setNewBrand({ name: "", tag: "", desc: "" });
    setIsBrandModalOpen(false);
  }

  function deleteBrand(id: string) {
    if (!confirm("이 브랜드를 삭제할까요?")) return;
    setBrands((prev) => prev.filter((b) => b.id !== id));
    if (selectedBrandId === id) setSelectedBrandId(null);
  }

  async function runSurvey() {
    if (!selectedBrand) return;
    const idxList = [...selectedIdx].sort((a, b) => a - b);
    if (!idxList.length) return;

    setIsRunning(true);
    setPerPersona(
      idxList.reduce(
        (acc, i) => {
          acc[i] = { status: "loading" };
          return acc;
        },
        {} as Record<number, PersonaStatus>,
      ),
    );

    await Promise.all(
      idxList.map(async (i) => {
        try {
          const res = await fetch("/api/survey", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ persona: personas[i], brand: selectedBrand }),
          });
          const data = await res.json();
          if (!res.ok || !data?.ok) {
            throw new Error(data?.error || `HTTP ${res.status}`);
          }
          setPerPersona((prev) => ({
            ...prev,
            [i]: { status: "ok", scores: data.scores as SurveyScores },
          }));
        } catch (e: unknown) {
          setPerPersona((prev) => ({
            ...prev,
            [i]: { status: "error", error: getErrorMessage(e) || "실패" },
          }));
        }
      }),
    );

    setIsRunning(false);
  }

  const stats = useMemo(() => {
    const ok = Object.entries(perPersona)
      .map(([idx, st]) => ({ idx: Number(idx), st }))
      .filter((x) => x.st.status === "ok") as Array<{
      idx: number;
      st: { status: "ok"; scores: SurveyScores };
    }>;

    const n = ok.length || 0;
    const countsA = [0, 0, 0, 0, 0, 0];
    const countsI = [0, 0, 0, 0, 0, 0];
    const countsP = [0, 0, 0, 0, 0, 0];

    let sumA = 0;
    let sumI = 0;
    let sumP = 0;

    for (const { st } of ok) {
      const a = st.scores.awareness;
      const i = st.scores.interest;
      const p = st.scores.purchase_intent;
      sumA += a;
      sumI += i;
      sumP += p;
      countsA[a] += 1;
      countsI[i] += 1;
      countsP[p] += 1;
    }

    return {
      n,
      avgAwareness: n ? sumA / n : null,
      avgInterest: n ? sumI / n : null,
      avgPurchase: n ? sumP / n : null,
      distAwareness: countsA,
      distInterest: countsI,
      distPurchase: countsP,
    };
  }, [perPersona]);

  const runDisabled =
    !selectedBrand || !selectedIdx.size || isRunning || !personas.length;

  return (
    <div className="flex-1">
      <header className="mx-auto max-w-6xl px-6 pt-8">
        <div className="flex items-center gap-3">
          <h1 className="text-[18px] font-medium tracking-tight">
            Nemotron × SweetSpot
          </h1>
          <span className="rounded-md border border-[var(--accent)] px-2 py-[3px] font-mono text-[10px] text-[var(--accent)]">
            ● LIVE API
          </span>
          <span className="rounded-md border border-[#333] px-2 py-[3px] font-mono text-[10px] text-[#666]">
            HuggingFace + Claude
          </span>
        </div>
        <p className="mt-1 border-b border-[var(--border)] pb-6 font-mono text-[11px] text-[#444]">
          datasets-server.huggingface.co → nvidia/Nemotron-Personas-Korea →
          Anthropic Claude (서버 라우트)
        </p>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-16 pt-8 lg:grid-cols-[320px_1fr]">
        {/* LEFT */}
        <section className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                페르소나 필터
              </div>
              <div className="rounded-md border border-[var(--border)] px-2 py-[2px] font-mono text-[10px] text-[var(--muted)]">
                {hfMeta.total != null
                  ? `${hfMeta.total.toLocaleString()}명`
                  : "—"}
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  성별
                </label>
                <select
                  value={filterSex}
                  onChange={(e) =>
                    setFilterSex(e.target.value as "" | "female" | "male")
                  }
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-[12px] text-[var(--text)] outline-none focus:border-[#444]"
                >
                  <option value="">전체</option>
                  <option value="female">여성</option>
                  <option value="male">남성</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  나이대
                </label>
                <div className="grid grid-cols-[1fr_18px_1fr] items-center gap-2">
                  <input
                    type="number"
                    value={ageMin}
                    min={19}
                    max={99}
                    onChange={(e) => setAgeMin(Number(e.target.value))}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-[12px] text-[var(--text)] outline-none focus:border-[#444]"
                  />
                  <div className="text-center text-[12px] text-[var(--muted)]">
                    —
                  </div>
                  <input
                    type="number"
                    value={ageMax}
                    min={19}
                    max={99}
                    onChange={(e) => setAgeMax(Number(e.target.value))}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-[12px] text-[var(--text)] outline-none focus:border-[#444]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  지역(시/도)
                </label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-[12px] text-[var(--text)] outline-none focus:border-[#444]"
                >
                  {PROVINCES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  불러올 인원
                </label>
                <select
                  value={fetchCount}
                  onChange={(e) => setFetchCount(Number(e.target.value))}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-[12px] text-[var(--text)] outline-none focus:border-[#444]"
                >
                  <option value={3}>3명</option>
                  <option value={5}>5명</option>
                  <option value={8}>8명</option>
                </select>
              </div>

              <button
                onClick={onFetchPersonas}
                disabled={isFetching}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-left font-mono text-[11px] text-[var(--accent)] transition hover:bg-[#252525] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ↗ Nemotron에서 페르소나 불러오기
              </button>

              {hfMeta.where ? (
                <div className="rounded-md border border-[#222] bg-[#111] p-2 font-mono text-[10px] leading-5 text-[#3a3a3a]">
                  <div>GET /rows (client-side filter)</div>
                  <div>dataset: nvidia/Nemotron-Personas-Korea</div>
                  <div>where: {hfMeta.where}</div>
                </div>
              ) : null}

              {fetchError ? (
                <div className="rounded-md border border-[#2a1d1d] bg-[#120b0b] p-2 text-[12px] text-[var(--danger)]">
                  {fetchError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                페르소나 선택
              </div>
              <div className="rounded-md border border-[var(--border)] px-2 py-[2px] font-mono text-[10px] text-[var(--muted)]">
                {selectedIdx.size}명 선택
              </div>
            </div>
            <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
              {!personas.length ? (
                <div className="rounded-xl border border-dashed border-[#222] p-8 text-center font-mono text-[11px] leading-6 text-[#333]">
                  위에서 필터 설정 후
                  <br />
                  페르소나를 불러오세요
                </div>
              ) : (
                personas.map((p, i) => {
                  const isSel = selectedIdx.has(i);
                  const preview = (
                    p.professional_persona ||
                    p.persona ||
                    p.culinary_persona ||
                    ""
                  ).slice(0, 55);
                  const name = p.name || `페르소나 #${i + 1}`;
                  return (
                    <button
                      key={i}
                      onClick={() => togglePersona(i)}
                      className={[
                        "relative w-full rounded-lg border px-3 py-2 text-left transition",
                        isSel
                          ? "border-[var(--accent)] bg-[var(--surface2)]"
                          : "border-[var(--border)] bg-[var(--surface2)] hover:border-[#444]",
                      ].join(" ")}
                    >
                      <div className="text-[12px] font-medium">{name}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--muted)]">
                        {p.age}세 · {p.sex === "female" ? "여" : "남"} ·{" "}
                        {p.province || ""} · {p.occupation || ""}
                      </div>
                      <div className="mt-1 max-h-10 overflow-hidden text-[11px] leading-5 text-[#555]">
                        {preview}
                        {preview ? "..." : ""}
                      </div>
                      {isSel ? (
                        <div className="absolute right-3 top-2 font-mono text-[11px] text-[var(--accent)]">
                          ✓
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* RIGHT */}
        <section className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                브랜드 선택
              </div>
              <button
                onClick={() => setIsBrandModalOpen(true)}
                className="rounded-md border border-[var(--border)] bg-[var(--surface2)] px-2 py-1 font-mono text-[10px] text-[var(--accent2)] hover:border-[#444]"
              >
                + 브랜드 추가
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {brands.map((b) => {
                const sel = b.id === selectedBrandId;
                return (
                  <div
                    key={b.id}
                    className={[
                      "group relative cursor-pointer rounded-lg border p-3 transition",
                      sel
                        ? "border-[var(--accent2)] bg-[rgba(100,181,246,0.06)]"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[#444]",
                    ].join(" ")}
                    onClick={() => setSelectedBrandId(b.id)}
                  >
                    <div className="text-[12px] font-medium">{b.name}</div>
                    <div className="mt-1 text-[10px] leading-4 text-[var(--muted)]">
                      {b.tag}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBrand(b.id);
                      }}
                      className="absolute right-2 top-2 hidden rounded-md border border-[#2a2a2a] bg-[#121212] px-2 py-1 font-mono text-[10px] text-[#666] hover:border-[#444] group-hover:block"
                      title="삭제"
                    >
                      삭제
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={runSurvey}
            disabled={runDisabled}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-left font-mono text-[13px] font-medium text-[#0e0e0e] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            서베이 시뮬레이션 실행 — Claude API 호출
          </button>

          {/* RESULTS */}
          {!Object.keys(perPersona).length ? (
            <div className="rounded-xl border border-dashed border-[#222] p-10 text-center font-mono text-[11px] leading-6 text-[#333]">
              1. 페르소나 불러오기
              <br />
              2. 서베이할 페르소나 선택
              <br />
              3. 브랜드 선택 후 실행
              <br />
              <br />
              <span className="text-[#222]">
                Nemotron 데이터 → 서버에서 Claude가 페르소나로 응답
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  {selectedBrand?.name || "—"} — {selectedIdx.size}명 서베이 결과
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="text-center">
                    <div className="font-mono text-[28px] font-medium leading-none text-[var(--accent)]">
                      {stats.avgAwareness != null
                        ? stats.avgAwareness.toFixed(1)
                        : "—"}
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--muted)]">
                      브랜드 인지도 / 5
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-[28px] font-medium leading-none text-[var(--accent)]">
                      {stats.avgInterest != null
                        ? stats.avgInterest.toFixed(1)
                        : "—"}
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--muted)]">
                      관심도 / 5
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-[28px] font-medium leading-none text-[var(--accent)]">
                      {stats.avgPurchase != null
                        ? stats.avgPurchase.toFixed(1)
                        : "—"}
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--muted)]">
                      구매 의향 / 5
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <DistributionChart
                  title="인지도 분포(1~5)"
                  counts={stats.distAwareness}
                />
                <DistributionChart
                  title="관심도 분포(1~5)"
                  counts={stats.distInterest}
                />
                <DistributionChart
                  title="구매의향 분포(1~5)"
                  counts={stats.distPurchase}
                />
              </div>

              {Object.entries(perPersona)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([idxStr, st]) => {
                  const idx = Number(idxStr);
                  const p = personas[idx];
                  const name = p?.name || `페르소나 #${idx + 1}`;

                  if (st.status === "loading") {
                    return (
                      <div
                        key={idxStr}
                        className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                      >
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
                        <div className="font-mono text-[12px] text-[var(--muted)]">
                          {name} 응답 생성 중 (Claude API)...
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idxStr}
                      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
                    >
                      <div className="flex items-start justify-between border-b border-[var(--border)] bg-[var(--surface2)] px-4 py-3">
                        <div>
                          <div className="text-[12px] font-medium">{name}</div>
                          <div className="mt-1 font-mono text-[10px] text-[var(--muted)]">
                            {p.age}세 · {p.sex === "female" ? "여" : "남"} ·{" "}
                            {p.province || ""} · {p.occupation || ""}
                          </div>
                        </div>
                        <div className="text-right font-mono text-[9px] leading-4 text-[#333]">
                          Nemotron-Personas-Korea
                          <br />
                          nvidia / HuggingFace
                        </div>
                      </div>
                      <div className="p-4">
                        {st.status === "error" ? (
                          <div className="rounded-md border border-[#2a1d1d] bg-[#120b0b] p-2 text-[12px] text-[var(--danger)]">
                            오류: {st.error}
                          </div>
                        ) : (
                          <>
                            <div className="mb-3 border-l-2 border-[var(--accent)] pl-3 text-[13px] leading-7 text-[#ccc]">
                              “{st.scores.comment}”
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span
                                className={[
                                  "rounded-full border px-3 py-1 font-mono text-[10px]",
                                  chipClass(st.scores.awareness),
                                ].join(" ")}
                              >
                                인지도 {scoreText(st.scores.awareness)}
                              </span>
                              <span
                                className={[
                                  "rounded-full border px-3 py-1 font-mono text-[10px]",
                                  chipClass(st.scores.interest),
                                ].join(" ")}
                              >
                                관심도 {scoreText(st.scores.interest)}
                              </span>
                              <span
                                className={[
                                  "rounded-full border px-3 py-1 font-mono text-[10px]",
                                  chipClass(st.scores.purchase_intent),
                                ].join(" ")}
                              >
                                구매의향 {scoreText(st.scores.purchase_intent)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      </main>

      {/* BRAND MODAL */}
      {isBrandModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="font-mono text-[11px] text-[var(--muted)]">
                브랜드 추가(로컬 저장)
              </div>
              <button
                onClick={() => setIsBrandModalOpen(false)}
                className="rounded-md border border-[var(--border)] bg-[var(--surface2)] px-2 py-1 font-mono text-[10px] text-[#666] hover:border-[#444]"
              >
                닫기
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  브랜드명
                </label>
                <input
                  value={newBrand.name}
                  onChange={(e) =>
                    setNewBrand((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-[12px] text-[var(--text)] outline-none focus:border-[#444]"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  태그(한 줄)
                </label>
                <input
                  value={newBrand.tag}
                  onChange={(e) =>
                    setNewBrand((p) => ({ ...p, tag: e.target.value }))
                  }
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-[12px] text-[var(--text)] outline-none focus:border-[#444]"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  브랜드 설명
                </label>
                <textarea
                  value={newBrand.desc}
                  onChange={(e) =>
                    setNewBrand((p) => ({ ...p, desc: e.target.value }))
                  }
                  rows={5}
                  className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-[12px] leading-6 text-[var(--text)] outline-none focus:border-[#444]"
                />
              </div>

              {brandError ? (
                <div className="rounded-md border border-[#2a1d1d] bg-[#120b0b] p-2 text-[12px] text-[var(--danger)]">
                  {brandError}
                </div>
              ) : null}

              <div className="flex gap-2">
                <button
                  onClick={addBrand}
                  className="flex-1 rounded-md bg-[var(--accent2)] px-3 py-2 font-mono text-[12px] font-medium text-[#0e0e0e]"
                >
                  저장
                </button>
                <button
                  onClick={() => setIsBrandModalOpen(false)}
                  className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px] text-[#bbb] hover:border-[#444]"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
