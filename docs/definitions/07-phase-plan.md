# 07. Phase Plan

- 상태: v0.4 locked
- 작성일: 2026-05-20

## Phase 0. Definition Lock

목표: 비가역 결정을 먼저 합의한다.

산출물:

- 8개 definition document 확정
- MVP 범위 확정
- 광고/답변 분리 원칙 확정
- privacy boundary 확정
- settlement mode 확정
- user chat + advertiser console MVP 범위 확정
- English service language 확정
- OpenRouter provider 확정
- 최소 3개 demo ad theme 확정

주요 결정:

- 광고 배치 정책: 답변 전 Interactive Sponsored Interstitial
- Target policy authoring: English natural language
- MVP settlement 방식: testnet smart contract escrow
- Settlement score: campaign별 dynamic policy
- MVP 화면 범위: user chat + advertiser console
- Personal Intelligence 저장 위치: platform-private vault
- Demo ad themes: travel/local experiences, productivity/SaaS, online learning/upskilling

## Phase 1. Core Data Model And Boundaries

목표: 데이터 모델과 시스템 경계를 고정한다.

산출물:

- campaign/ad pool schema
- natural-language target policy schema
- compiled target policy schema
- personal intelligence snapshot schema
- eligibility token schema
- sponsored interstitial schema
- sponsored interstitial interaction schema
- context retention evidence schema
- attention event schema
- dynamic settlement policy schema
- settlement event schema
- settlement proof schema
- contract transaction schema

검증:

- 답변 모델 입력에 campaign field가 없는지 테스트
- ad interaction 결과가 Answer Agent 입력으로 전달되지 않는지 테스트
- 광고주 API 응답에 personal data가 없는지 테스트
- 자연어 target policy가 민감정보 타겟팅으로 컴파일되지 않는지 테스트

## Phase 2. Ad Matching And Interactive Generation

목표: 광고주 자연어 target policy를 컴파일하고, 대화 맥락에 맞는 광고를 답변 전 interactive interstitial로 생성한다.

산출물:

- natural-language target policy compiler
- sensitive targeting detector
- embedding query generator
- target policy matcher
- ad opportunity selector
- interactive ad agent
- HTML/CSS/React scripted graphic renderer
- micro-interaction template
- policy guard
- sponsored interstitial renderer

검증:

- 부적격 campaign 필터링
- sponsored label 강제
- approved claim set 밖 문구 차단
- ad interaction 결과가 Answer Agent 입력으로 전달되지 않음
- 최소 3개 demo ad theme fixture 동작

## Phase 3. Attention And Testnet Settlement

목표: attention signal을 계산하고 testnet smart contract 정산 이벤트를 만든다.

산출물:

- dwell tracker
- realtime interaction tracker
- embedding/RAG context retention retriever
- LLM context retention adjudicator
- deep-link verifier
- dynamic attention score calculator
- dynamic settlement policy validator
- testnet escrow smart contract
- settlement transaction submitter
- contract event indexer

검증:

- threshold 미달 시 정산 없음
- campaign별 dynamic weight/threshold 반영
- deep-link 발생 시 정산 가능
- testnet transaction hash 생성
- contract event가 dashboard에 반영
- invalid event 중복 정산 방지

## Phase 4. Demo UX

목표: 해커톤 심사자가 한 번에 이해할 수 있는 영어 데모를 만든다.

산출물:

- user chat demo
- advertiser console
- natural-language target policy editor
- compiled policy preview
- platform review console
- settlement dashboard
- privacy disclosure drawer
- pre-answer interactive sponsored interstitial
- 3개 이상 demo seed campaign
- demo script

검증:

- 전체 happy path 1분 내 시연 가능
- 영어 UI/광고/대화 copy 확인
- 광고/답변 분리 즉시 인지 가능
- privacy boundary 설명 가능
- 광고주 캠페인 등록부터 사용자 광고 경험과 testnet 정산까지 한 흐름으로 연결
- 3개 광고 테마 전환 가능

### Phase 4.1. Demo Structure Retrofit

목표: User Chat과 Advertiser Console을 별도 화면으로 분리하고, 3개 seed 광고를 확장 가능한 preset registry로 바꾼다.

산출물:

- `/user-chat` route
- `/advertiser-console` route
- default 3 preset registry
- custom demo preset builder
- preset persistence via browser localStorage
- OpenRouter key session input
- OpenRouter structured-output adapter
- live policy compile / answer / sponsored copy refresh API

검증:

- 3개 seed 외 custom preset 추가 가능
- custom preset이 User Chat과 Advertiser Console 양쪽에 표시
- key 없음: deterministic fixture fallback
- key 있음: OpenRouter structured output 호출 후 schema/guard 통과 결과만 반영
- `npm test`, `npm run typecheck` 통과

## Phase 5. Hardening

목표: 남은 위험을 줄인다.

산출물:

- audit log viewer
- abuse case fixtures
- UI polish
- README/demo script
- contract edge case tests
- testnet deployment notes

### Phase 5.1. Real Testnet Escrow Completion

목표: deterministic settlement scaffold를 실제 EVM-compatible testnet escrow로 전환한다.

기준 문서:

- `docs/definitions/09-testnet-escrow-final-plan.md`

산출물:

- contract id/hash encoding rule
- Hardhat compile/test/deploy toolchain
- hardened `AttentionEscrow` contract
- contract edge-case tests
- live campaign deposit gateway
- live settlement claim gateway
- live receipt parser/indexer
- testnet deploy runbook
- `.env.example` settlement placeholders

검증:

- Solidity compile 통과
- contract edge-case tests 통과
- 실제 testnet `CampaignDeposited` tx/event 확인
- 실제 testnet `SettlementClaimed` tx/event 확인
- dashboard가 live receipt 기반 settlement status 표시
- raw transcript/profile/direct user id가 calldata/event/index에 없음

## Required Completion Phase

MVP 완료 기준은 Phase 4까지다. Phase 3까지만 완료된 상태는 testnet settlement core는 있으나 제품 데모로 완료되지 않은 상태로 본다.

## Open Decisions

- 없음.
