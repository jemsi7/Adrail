# Testnet Escrow Runbook

This runbook turns the local deterministic settlement scaffold into a real
EVM-compatible testnet escrow flow.

## 1. Prepare Testnet Wallets

Create two testnet-only wallets:

- Settlement signer: deploys `AttentionEscrow` and calls `claimSettlement`.
- Advertiser deposit signer: calls `depositCampaign`.

Fund both wallets with the chosen testnet native token. Do not use a mainnet
wallet or a wallet containing real assets.

## 2. Configure `.env`

Copy `.env.example` to `.env` and fill:

```txt
SETTLEMENT_MODE=testnet
CHAIN_ID=replace_with_testnet_chain_id
CHAIN_RPC_URL=replace_with_rpc_url
SETTLEMENT_SIGNER_PRIVATE_KEY=replace_with_testnet_settlement_private_key
ADVERTISER_DEPOSIT_WALLET=replace_with_advertiser_deposit_address
ADVERTISER_DEPOSIT_PRIVATE_KEY=replace_with_testnet_advertiser_private_key
SETTLEMENT_PAYOUT_RECIPIENT=replace_with_testnet_recipient_address
CAMPAIGN_DEPOSIT_AMOUNT_WEI=replace_with_deposit_amount
SETTLEMENT_PAYOUT_AMOUNT_WEI=replace_with_single_payout_amount
PRIVACY_SALT=replace_with_random_local_secret
```

Leave `ESCROW_CONTRACT_ADDRESS` empty until deployment finishes.

## 3. Compile And Test Contracts

```bash
npm run contract:compile
npm run contract:test
```

Expected result:

- `AttentionEscrow` compiles.
- Contract tests pass for deposit, overwrite prevention, threshold rejection,
  duplicate proof rejection, duplicate attention event rejection, payout, and
  refund.

## 4. Deploy `AttentionEscrow`

```bash
npm run contract:deploy:testnet
```

Copy the printed contract address into:

```txt
ESCROW_CONTRACT_ADDRESS=0x...
```

## 5. Submit A Deposit Transaction

Use the live deposit gateway from `src/domain/settlement-contract.ts` with:

- `campaignId`
- `policyHash`
- `CAMPAIGN_DEPOSIT_AMOUNT_WEI`
- `CHAIN_ID`
- `ESCROW_CONTRACT_ADDRESS`
- `ADVERTISER_DEPOSIT_PRIVATE_KEY`

The receipt must include `CampaignDeposited`.

## 6. Submit A Settlement Transaction

Generate an eligible attention proof, then use the live settlement gateway with:

- settlement proof
- `SETTLEMENT_PAYOUT_RECIPIENT`
- `SETTLEMENT_PAYOUT_AMOUNT_WEI`
- `CHAIN_ID`
- `ESCROW_CONTRACT_ADDRESS`
- `SETTLEMENT_SIGNER_PRIVATE_KEY`

The receipt must include `SettlementClaimed`.

## 7. Verify Privacy Boundary

Confirm that calldata, events, receipts, and local contract transaction rows
contain only:

- bytes32 campaign hash
- bytes32 attention event hash
- policy hash
- proof hash
- score/threshold bps
- recipient address
- payout amount

They must not contain raw transcript, raw profile, direct user id, or raw
campaign-scoped user vault id.

## 8. Advertiser Dashboard Funding Flow

Use `/advertiser-console`, open the `Settlement` step, then verify:

1. Wallet address input contains only the public advertiser wallet address.
2. Amount input accepts an ETH decimal value.
3. `Verify` validates address format and configured wallet match through
   `POST /api/advertiser-funding/wallet`.
4. `Fund` submits `POST /api/advertiser-funding/deposit` from the server route.
5. The server route uses `.env` testnet-only `ADVERTISER_DEPOSIT_PRIVATE_KEY`;
   this key is never sent to the browser.
6. A confirmed `CampaignDeposited` receipt adds a deposit history row.
7. A confirmed `SettlementClaimed` receipt adds an attention debit row and
   decreases available escrow balance.

Do not click `Fund` during visual QA unless a live testnet deposit is intended.

## 9. Completion Evidence

Record these values in the demo notes:

- deployed contract address
- deposit tx hash
- settlement tx hash
- block numbers
- emitted event names
- dashboard settlement status

## 10. Live Base Sepolia Evidence

Captured on 2026-05-20 against Base Sepolia (`CHAIN_ID=84532`).

```txt
AttentionEscrow:
0x88ca42ba054470cec6a31e8a25e8368634340b9a

Campaign:
campaign_travel_001

Policy hash:
622f2e306d00d3e8ef1b6280a29215ab220027cbd84a5bd43b93894c3cece6eb

Deployment block:
41757517

Deposit:
tx 0xfe1d0640bd9c76744ec25a20f4a78b7f647478ae953ee433e5e79aca9bb0e0fa
block 41757614
event CampaignDeposited
amount 10000000000000000 wei

Settlement:
tx 0x4a72bed04e6e524c19bfc640f305fcee63f3309e7cde1e9b040e1fadaa1a8acf
block 41757621
event SettlementClaimed
attention event attention_event_1779283526281
proof hash 21d980f422c27b1d7d6c9993f7fc158b3011d099b06128ff49d2d1d5529cdf15
payout 100000000000000 wei
```

Post-run balances:

```txt
SETTLEMENT_SIGNER / payout recipient: 0.025092126428843024 ETH
ADVERTISER_DEPOSIT_WALLET: 0.014999306255525523 ETH
ESCROW_CONTRACT: 0.0099 ETH
```
