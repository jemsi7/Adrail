# 11. Advertiser Wallet Funding Dashboard Plan

- 상태: v1.0 locked
- 작성일: 2026-05-20
- 프로젝트: Adrail
- 결정: Advertiser Console에서 testnet wallet, escrow funding, attention-based spend ledger를 제품 플로우로 연결

## 목적

현재 프로젝트는 Base Sepolia에서 `AttentionEscrow` deploy, campaign deposit,
attention settlement claim, receipt indexing까지 실제 testnet E2E를 검증했다.
다음 단계는 이 기능을 `/advertiser-console`의 제품 경험으로 올리는 것이다.

광고주는 dashboard에서 wallet address와 충전 금액을 확인하고, campaign escrow에
testnet ETH를 충전한 뒤, eligible attention signal이 발생하면 광고비가 차감되는
내역을 볼 수 있어야 한다.

## 관련 기존 기록

- E&C:
  - `/Users/aiden/aiden/E&C/SEABW-Hackathon2026/2026-05-20-testnet-escrow-review-gaps.md`
  - `/Users/aiden/aiden/E&C/SEABW-Hackathon2026/2026-05-20-testnet-escrow-implementation-fixes.md`
  - `/Users/aiden/aiden/E&C/SEABW-Hackathon2026/2026-05-20-testnet-wallet-generation-shell-quoting.md`
- L&C:
  - `/Users/aiden/aiden/L&C/SEABW-Hackathon2026/2026-05-20-real-testnet-escrow-implementation.md`
  - `/Users/aiden/aiden/L&C/SEABW-Hackathon2026/2026-05-20-minimal-chat-ui-plan-lock.md`
  - `/Users/aiden/aiden/L&C/SEABW-Hackathon2026/2026-05-20-impeccable-design-system.md`
- 코드:
  - `contracts/AttentionEscrow.sol`
  - `src/domain/settlement.ts`
  - `src/domain/settlement-contract.ts`
  - `scripts/deposit-campaign.ts`
  - `scripts/claim-settlement.ts`
  - `src/ui/phase4-demo-app.tsx`
  - `app/advertiser-console/page.tsx`
  - `src/db/schema.ts`

## MVP Trust Model

- testnet 전용이다.
- advertiser private key는 browser UI에 입력하지 않는다.
- dashboard는 public wallet address만 입력받는다.
- MVP에서는 `.env`의 testnet-only `ADVERTISER_DEPOSIT_PRIVATE_KEY`가
  `depositCampaign`을 제출한다.
- 입력한 dashboard wallet address는 `ADVERTISER_DEPOSIT_WALLET`와 일치해야 한다.
- production 전환 시에는 `ADVERTISER_DEPOSIT_PRIVATE_KEY`를 제거하고
  EIP-1193 wallet connect로 advertiser가 직접 deposit tx에 서명한다.
- `claimSettlement`는 계속 platform settlement signer가 제출한다.
- 광고비 차감은 local 임의 차감이 아니라 confirmed `SettlementClaimed` receipt를
  기준으로 ledger에 반영한다.

## Product Flow

1. 광고주가 `/advertiser-console`에 진입한다.
2. Funding panel에서 wallet address를 입력한다.
3. 앱은 address format, chain id, configured advertiser wallet 일치 여부를 검증한다.
4. 광고주가 충전 금액을 입력한다.
5. 앱은 wei 정수 변환 후 `depositCampaign` testnet transaction을 제출한다.
6. receipt에서 `CampaignDeposited` event가 확인되면 campaign escrow balance가 증가한다.
7. User Chat에서 sponsored interaction과 attention signal이 발생한다.
8. eligible attention proof가 생성되면 `claimSettlement` transaction이 제출된다.
9. receipt에서 `SettlementClaimed` event가 확인되면 campaign escrow balance와 spend ledger가 갱신된다.
10. Advertiser Console은 deposit, attention debit, tx hash, block number, status 내역을 보여준다.

## 고정 구현 순서

### Step 1. Funding Domain Model Lock

먼저 dashboard 숫자의 의미를 고정한다. UI보다 먼저 처리한다.

산출물:

- advertiser wallet profile type
- campaign funding account type
- escrow ledger entry type
- balance summary type

필드 초안:

```txt
AdvertiserWalletProfile
- advertiserId
- walletAddress
- chainId
- verificationStatus: unconfigured | format_valid | configured_match | mismatch
- updatedAt

CampaignFundingAccount
- campaignId
- advertiserId
- chainId
- escrowContractAddress
- walletAddress
- policyHash
- depositedWei
- spentWei
- availableWei
- pendingDebitWei
- lastIndexedBlock
- updatedAt

EscrowLedgerEntry
- id
- campaignId
- type: deposit | attention_debit | failed_debit | refund
- amountWei
- status: pending | confirmed | failed
- txHash
- blockNumber
- eventName
- attentionEventId
- settlementEventId
- proofHash
- createdAt
- updatedAt
```

검증:

- `availableWei = depositedWei - spentWei - pendingDebitWei`가 음수가 되지 않는다.
- `SettlementClaimed` confirmed 전에는 confirmed spend로 잡지 않는다.
- duplicate proof 또는 duplicate attention event는 ledger 중복 차감으로 이어지지 않는다.

### Step 2. Persistence Schema And Fixtures

domain type을 `src/db/schema.ts`와 deterministic demo fixtures에 반영한다.

산출물:

- `advertiser_wallets`
- `campaign_funding_accounts`
- `escrow_ledger_entries`
- 기존 `contract_transactions`와 ledger entry 연결 규칙
- seed/demo scenario에 funding account 포함

검증:

- 기존 campaign/settlement tests가 깨지지 않는다.
- funding account 없이도 기존 deterministic demo는 fallback 상태를 표시한다.

### Step 3. Funding Service Layer

UI와 contract gateway 사이에 service layer를 둔다.

산출물:

- wallet address validation
- ETH decimal input to wei 변환
- `depositCampaign` orchestration
- `CampaignDeposited` receipt indexing
- balance summary reducer
- settlement receipt to debit ledger reducer

예상 파일:

- `src/domain/advertiser-funding.ts`
- `tests/advertiser-funding.test.ts`

검증:

- 잘못된 address reject
- `ADVERTISER_DEPOSIT_WALLET` mismatch reject
- 소수 ETH 입력이 정확한 wei로 변환
- deposit receipt가 `deposit` ledger entry와 balance 증가로 반영
- settlement receipt가 `attention_debit` ledger entry와 balance 감소로 반영
- failed receipt는 balance를 차감하지 않음

### Step 4. Server API Boundary

browser에서 private key를 직접 다루지 않도록 API boundary를 만든다.

산출물:

- `GET /api/advertiser-funding`
- `POST /api/advertiser-funding/wallet`
- `POST /api/advertiser-funding/deposit`
- `POST /api/advertiser-funding/settlement-smoke`

MVP 제한:

- `POST /deposit`은 `SETTLEMENT_MODE=testnet`에서만 live tx를 보낸다.
- 입력 wallet address는 configured advertiser wallet과 일치해야 한다.
- response는 public address, tx hash, status, amount만 반환한다.
- private key, raw env, raw user data는 절대 반환하지 않는다.

검증:

- missing env는 명시적 오류
- invalid amount reject
- configured wallet mismatch reject
- successful deposit response에 `CampaignDeposited` event 포함

### Step 5. Advertiser Console Funding Panel UI

기존 dashboard 톤과 맞춰 작고 밀도 있는 operational panel로 만든다.
마케팅 hero나 큰 카드형 설명은 만들지 않는다.

UI 구성:

- wallet address input
- chain/status pill
- available escrow balance
- deposited / spent / pending debit metrics
- amount input
- fund campaign button
- tx status inline feedback

디자인 규칙:

- 기존 `console-section`, `panel-header`, `metric-grid`, `status-pill`, `small-button`
  계열 스타일을 우선 재사용한다.
- button text는 짧게 둔다.
- 긴 address/hash는 `shortHash`와 details/tooltip로 처리한다.
- text overflow가 panel을 밀지 않도록 fixed-width hash row를 쓴다.

검증:

- desktop `/advertiser-console`에서 기존 policy/review/settlement panel과 톤이 맞는다.
- mobile width에서 address와 amount input이 겹치지 않는다.
- invalid/mismatch/pending/confirmed/failed 상태가 모두 보인다.

### Step 6. Attention Signal To Spend Debit Integration

User Chat의 attention signal이 settlement proof로 이어질 때 funding ledger도 함께 갱신한다.

산출물:

- eligible attention event 발생 시 pending debit entry 생성
- `claimSettlement` tx submit 후 tx hash 연결
- confirmed `SettlementClaimed` receipt indexing 후 confirmed debit 처리
- insufficient escrow 상태 처리

검증:

- attention score가 threshold 미만이면 차감 내역이 생성되지 않는다.
- rejected campaign이면 settlement tx와 debit 모두 생성되지 않는다.
- insufficient escrow이면 failed debit 내역이 남고 balance는 차감되지 않는다.
- successful settlement 후 dashboard spend가 증가한다.

### Step 7. Funding History

광고주가 충전과 차감의 원인을 한 화면에서 볼 수 있게 한다.

UI 구성:

- recent funding history table/list
- type label: Deposit, Attention debit, Failed debit, Refund
- amount
- status
- campaign
- attention event short id
- tx hash
- block number
- timestamp

검증:

- deposit tx와 settlement tx가 같은 history list에 시간순으로 보인다.
- `CampaignDeposited`와 `SettlementClaimed` event name이 구분된다.
- failed/retry 상태가 confirmed처럼 보이지 않는다.

### Step 8. Live Testnet Smoke From Dashboard

스크립트가 아니라 dashboard/API 경로로 실제 testnet smoke를 수행한다.

순서:

1. `/advertiser-console` 열기
2. wallet address 입력
3. amount 입력
4. deposit tx submit
5. `CampaignDeposited` history 확인
6. User Chat에서 attention interaction 발생
7. settlement claim tx submit
8. `SettlementClaimed` history와 balance 차감 확인

검증:

- `npm test`
- `npm run typecheck`
- `npm run contract:test`
- dashboard smoke tx evidence 기록
- Browser/Computer Use screenshot QA

### Step 9. Documentation And Checklist Update

산출물:

- `docs/testnet-escrow-runbook.md` dashboard flow 추가
- `docs/definitions/05-config-and-secrets.md` wallet UI trust model 갱신
- `docs/specs/adrail-attention-settlement.md` funding ledger API 추가
- `docs/definitions/08-checklist.md` 진행 상태 업데이트
- L&C 기록

검증:

- 실제 secret 값은 문서에 없음
- wallet address는 public value만 기록
- faucet/funding 수동 단계와 dashboard deposit 단계가 분리되어 설명됨

## 하지 않는 것

- mainnet 결제
- production custody
- private key UI 입력
- seed phrase 저장
- 신용카드/법정화폐 결제
- trustless advertiser dispute process
- wallet connect productionization

## 완료 조건

- advertiser console에서 wallet address를 입력하고 상태를 볼 수 있다.
- dashboard에서 충전 금액을 입력해 campaign escrow deposit을 만들 수 있다.
- confirmed `CampaignDeposited` receipt가 funding history에 보인다.
- eligible attention signal 이후 confirmed `SettlementClaimed` receipt가 funding history에 보인다.
- available balance가 deposit 후 증가하고 settlement 후 감소한다.
- insufficient escrow, invalid wallet, failed tx 상태가 명확히 표시된다.
- private key와 raw user data가 browser, logs, docs에 노출되지 않는다.
- `npm test`, `npm run typecheck`, `npm run contract:test`가 통과한다.

## Implementation Gate

이 계획은 구현 순서를 고정한다. 실제 착수 전 첫 비가역 결정은 Step 1의
funding ledger data model이다. 구현 시작 시에는 이 문서를 기준으로
schema/type부터 적용하고, UI는 Step 5에서 처리한다.
