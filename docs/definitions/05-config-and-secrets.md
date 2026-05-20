# 05. Config And Secrets

- 상태: v0.4 locked
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
NEXT_ALLOWED_DEV_ORIGINS=optional_comma_separated_dev_hosts

AI_PROVIDER=openrouter
OPENROUTER_API_KEY=replace_me
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
ANSWER_MODEL=openai/gpt-4.1-mini
TARGET_POLICY_COMPILER_MODEL=openai/gpt-4.1-mini
AD_MEDIATOR_MODEL=openai/gpt-4.1-mini
INTERACTIVE_AD_MODEL=openai/gpt-4.1-mini
RETENTION_ADJUDICATOR_MODEL=openai/gpt-4.1-mini
EMBEDDING_MODEL=openai/text-embedding-3-small

SETTLEMENT_MODE=testnet
CHAIN_ID=replace_me
ESCROW_CONTRACT_ADDRESS=replace_me
CHAIN_RPC_URL=replace_me
SETTLEMENT_SIGNER_PRIVATE_KEY=replace_me
ADVERTISER_DEPOSIT_WALLET=replace_me
ADVERTISER_DEPOSIT_PRIVATE_KEY=replace_me
SETTLEMENT_PAYOUT_RECIPIENT=replace_me
CAMPAIGN_DEPOSIT_AMOUNT_WEI=replace_me
SETTLEMENT_PAYOUT_AMOUNT_WEI=replace_me

PRIVACY_SALT=replace_me
AUDIT_LOG_SECRET=replace_me
```

## 설정 항목 설명

### AI Provider

- Provider: OpenRouter
- 목적: 답변, 자연어 target policy compiler, 광고 매칭, 인터랙티브 광고 생성, context retention adjudication
- fallback: deterministic demo fixtures only when `OPENROUTER_API_KEY` is absent; when the key is configured, provider failures surface as live errors instead of fixture replacement
- 실제 모델 사용 시 필요한 권한: text generation, structured output, embeddings
- key source: `.env`의 `OPENROUTER_API_KEY`만 사용한다.
- 금지: 화면 입력, browser local/session storage, client-provided `x-openrouter-api-key` header로 OpenRouter key를 주입하지 않는다.

### Service Language

- `APP_LANGUAGE=en`
- user-facing UI, ad copy, disclosure, demo conversation은 영어로 제공한다.

### Local Dev Network Access

- `NEXT_ALLOWED_DEV_ORIGINS`: optional comma-separated dev-only host allowlist for non-localhost demos, such as a custom LAN DNS name or tunnel domain.
- `npm run dev` binds to `0.0.0.0` so a phone or second machine can open the demo over LAN.
- `next.config.ts` also auto-detects the current non-internal IPv4 LAN address and adds it to `allowedDevOrigins`.
- 금지: `*` 전체 wildcard로 dev origin을 열어두는 방식. Next dev resource allowlist는 exact host 또는 subdomain wildcard를 사용한다.

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
- `ADVERTISER_DEPOSIT_PRIVATE_KEY`: testnet escrow deposit tx를 제출할 광고주 지갑 private key
- `SETTLEMENT_PAYOUT_RECIPIENT`: testnet payout 수령 주소
- `CAMPAIGN_DEPOSIT_AMOUNT_WEI`: 데모 campaign escrow deposit 금액
- `SETTLEMENT_PAYOUT_AMOUNT_WEI`: attention proof 1건당 payout 금액

### Privacy Salt

- 목적: campaign-scoped pseudonymous id 생성
- 주의: 유출 시 과거 이벤트 linkability 위험 증가
- 회전 정책: phase 2에서 정의

## Wallet/Key 관리

- MVP에서는 local `.env` testnet key를 사용한다.
- 실제 자산이 있는 mainnet/private key는 사용하지 않는다.
- `.env.example`에는 placeholder만 둔다.
- `SETTLEMENT_SIGNER_PRIVATE_KEY`와 `ADVERTISER_DEPOSIT_PRIVATE_KEY`는 testnet 전용 신규 지갑으로 생성한다.
- 두 private key는 데모 직후 폐기 가능해야 한다.
- Advertiser Console funding UI는 public wallet address만 입력받는다.
- `ADVERTISER_DEPOSIT_PRIVATE_KEY`는 browser/client bundle로 전달하지 않고 server API route에서만 사용한다.
- dashboard wallet address는 `ADVERTISER_DEPOSIT_WALLET`와 일치할 때만 live deposit submit이 가능하다.
- funding history에는 tx hash, block number, event name, amount만 표시하고 private key 또는 raw env 값을 표시하지 않는다.

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
