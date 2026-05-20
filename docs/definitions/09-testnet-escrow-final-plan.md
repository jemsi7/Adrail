# 09. Testnet Escrow Final Plan

- 상태: v1.0 locked
- 작성일: 2026-05-20
- 프로젝트: AI Agentic 광고시스템
- 결정: MVP 신뢰형 testnet smart contract escrow 완성

## 목적

현재 settlement 구현은 attention proof, deterministic transaction gateway, fixture receipt indexing까지는 동작한다. 그러나 When-To-Done의 "testnet smart contract escrow" 조건은 실제 배포된 EVM testnet contract, deposit transaction, settlement transaction, emitted event receipt, dashboard indexing까지 포함한다.

이 문서는 deterministic settlement scaffold를 실제 testnet escrow로 전환하기 위한 최종 구현 순서를 고정한다.

## 관련 기록

- E&C: `/Users/aiden/aiden/E&C/SEABW-Hackathon2026/2026-05-20-testnet-escrow-review-gaps.md`
- L&C: `/Users/aiden/aiden/L&C/SEABW-Hackathon2026/2026-05-20-phase3-attention-settlement.md`
- 관련 코드:
  - `contracts/AttentionEscrow.sol`
  - `src/domain/attention.ts`
  - `src/domain/settlement.ts`
  - `src/domain/demo-ux.ts`
  - `tests/phase3-attention-settlement.test.ts`

## 최종 선택지

선택: MVP 신뢰형 escrow 완성.

제외한 선택지:

- 최소 데모형 live tx 연결: tx hash는 빠르게 만들 수 있으나 escrow overwrite, duplicate attention event, deploy/test 부재를 설명하기 어렵다.
- 프로덕션 지향 escrow: role governance, upgradeability, mainnet-grade audit까지 확장하면 해커톤 MVP 범위를 넘는다.

## MVP Trust Model

- testnet 전용이다.
- platform settlement signer가 `claimSettlement`를 호출한다.
- advertiser는 campaign escrow에 testnet token을 deposit한다.
- raw transcript, raw profile, direct user id는 calldata, event, receipt, local index에 포함하지 않는다.
- MVP에서는 policy hash를 in-place mutation하지 않는다. settlement policy가 바뀌면 새 policy version에 대응하는 새 escrow key 또는 새 campaign escrow를 사용한다.
- 이 구조는 production trustless escrow가 아니라, attention proof와 on-chain settlement boundary를 증명하는 MVP escrow다.

## 고정 구현 순서

### Step 1. Contract Boundary Lock

비가역 경계부터 고정한다.

산출물:

- app string id to `bytes32` 변환 규칙
- `campaignId`, `attentionEventId`, `policyHash`, `proofHash` on-chain encoding 규칙
- contract event schema
- campaign lifecycle 정의
- settlement signer 권한 정의

고정 규칙:

- plain string domain id는 `keccak256(utf8(id))`로 `bytes32` 변환한다.
- 이미 32-byte hex인 `policyHash`, `proofHash`는 hex bytes32로 정규화한다.
- `campaignId`와 `attentionEventId` 원문 문자열은 on-chain에 올리지 않는다.
- local DB는 원문 id와 bytes32 hash mapping을 보관한다.

검증:

- 같은 id는 항상 같은 bytes32가 된다.
- 서로 다른 id는 서로 다른 bytes32가 된다.
- hash normalization은 `0x` prefix 유무와 대소문자 차이를 흡수한다.

### Step 2. Solidity Toolchain 추가

산출물:

- `hardhat.config.ts`
- contract compile/test scripts
- deploy script skeleton
- package scripts:
  - `contract:compile`
  - `contract:test`
  - `contract:deploy:testnet`

원칙:

- package version은 install 시 lockfile로 고정한다.
- secret은 `.env`에만 두고 커밋하지 않는다.
- `.env.example`에는 placeholder만 추가한다.

검증:

- `npm run contract:compile` 통과
- 기존 `npm test`, `npm run typecheck` 통과

### Step 3. AttentionEscrow Contract Hardening

현재 contract source를 MVP escrow 기준으로 보강한다.

필수 변경:

- empty `campaignId`, `policyHash`, `attentionEventId`, `proofHash` reject
- empty deposit reject 유지
- `payoutAmount == 0` reject
- `recipient == address(0)` reject
- 같은 `campaignId`에 대해 다른 advertiser가 escrow를 overwrite하지 못하게 차단
- 같은 `campaignId`에 대해 다른 `policyHash`로 active escrow를 overwrite하지 못하게 차단
- 동일 `proofHash` 중복 settlement 차단 유지
- 동일 `(campaignId, attentionEventId)` 중복 settlement 차단 추가
- insufficient escrow reject 유지
- `scoreBps < thresholdBps` reject 유지
- `thresholdBps` 허용 범위 검증
- payout은 state update 후 external call로 수행
- payout 실패 시 revert

권장 변경:

- `CampaignClosed` event 추가
- `CampaignRefunded` event 추가
- owner-mediated close/refund 함수 추가

MVP에서 하지 않는 것:

- mainnet deployment
- upgradeable proxy
- decentralized dispute resolution
- user direct reward wallet

### Step 4. Contract Unit Tests

Hardhat test를 먼저 작성해 contract 자체를 고정한다.

필수 테스트:

- deposit emits `CampaignDeposited`
- same advertiser can top up same campaign with same policy hash
- zero deposit reverts
- other advertiser cannot overwrite active campaign escrow
- same advertiser cannot overwrite active campaign with different policy hash
- non-owner cannot claim settlement
- inactive campaign claim reverts
- policy hash mismatch reverts
- score below threshold reverts
- zero payout reverts
- zero recipient reverts
- insufficient escrow reverts
- duplicate proof hash reverts
- duplicate attention event reverts
- successful claim emits `SettlementClaimed`
- successful claim decreases escrow balance
- refund path emits expected event if refund is implemented

검증:

- `npm run contract:test` 통과

### Step 5. TypeScript Encoding And ABI Integration

contract와 app 사이의 불일치를 제거한다.

산출물:

- settlement encoding helper
- generated or hand-maintained ABI export
- app proof to contract args mapper
- calldata-safe settlement payload type

예상 파일:

- `src/domain/settlement-encoding.ts`
- `src/domain/settlement-contract.ts`
- `tests/phase5-testnet-escrow-encoding.test.ts`

검증:

- settlement proof가 contract args로 변환된다.
- raw transcript, raw profile, direct user id가 args에 포함되지 않는다.
- `policyHash`와 `proofHash`가 contract bytes32와 local proof hash에서 동일하게 비교된다.

### Step 6. Live Deposit Gateway

광고주 escrow deposit transaction을 실제 testnet RPC로 보낸다.

산출물:

- live deposit gateway
- deposit transaction schema/index update
- `CampaignDeposited` receipt parser
- dashboard deposit status field

예상 입력:

- `campaignId`
- `policyHash`
- `depositAmountWei`
- `chainId`
- `contractAddress`
- advertiser wallet/signer

검증:

- 실제 testnet `depositCampaign` tx hash 생성
- receipt confirmed
- emitted `CampaignDeposited` event의 campaign hash와 policy hash가 local campaign과 매칭

### Step 7. Live Settlement Gateway

현재 deterministic gateway 뒤에 실제 testnet gateway를 붙인다.

산출물:

- `SettlementTransactionGateway` live implementation
- `claimSettlement` tx submit
- receipt wait
- `SettlementClaimed` event parser
- local settlement event indexing

검증:

- eligible attention proof만 tx submit 가능
- ineligible proof는 tx 생성 전 차단
- live receipt의 proof hash, score, threshold가 local settlement event와 일치
- dashboard는 fixture receipt가 아니라 live receipt 기반으로 `settled` 표시

### Step 8. Environment And Mode Selection

`SETTLEMENT_MODE`에 따라 gateway를 선택한다.

모드:

- `simulated`: deterministic fixture only. 로컬 개발 전용이며 완료 조건으로 인정하지 않는다.
- `testnet`: live RPC, signer, deployed contract address 사용.

필수 환경 변수:

- `SETTLEMENT_MODE`
- `CHAIN_ID`
- `CHAIN_RPC_URL`
- `ESCROW_CONTRACT_ADDRESS`
- `SETTLEMENT_SIGNER_PRIVATE_KEY`
- `ADVERTISER_DEPOSIT_WALLET`
- `PRIVACY_SALT`

검증:

- testnet mode에서 필수 env 누락 시 명시적 오류
- simulated mode에서는 secret 없이 기존 demo 유지
- secret 값은 로그와 dashboard에 출력하지 않음

### Step 9. Testnet Deploy And Smoke Test

실제 testnet에서 한 번의 end-to-end settlement를 검증한다.

순서:

1. contract compile
2. contract test
3. testnet deploy
4. deployed address 기록
5. campaign deposit tx submit
6. attention event 생성
7. settlement proof 생성
8. settlement claim tx submit
9. receipt에서 `SettlementClaimed` 확인
10. dashboard status 확인

완료 증거:

- deployed contract address
- deposit tx hash
- settlement tx hash
- block number
- emitted event name
- local indexed settlement status

### Step 10. Documentation And Checklist Closure

산출물:

- `docs/testnet-escrow-runbook.md`
- `.env.example` 업데이트
- `docs/specs/agentic-ad-firewall-attention-settlement.md` Known Limits 갱신
- `docs/definitions/08-checklist.md` 체크리스트 완료 반영
- L&C 기록
- 필요 시 E&C 기록

## 완료 조건

다음이 모두 만족되어야 실제 testnet smart contract escrow 완료로 본다.

- Solidity compile 통과
- contract edge-case tests 통과
- testnet에 `AttentionEscrow` 배포
- 실제 `depositCampaign` tx hash 생성
- 실제 `CampaignDeposited` event 확인
- eligible attention proof에서 실제 `claimSettlement` tx hash 생성
- 실제 `SettlementClaimed` event 확인
- duplicate proof와 duplicate attention event가 contract에서 모두 reject
- dashboard가 live receipt 기반으로 settlement status 표시
- calldata/event/receipt/index에 raw transcript, raw profile, direct user id 없음
- `npm test`, `npm run typecheck`, `npm run contract:test` 통과

## 구현 보류 항목

다음은 MVP 이후로 보류한다.

- mainnet settlement
- production custody model
- decentralized advertiser dispute process
- user wallet reward
- upgradeable proxy
- external audit
- legal/compliance review

## Risk Notes

- platform owner가 settlement signer인 중앙화 trust model이다. 데모에서는 명확히 "testnet MVP settlement authority"로 설명한다.
- advertiser refund를 열면 active campaign의 pending proof와 충돌할 수 있으므로, MVP에서는 owner-mediated close/refund를 우선한다.
- policy hash in-place update는 escrow accounting을 복잡하게 만든다. MVP에서는 새 policy version을 새 escrow identity로 취급한다.
- deterministic gateway는 계속 로컬 fixture용으로 남기되, testnet 완료 증거로 사용하지 않는다.
