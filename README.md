# Nemotron × SweetSpot — 브랜드 서베이 (MVP)

일본 디저트 브랜드를 **한국 소비자 페르소나 관점에서** 빠르게 검증하기 위한 서베이 시뮬레이션 웹앱입니다.

- 페르소나 데이터: HuggingFace datasets-server API (`nvidia/Nemotron-Personas-Korea`)
- 응답 생성(인지도/관심도/구매의향 + 한마디): Anthropic Claude (서버 라우트)
- 브랜드: 기본 3종 + **브라우저 로컬저장소** 기반 추가/삭제
- 시각화: 평균 + 1~5 분포 차트

## 1) 로컬 실행

```bash
npm install
cp .env.example .env.local
# .env.local 에 ANTHROPIC_API_KEY 입력
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 2) 환경변수

- 필수: `ANTHROPIC_API_KEY`
- 선택: `ANTHROPIC_MODEL` (기본값: `claude-sonnet-4-6`)

## 3) Vercel 배포(Import 방식)

1. 이 프로젝트를 GitHub 레포로 푸시
2. Vercel → **Add New… → Project → Import Git Repository**
3. Environment Variables에 아래를 추가
   - `ANTHROPIC_API_KEY` (필수)
   - `ANTHROPIC_MODEL` (선택)
4. Deploy

## 4) 구현 포인트(보안)

브라우저에서 Claude API를 직접 호출하지 않고,
Next.js 서버 라우트(`/api/survey`)에서 Anthropic SDK로 호출합니다.  
따라서 API 키는 Vercel의 환경변수로만 보관됩니다.

