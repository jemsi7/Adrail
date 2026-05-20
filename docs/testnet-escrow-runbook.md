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

## 8. Completion Evidence

Record these values in the demo notes:

- deployed contract address
- deposit tx hash
- settlement tx hash
- block numbers
- emitted event names
- dashboard settlement status
