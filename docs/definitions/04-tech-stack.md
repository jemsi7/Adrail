# 04. Tech Stack

- 상태: v0.3 locked
- 작성일: 2026-05-20

## Locked Stack

### Frontend / App

- Next.js single app
- TypeScript
- Tailwind CSS
- UI 상태: React state 또는 Zustand
- Service language: English

선택 근거:

- User Chat, Advertiser Console, Settlement Dashboard, API route를 한 앱에서 빠르게 통합할 수 있다.
- Interactive Sponsored Interstitial을 JSON schema 기반 HTML/CSS/React scripted component로 렌더링하기 쉽다.
- 해커톤 데모에 적합하다.

### Backend

- Next.js route handlers
- Node.js TypeScript
- 데이터 저장: SQLite
- ORM: Drizzle

선택 근거:

- campaign, attention event, settlement event, contract transaction의 관계형 모델링이 필요하다.
- SQLite는 로컬 데모와 테스트에 충분하고, Drizzle은 Postgres 이전 경로가 단순하다.

### AI Layer

- Provider: OpenRouter
- Answer Agent
- Natural Language Target Policy Compiler
- Ad Mediator
- Interactive Ad Agent
- Embedding/RAG Context Retention Engine
- LLM Context Retention Adjudicator

구현 방식:

- OpenRouter adapter를 기본 provider로 둔다.
- 네트워크나 key가 없어도 demo fixture로 동작 가능한 fallback을 유지한다.
- fixture는 answer, ad generation, target policy compilation, context retention scoring을 모두 지원한다.

### Settlement

- MVP 필수: EVM-compatible testnet smart contract escrow
- Toolchain: Solidity + Hardhat
- local DB: on-chain event index, tx status cache, demo read model

선택 근거:

- web3 해커톤 맥락에서 attention-based ad escrow를 실제 testnet transaction으로 증명한다.
- Hardhat은 TypeScript, Next.js, ABI/deploy script 연동이 쉽다.
- 개인정보 원문은 on-chain에 올리지 않고, pseudonymous proof와 settlement event만 기록한다.

### Privacy/Matching

- MVP: platform-private vault + platform-private matching service
- 확장: local-first matching, TEE, ZK proof, private set intersection 검토

## 데이터 저장소

권장 테이블:

- users
- user_consent_settings
- personal_intelligence_snapshots
- advertisers
- campaigns
- natural_language_target_policies
- compiled_target_policies
- ad_pool_items
- ad_opportunities
- sponsored_interstitials
- context_retention_evidence
- attention_events
- dynamic_settlement_policies
- settlement_events
- audit_logs
- contract_transactions

## 주요 타입

```ts
type NaturalLanguageTargetPolicy = {
  id: string;
  campaignId: string;
  language: "en";
  sourceText: string;
  submittedByAdvertiserId: string;
  createdAt: string;
};

type CompiledTargetPolicy = {
  id: string;
  campaignId: string;
  sourcePolicyId: string;
  ast: Record<string, unknown>;
  embeddingQueries: string[];
  prohibitedSensitiveSignals: string[];
  compiledSummary: string;
  safetyVerdict: "approved" | "needs_review" | "blocked";
  policyHash: string;
  compilerVersion: string;
};

type SponsoredInterstitial = {
  id: string;
  campaignId: string;
  advertiserName: string;
  label: "Sponsored";
  headline: string;
  body: string;
  visualSpec: Record<string, unknown>;
  interactionSpec: {
    type: "choice" | "slider" | "short_text";
    prompt: string;
    allowedOutputs: string[];
  };
  cta: {
    label: string;
    actionType: "agent_deeplink" | "external_link";
    target: string;
  };
  disclosure: {
    whyShown: string;
    dataBoundary: string;
  };
};

type DynamicSettlementPolicy = {
  id: string;
  campaignId: string;
  dwellWeightBps: number;
  interactionWeightBps: number;
  retentionWeightBps: number;
  deepLinkWeightBps: number;
  thresholdBps: number;
  version: number;
  policyHash: string;
};

type SettlementProof = {
  campaignId: string;
  attentionEventId: string;
  settlementPolicyHash: string;
  signalTypes: Array<"dwell" | "realtime_interaction" | "context_retention" | "deep_link">;
  scoreBps: number;
  thresholdBps: number;
  pseudonymousUserProof: string;
  occurredAt: string;
};
```

## 버전 핀

실제 패키지 설치 시 `package-lock.json` 또는 동등한 lockfile로 고정한다.

## 검토한 대안

### Simulated settlement first

- 장점: 구현 난이도가 낮고 UI 데모가 빠르다.
- 단점: attention-based escrow라는 핵심 차별점이 약해진다.
- 결론: 제외. MVP부터 testnet smart contract를 포함한다.

### Full mainnet settlement first

- 장점: 실제 결제/정산 모델까지 보여줄 수 있다.
- 단점: 법률, 비용, 보안 리스크가 해커톤 MVP 범위를 넘는다.
- 결론: 제외. testnet까지만 포함한다.

### 광고를 답변 본문에 삽입

- 장점: 클릭률과 주목도가 높을 가능성
- 단점: 문제 정의와 충돌
- 결론: 제외

### 광고주 target policy를 JSON/form으로만 입력

- 장점: 검증과 구현이 쉽다.
- 단점: 광고주 사용성이 떨어지고 Agentic 광고 시스템의 자연어 인터페이스 강점이 약해진다.
- 결론: 제외. 광고주는 영어 자연어로 작성하고, 시스템이 내부 구조로 컴파일한다.

## Open Decisions

- 없음.
