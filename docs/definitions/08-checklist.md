# 08. Checklist

- 상태: v0.4 locked
- 작성일: 2026-05-20

## Phase 0. Definition Lock

- [x] 초기 문제 정의 수집
- [x] 8개 definition document v0 생성
- [x] MVP 화면 범위 확정: user chat + advertiser console
- [x] 광고 배치 정책 확정: 답변 전 Interactive Sponsored Interstitial
- [x] privacy boundary 확정: platform-private vault + advertiser aggregate metrics only
- [x] settlement mode 확정: testnet smart contract escrow
- [x] target policy authoring 확정: English natural language
- [x] AI provider 확정: OpenRouter
- [x] context retention 확정: embedding/RAG + LLM adjudication
- [x] settlement score 확정: campaign별 dynamic policy
- [x] service language 확정: English
- [x] demo vertical 확정: 최소 3개 ad theme

## Phase 1. Core Data Model And Boundaries

- [x] campaign schema 정의
- [x] natural-language target policy schema 정의
- [x] compiled target policy schema 정의
- [x] ad pool item schema 정의
- [x] personal intelligence snapshot schema 정의
- [x] eligibility token schema 정의
- [x] sponsored interstitial schema 정의
- [x] sponsored interstitial interaction schema 정의
- [x] context retention evidence schema 정의
- [x] attention event schema 정의
- [x] dynamic settlement policy schema 정의
- [x] settlement event schema 정의
- [x] settlement proof schema 정의
- [x] contract transaction schema 정의
- [x] advertiser API에서 personal data 차단 테스트 작성
- [x] answer agent 입력에서 campaign data 차단 테스트 작성
- [x] ad interaction이 answer agent 입력을 오염시키지 않는 테스트 작성
- [x] natural-language target policy sensitive targeting 테스트 작성

## Phase 2. Ad Matching And Generation

- [x] natural-language target policy compiler 구현
- [x] sensitive targeting detector 구현
- [x] embedding query generator 구현
- [x] target policy matcher 구현
- [x] ad opportunity selector 구현
- [x] frequency cap 구현
- [x] interactive ad agent 구현
- [x] HTML/CSS/React scripted graphic renderer 구현
- [x] micro-interaction template 구현
- [x] policy guard 구현
- [x] sponsored interstitial renderer 구현
- [x] approved claim set validation 구현
- [x] no eligible campaign 상태 구현
- [x] 3개 이상 demo ad theme fixture 구현

## Phase 3. Attention And Testnet Settlement

- [x] dwell tracker 구현
- [x] realtime interaction tracker 구현
- [x] embedding/RAG context retention retriever 구현
- [x] LLM context retention adjudicator 구현
- [x] deep-link verifier 구현
- [x] dynamic attention score calculator 구현
- [x] dynamic settlement policy validator 구현
- [x] settlement trigger 구현
- [x] testnet escrow smart contract 구현
- [x] settlement transaction submitter 구현
- [x] contract event indexer 구현
- [x] duplicate settlement 방지 구현
- [x] settlement dashboard event 표시
- [x] transaction hash/status 표시

## Phase 4. Demo UX

- [x] user chat 화면 구현
- [x] advertiser console 구현
- [x] User Chat 별도 route 구현
- [x] Advertiser Console 별도 route 구현
- [x] natural-language target policy editor 구현
- [x] compiled policy preview 구현
- [x] platform review console 구현
- [x] settlement dashboard 구현
- [x] privacy disclosure drawer 구현
- [x] pre-answer interactive sponsored interstitial 구현
- [x] opt-out/dismiss interaction 구현
- [x] 3개 이상 demo seed campaign 작성
- [x] 3개 seed campaign을 확장 가능한 preset registry로 전환
- [x] custom demo preset builder 구현
- [x] custom preset이 User Chat과 Advertiser Console 양쪽에 반영
- [x] OpenRouter session key 입력 구현
- [x] OpenRouter structured-output adapter 구현
- [x] key 없음 deterministic fixture fallback 구현
- [x] live LLM 출력 schema/guard validation 구현
- [x] 영어 demo script 작성

## Phase 5. Hardening

- [ ] audit log viewer 구현
- [ ] abuse fixture 작성
- [ ] UI responsive check
  - [x] `OpenRouterKeyControl` runtime blocker 해결 후 fresh reload QA
  - [x] desktop route layout에서 User Chat / Advertiser Console 분리 상태 확인
  - [x] mobile first viewport에서 Sponsored label, advertiser, headline, CTA/dismiss 노출 확인
- [ ] accessibility pass
  - [x] ad disclosure drawer initial focus 이동 및 Escape close 구현
  - [ ] full focus trap / background inert 처리
  - [x] tab/theme active state ARIA 보강
- [x] Nielsen usability heuristics pass
  - [x] `docs/ux/nielsen-usability-heuristics.md` 기준으로 User Chat 점검
  - [x] `docs/ux/nielsen-usability-heuristics.md` 기준으로 Advertiser Console 점검
  - [x] `docs/ux/nielsen-usability-heuristics.md` 기준으로 Settlement/Disclosure flow 점검
  - [x] 10원칙 기반 UX redesign 적용: 상태 rail, stale/error feedback, readable status copy, proof affordance, dismiss/not relevant outcome 분리
- [ ] README 작성
- [ ] contract edge case tests
- [ ] testnet deployment notes
- [x] 실제 testnet escrow 최종 계획 고정: `docs/definitions/09-testnet-escrow-final-plan.md`
- [x] app string id to bytes32 encoding rule 구현
- [x] `policyHash`/`proofHash` bytes32 normalization 구현
- [x] Hardhat compile/test/deploy toolchain 추가
- [x] `AttentionEscrow` campaign overwrite 방지 구현
- [x] `AttentionEscrow` duplicate attention event 방지 구현
- [x] `AttentionEscrow` zero payout/zero recipient/threshold range 검증 구현
- [x] `AttentionEscrow` payout call 및 실패 revert 구현
- [x] contract deposit/claim/reject/refund edge-case tests 작성
- [x] live campaign deposit gateway 구현
- [x] `CampaignDeposited` receipt parser/indexer 구현
- [x] live settlement claim gateway 구현
- [x] `SettlementClaimed` live receipt parser/indexer 구현
- [x] `SETTLEMENT_MODE=simulated|testnet` gateway selection 구현
- [x] `.env.example` testnet settlement placeholders 갱신
- [x] testnet deploy runbook 작성
- [ ] 실제 testnet deploy address 기록
- [ ] 실제 deposit tx hash 기록
- [ ] 실제 settlement tx hash 기록
- [ ] dashboard live receipt settlement status 확인
- [x] calldata/event/index privacy boundary 검증
- [ ] 최종 E&C/L&C 정리
  - [ ] Computer Use UX review backlog triage: `/Users/aiden/aiden/L&C/SEABW-Hackathon2026/2026-05-20-computer-use-ux-review.md`

## When To Done Mapping

- 사용자 플로우 4개 통과: Phase 4 완료
- 광고/답변 경계 분리: Phase 1, Phase 2 완료
- 개인정보 보호 조건: Phase 1 완료
- 자연어 target policy 안전성: Phase 1, Phase 2 완료
- attention signal 정산: Phase 3 완료
- 영어 서비스 UI: Phase 4 완료
- 3개 이상 광고 테마: Phase 4 완료
- 신규 사용자 5초 내 구분: Phase 4 UI 검증
