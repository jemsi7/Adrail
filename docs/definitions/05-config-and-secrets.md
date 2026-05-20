# 05. Config And Secrets

- 상태: v0.3 locked
- 작성일: 2026-05-20

## 원칙

- 실제 secret은 커밋하지 않는다.
- `.env.example`에는 placeholder만 둔다.
- 광고주, 사용자, settlement 관련 identifier는 환경별로 분리한다.
- 로그에는 raw transcript와 direct identifier를 남기지 않는다.
- testnet transaction에는 개인정보 원문을 기록하지 않는다.
- 서비스 언어는 영어로 고정한다.

## 예상 환경 변수

```txt
APP_ENV=local
APP_LANGUAGE=en
DATABASE_URL=file:./local.db

AI_PROVIDER=openrouter
OPENROUTER_API_KEY=replace_me
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
ANSWER_MODEL=replace_me
TARGET_POLICY_COMPILER_MODEL=replace_me
AD_MEDIATOR_MODEL=replace_me
INTERACTIVE_AD_MODEL=replace_me
RETENTION_ADJUDICATOR_MODEL=replace_me
EMBEDDING_MODEL=replace_me

SETTLEMENT_MODE=testnet
CHAIN_ID=replace_me
ESCROW_CONTRACT_ADDRESS=replace_me
CHAIN_RPC_URL=replace_me
SETTLEMENT_SIGNER_PRIVATE_KEY=replace_me
ADVERTISER_DEPOSIT_WALLET=replace_me

PRIVACY_SALT=replace_me
AUDIT_LOG_SECRET=replace_me
```

## 설정 항목 설명

### AI Provider

- Provider: OpenRouter
- 목적: 답변, 자연어 target policy compiler, 광고 매칭, 인터랙티브 광고 생성, context retention adjudication
- fallback: deterministic demo fixtures
- 실제 모델 사용 시 필요한 권한: text generation, structured output, embeddings

### Service Language

- `APP_LANGUAGE=en`
- user-facing UI, ad copy, disclosure, demo conversation은 영어로 제공한다.

### Database

- 목적: campaign, ad pool, compiled target policy, context retention evidence, event, settlement, contract transaction index 저장
- local: SQLite
- production 후보: Postgres

### Settlement

- `SETTLEMENT_MODE=testnet`: MVP 기본값. smart contract deposit/settlement 호출
- `SETTLEMENT_MODE=simulated`: 테스트 fixture 또는 오프라인 개발 전용. 데모 완료 조건으로 인정하지 않음
- `CHAIN_ID`: 선택한 EVM-compatible testnet chain id
- `ESCROW_CONTRACT_ADDRESS`: 배포된 escrow contract 주소
- `CHAIN_RPC_URL`: testnet RPC endpoint
- `SETTLEMENT_SIGNER_PRIVATE_KEY`: settlement transaction 제출 권한이 있는 testnet key
- `ADVERTISER_DEPOSIT_WALLET`: 광고주 deposit wallet 주소

### Privacy Salt

- 목적: campaign-scoped pseudonymous id 생성
- 주의: 유출 시 과거 이벤트 linkability 위험 증가
- 회전 정책: phase 2에서 정의

## Wallet/Key 관리

- MVP에서는 local `.env` testnet key를 사용한다.
- 실제 자산이 있는 mainnet/private key는 사용하지 않는다.
- `.env.example`에는 placeholder만 둔다.

## 커밋 금지 파일

- `.env`
- `.env.local`
- `.env.production`
- private key
- wallet seed phrase
- raw user export
- raw advertiser upload containing secrets
- local database with real user data

## Open Decisions

- 없음.
