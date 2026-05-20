# 06. Test Strategy

- 상태: v0.3 locked
- 작성일: 2026-05-20

## 테스트 원칙

- 광고/답변 분리는 단위 테스트로 검증한다.
- attention signal은 deterministic fixture로 재현 가능해야 한다.
- 개인정보가 광고주 응답에 섞이지 않는지 테스트한다.
- 자연어 target policy가 민감정보 타겟팅으로 컴파일되지 않는지 테스트한다.
- 전면광고 interaction이 Answer Agent 입력을 오염시키지 않는지 테스트한다.
- embedding/RAG + LLM context retention은 fixture와 live smoke를 분리한다.
- dynamic settlement policy는 weight/threshold validation과 score 계산을 모두 테스트한다.
- testnet smart contract settlement는 transaction hash와 emitted event를 검증한다.
- UI는 Playwright로 반복 검증하고, 최종 데모 QA는 Computer Use로 확인한다.

## 테스트 도구

- Unit/integration: Vitest
- UI automation: Playwright
- Final autonomous QA: Computer Use
- LLM 비결정성 대응: golden fixture 기본, live smoke optional

## 단계별 전략

### 1. Unit Tests

대상:

- natural-language target policy compilation
- prohibited sensitive targeting detection
- target policy AST matching
- embedding query generation fixture
- ad opportunity ranking
- sponsored interstitial schema validation
- sponsored interstitial interaction schema validation
- dwell time threshold
- realtime interaction event scoring
- embedding/RAG context retention evidence retrieval
- LLM adjudicator fixture parsing
- deep-link verification
- dynamic attention score calculation
- settlement policy weight/threshold validation
- settlement trigger
- settlement proof serialization
- smart contract event parsing
- pseudonymous id generation

잡아야 할 오류:

- 부적격 광고 노출
- 자연어 타겟 정책의 민감정보 타겟팅 누락
- frequency cap 무시
- attention score 오산
- 개인정보 필드 leakage
- sponsored label 누락
- ad interaction result가 Answer Agent 입력으로 섞임
- dynamic settlement policy weight 합이 1.0이 아님

### 2. Integration Tests

대상:

- advertiser natural-language target policy to compiled policy
- user conversation to personal intelligence update
- campaign upload to review to eligible ad pool
- ad opportunity to pre-answer sponsored interstitial rendering
- sponsored interstitial interaction to attention event
- follow-up question to embedding/RAG + LLM context retention score
- attention event to dynamic settlement policy decision
- attention event to testnet settlement transaction
- smart contract event to dashboard status

잡아야 할 오류:

- 답변 모델에 campaign data가 전달되는 문제
- ad interaction 결과가 answer agent 입력으로 전달되는 문제
- 광고 생성기가 승인되지 않은 claim을 생성하는 문제
- dismissed ad가 반복 노출되는 문제
- settlement proof 없는 payout 생성
- dynamic settlement policy hash와 on-chain proof가 불일치

### 3. Autonomous UI Tests

대상:

- user chat
- advertiser console
- platform review console
- settlement dashboard
- disclosure drawer

검증:

- 영어 UI copy 노출
- 답변 전 전면광고와 이후 답변의 시각적 분리
- sponsored label 노출
- 자연어 target policy 입력과 compiled summary preview
- 최소 3개 demo ad theme 선택/노출
- micro-interaction 후 광고 state 갱신
- CTA 동작
- opt-out 동작
- transaction hash/status 표시
- 모바일/데스크톱 레이아웃

### 4. Manual Demo Test

데모 시나리오:

1. 사용자가 영어로 여행/생산성/온라인 학습 중 하나의 니즈를 대화로 드러낸다.
2. 광고주는 Console에서 영어 자연어 target policy, 필수 노출 특징, dynamic settlement policy, escrow budget을 등록한다.
3. 시스템이 자연어 target policy를 compiled policy로 변환하고 review 상태를 표시한다.
4. 광고주 deposit transaction이 testnet에 생성된다.
5. 사용자가 질문을 제출하면 시스템이 답변 전 Interactive Sponsored Interstitial을 보여준다.
6. 사용자가 micro-interaction 또는 CTA를 수행한다.
7. 서비스 답변이 광고와 분리되어 표시된다.
8. 사용자의 후속 질문을 embedding/RAG + LLM으로 context retention 평가한다.
9. settlement dashboard에 attention proof, dynamic policy hash, testnet transaction hash, payout event가 생성된다.

## 필수 테스트 진입점

- `compileNaturalLanguageTargetPolicy(input)`
- `detectSensitiveTargeting(policy)`
- `calculateAttentionScore(input, settlementPolicy)`
- `validateDynamicSettlementPolicy(policy)`
- `matchesTargetPolicy(policy, eligibilityToken)`
- `selectAdOpportunity(input)`
- `validateSponsoredInterstitial(interstitial)`
- `scoreRealtimeInteraction(event)`
- `retrieveContextRetentionEvidence(input)`
- `adjudicateContextRetention(input)`
- `createSettlementEvent(attentionProof)`
- `submitSettlementTransaction(settlementProof)`
- `parseSettlementContractEvent(txReceipt)`

## E&C 기록 기준

다음 오류는 즉시 `/Users/aiden/aiden/E&C/SEABW-Hackathon2026/`에 기록한다.

- 광고와 답변 경계가 깨짐
- 개인정보가 광고주 화면/API에 노출됨
- 자연어 target policy가 민감정보 타겟팅을 통과함
- attention 없이 settlement 발생
- sponsored label 누락
- 심사되지 않은 claim 생성
- 전면광고 interaction이 service answer에 영향을 줌
- dynamic settlement policy hash 불일치
- testnet transaction은 성공했지만 dashboard status가 반영되지 않음

## Open Decisions

- 없음.
