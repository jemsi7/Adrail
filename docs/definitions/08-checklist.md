# 08. Checklist

- 상태: v0.5 locked
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
  - [x] 추가 bundled seed preset 3개 구현: Finance ops, Home energy, Creator tools

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
  - [x] bundled seed campaign 6개로 확장
- [x] custom demo preset builder 구현
- [x] custom preset이 User Chat과 Advertiser Console 양쪽에 반영
- [x] OpenRouter key 주입 구현
- [x] OpenRouter structured-output adapter 구현
- [x] key 없음 deterministic fixture fallback 구현
- [x] key 있음 User Chat preset selector 제거 및 OpenRouter live-only 경로 구현
- [x] live LLM 출력 schema/guard validation 구현
- [x] 영어 demo script 작성

## Phase 5. Hardening

- [ ] audit log viewer 구현
- [ ] abuse fixture 작성
- [ ] UI responsive check
  - [x] OpenRouter key 입력 UI 제거 후 fresh reload QA
  - [x] desktop route layout에서 User Chat / Advertiser Console 분리 상태 확인
  - [x] mobile first viewport에서 Sponsored label, advertiser, headline, CTA/dismiss 노출 확인
  - [x] Advertiser Console에 User Chat app shell 디자인/UX 언어 적용 및 desktop/mobile Browser QA
  - [x] Advertiser Console clustered controls를 Campaign / Policy / Custom / Review / Settlement / Script 단계별 뷰로 분리하고 desktop/mobile Browser QA
  - [x] Advertiser Dashboard를 Campaigns / Create / Targeting / Creative / Review / Settlement 광고 캠페인 워크플로우 순서로 재배치하고 desktop/mobile Browser QA
  - [x] Create workflow 내부를 Basics / Offer / Creative / Delivery 하위 단계별 뷰로 분리하고 Browser QA
  - [x] Create workflow에서 이전 하위 단계 필수 입력이 완료되기 전 다음 단계 이동 차단
  - [x] Create campaign 입력창 기본값을 Protocol Camp 데모 프리필로 전환하고 회귀 테스트 갱신
  - [x] Create campaign에서 seed 캠페인명(`Atlas Local Weekends` 등) 중복 생성 및 custom registry의 seed 캠페인 치환 방지 회귀 테스트 추가
  - [x] Advertiser Dashboard overview 복잡도 축소: 대형 workflow/status 카드 제거, compact campaign list로 전환, desktop/mobile Browser QA
  - [x] Safari native button appearance로 인한 Advertiser Dashboard campaign list/stepper grid 깨짐 수정 및 회귀 테스트 추가
  - [x] Advertiser Console Performance 탭 신설: attention signal breakdown을 settlement proof에서 분리하고 privacy-safe aggregate로 표시
  - [x] Performance 탭 pre-test empty state 추가: verified User Chat test event 전에는 attention 성과 데이터를 표시하지 않음
  - [x] Targeting 화면 복잡도 축소: 정책 입력 + compact preview 중심으로 단순화하고 Browser QA
  - [x] Campaigns 화면 Active 체크박스 초기 ready 상태 클릭 불능 회귀 수정 및 테스트 추가
  - [x] Campaigns 화면 선택 custom campaign 삭제 기능 추가 및 seed campaign 삭제 잠금 테스트 추가
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
- [x] 프로젝트명 Adrail 리브랜딩 반영
- [ ] contract edge case tests
- [ ] testnet deployment notes
- [x] 실제 testnet escrow 최종 계획 고정: `docs/definitions/09-testnet-escrow-final-plan.md`
- [x] 미니멀 User Chat 최종 계획 고정: `docs/definitions/10-minimal-chat-ui-final-plan.md`
- [x] Advertiser wallet funding dashboard 구현 순서 계획 고정: `docs/definitions/11-advertiser-wallet-funding-dashboard-plan.md`
- [x] advertiser funding wallet/account/ledger domain model 구현
- [x] advertiser funding DB schema 초안 구현
- [x] funding ledger reducer와 중복 attention debit 방지 테스트 작성
- [x] advertiser funding API boundary 구현: read, wallet validate, deposit submit
- [x] live settlement claim API boundary 구현: confirmed `SettlementClaimed` receipt를 `attention_debit` ledger로 기록
- [x] Advertiser Console wallet/address/amount funding panel 구현
- [x] deposit 및 attention debit history UI 구현
- [x] User Chat attention score가 threshold를 넘으면 live settlement claim 자동 제출
- [x] Advertiser Console에서 자동 청구된 wallet settlement history 반영
- [x] Settlement 탭 로드시 wallet balance와 funding history API refresh 구현
- [x] funding dashboard Browser QA
- [x] funding ledger API를 attention settlement asset spec에 기록
- [x] User Chat을 ChatGPT식 single conversation thread로 재구성
- [x] pre-answer sponsored message component 구현
- [x] sponsored message 후 service answer reveal 상태 구현
- [x] User Chat service answer streaming 구현: sponsored ad는 완성 응답 유지, answer만 SSE stream으로 표시
- [x] live LLM answer failure를 User Chat answer card에 표시
- [x] live LLM answer failure 상태에서 answer 하단 proof/action badges 제거
- [x] `Why this ad` / `Ad proof` compact drawer 구현
- [x] User Chat 첫 viewport에서 advertiser/review/settlement full panel 제거
- [x] `/advertiser-console` 회귀 QA
- [x] `/advertiser-console` LAN/external dev origin 클릭 불능 원인 수정: Next dev `allowedDevOrigins` LAN IPv4 자동 allowlist 및 `0.0.0.0` dev bind
- [ ] minimal chat desktop/mobile Browser QA
  - [x] desktop Safari Computer Use QA: sponsored-first flow, dismiss-to-answer reveal, disclosure drawer, advertiser-console smoke check
  - [x] provided reference alignment correction: appbar, preset selector, chat cards, proof chips, bottom composer
  - [x] `Why this ad` disclosure drawer reference alignment correction
  - [x] User Chat component/button shape reference pass: card radius, thin borders, CTA icon, proof chips, composer, full-width appbar
  - [x] User Chat Claude-like humanist typography pass: local Avenir Next first, softer weights, calmer line-height
  - [x] User Chat new chat reset control: English discard confirmation and clean empty-thread restart
  - [x] OpenRouter env configured User Chat opens directly on clean new-chat state instead of preloading seeded conversation/error UI
  - [x] composer file-attachment clip replaced with current model snippet and composer-specific desktop/mobile Browser check passed
  - [x] composer bottom anchoring correction: empty-thread and mobile layouts keep the input at the viewport bottom
  - [x] composer editable input correction: user question submit form updates the chat thread and live scenario request
  - [x] User Chat topbar `+` / Advertiser Console actions 오른쪽 정렬 Chrome QA
  - [x] Advertiser Console에서 생성/선택한 custom 광고 preset이 `/user-chat` active campaign으로 복원되도록 handoff 수정
  - [x] Performance 탭을 fixture score가 아니라 User Chat의 browser-session dwell / micro-interaction / CTA / follow-up 측정 snapshot 기반으로 표시
  - [x] OpenRouter embedding 호출 + cosine similarity 기반 live ad selection을 `/api/live-scenario`와 User Chat sponsored message 경로에 연결
  - [x] Campaigns 화면에 캠페인별 Fast Matching / Professional Matching 스위치와 현재 mode/status 표시 추가: 모든 active가 Fast면 embedding cosine, 하나라도 Professional이면 LLM이 전체 active 후보 중 직접 선택
  - [x] User Chat answer card에 answer-only retry control 추가: sponsored message/정산 경계는 재실행하지 않고 `/api/live-answer`만 다시 요청
  - [x] 광고 제출/후보 생성 시 interaction type별 prepared creative variant 생성 및 User Chat에서 choice result / slider visualization / short text result 렌더링
  - [ ] mobile Browser QA deferred by current desktop-only scope
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
- [x] 실제 testnet deploy address 기록
- [x] 실제 deposit tx hash 기록
- [x] 실제 settlement tx hash 기록
- [x] dashboard live receipt settlement status 확인
- [x] calldata/event/index privacy boundary 검증
- [x] 최종 E&C/L&C 정리
  - [ ] Computer Use UX review backlog triage: `/Users/aiden/aiden/L&C/SEABW-Hackathon2026/2026-05-20-computer-use-ux-review.md`

## When To Done Mapping

- 사용자 플로우 4개 통과: Phase 4 완료
- 광고/답변 경계 분리: Phase 1, Phase 2 완료
- 개인정보 보호 조건: Phase 1 완료
- 자연어 target policy 안전성: Phase 1, Phase 2 완료
- attention signal 정산: Phase 3 완료
- 영어 서비스 UI: Phase 4 완료
- 3개 이상 광고 테마: Phase 4 완료
- 신규 사용자 5초 내 구분: Phase 4 UI 검증 + Phase 5.2 minimal chat QA
