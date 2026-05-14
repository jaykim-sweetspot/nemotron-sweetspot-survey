import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { Brand, Persona, SurveyScores } from "@/lib/types";

export const runtime = "nodejs";

const BodySchema = z.object({
  persona: z.any(),
  brand: z.any(),
});

const PersonaSchema = z.object({
  name: z.string().optional(),
  age: z.number(),
  sex: z.enum(["female", "male"]),
  province: z.string().optional(),
  district: z.string().optional(),
  occupation: z.string().optional(),
  education_level: z.string().optional(),
  marital_status: z.string().optional(),
  family_type: z.string().optional(),
  professional_persona: z.string().optional(),
  culinary_persona: z.string().optional(),
  travel_persona: z.string().optional(),
  persona: z.string().optional(),
});

const BrandSchema = z.object({
  id: z.string(),
  name: z.string(),
  tag: z.string(),
  desc: z.string(),
});

const ScoresSchema = z.object({
  awareness: z.number().int().min(1).max(5),
  interest: z.number().int().min(1).max(5),
  purchase_intent: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(80),
});

function buildPersonaContext(p: Persona) {
  return [p.professional_persona, p.culinary_persona, p.travel_persona, p.persona]
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? text;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return candidate.slice(first, last + 1);
}

export async function POST(req: Request) {
  try {
    const parsedBody = BodySchema.parse(await req.json());
    const persona = PersonaSchema.parse(parsedBody.persona) as Persona;
    const brand = BrandSchema.parse(parsedBody.brand) as Brand;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const model =
      process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";

    const anthropic = new Anthropic({ apiKey });

    const name = persona.name || "익명";
    const personaContext = buildPersonaContext(persona);

    const systemPrompt = `당신은 다음 한국인 페르소나입니다. 이 정체성을 완전히 유지하여 응답하세요.

[인적 사항]
이름: ${name} | 나이: ${persona.age}세 | 성별: ${
      persona.sex === "female" ? "여성" : "남성"
    }
지역: ${persona.province || ""} ${persona.district || ""} | 직업: ${
      persona.occupation || ""
    } | 학력: ${persona.education_level || ""}
결혼: ${persona.marital_status || ""} | 가족: ${persona.family_type || ""}

[페르소나 설명]
${personaContext}

[응답 규칙]
- 이 페르소나로서 자연스러운 한국어로 응답
- 실제 소비자처럼 솔직하고 구체적으로 응답
- JSON만 반환, 다른 텍스트 없이`;

    const userPrompt = `다음 일본 디저트 브랜드에 대한 당신의 솔직한 반응을 평가해주세요.

브랜드명: ${brand.name}
브랜드 설명: ${brand.desc}

아래 JSON 형식으로만 응답하세요 (마크다운 없이):
{
  "awareness": 1~5 정수 (1=전혀모름, 3=들어봤음, 5=매우잘앎),
  "interest": 1~5 정수 (1=전혀없음, 3=약간있음, 5=매우높음),
  "purchase_intent": 1~5 정수 (1=절대안삼, 3=고려해볼수도, 5=무조건삼),
  "comment": "이 페르소나 입장에서 솔직한 한 마디 (40자 이내)"
}`;

    const resp = await anthropic.messages.create({
      model,
      max_tokens: 250,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = resp.content
      .map((c) => ("text" in c ? c.text : ""))
      .join("\n")
      .trim();

    const jsonText = extractJsonObject(text);
    if (!jsonText) {
      return NextResponse.json(
        { error: "Claude 응답에서 JSON을 추출하지 못했습니다.", raw: text },
        { status: 502 },
      );
    }

    let scores: SurveyScores;
    try {
      scores = ScoresSchema.parse(JSON.parse(jsonText)) as SurveyScores;
    } catch {
      return NextResponse.json(
        { error: "Claude JSON 파싱/검증 실패", raw: text, extracted: jsonText },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, scores });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}
