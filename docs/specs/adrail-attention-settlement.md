# Adrail Attention Settlement

## What This Asset Does

This asset implements Phase 3 attention verification and testnet settlement
plumbing for the Adrail MVP. It turns privacy-safe attention
signals into a settlement proof, submits that proof through a testnet
transaction gateway, indexes the contract event, and renders dashboard-ready
settlement and advertiser funding views.

## Interfaces

- `trackDwell(input)`
- `scoreRealtimeInteraction(interaction)`
- `retrieveContextRetentionEvidence(input)`
- `adjudicateContextRetention(input)`
- `verifyDeepLink(input)`
- `validateDynamicSettlementPolicy(policy)`
- `calculateAttentionScore(input)`
- `createAttentionEvent(input)`
- `createPseudonymousUserProof(input)`
- `createSettlementProof(input)`
- `triggerSettlement(input)`
- `submitSettlementTransaction(input)`
- `submitSettlementTransactionAsync(input)`
- `submitEscrowDepositTransaction(input)`
- `submitEscrowDepositTransactionAsync(input)`
- `parseSettlementContractEvent(receipt)`
- `parseCampaignDepositContractEvent(receipt)`
- `indexSettlementContractEvent(input)`
- `indexCampaignDepositContractEvent(input)`
- `domainIdToBytes32(id)`
- `settlementProofToContractArgs(input)`
- `createViemSettlementGateway(input)`
- `createViemEscrowDepositGateway(input)`
- `readFundingRuntimePublicConfig()`
- `createAdvertiserWalletProfile(input)`
- `assertWalletCanFund(profile)`
- `parseEthAmountToWei(amountEth)`
- `formatWeiToEth(amountWei)`
- `createDemoFundingPolicyHash(campaignId)`
- `createDepositLedgerEntry(input)`
- `createAttentionDebitLedgerEntry(input)`
- `createFailedDebitLedgerEntry(input)`
- `summarizeEscrowLedger(entries)`
- `createCampaignFundingAccount(input)`
- `createAdvertiserFundingDashboard(input)`
- `dedupeEscrowLedgerEntries(entries)`
- `renderSettlementDashboardHtml(input)`
- `contracts/AttentionEscrow.sol`
- `GET /api/advertiser-funding`
- `POST /api/advertiser-funding/wallet`
- `POST /api/advertiser-funding/deposit`

## Internal Dependencies

- `src/domain/schemas.ts`
- `src/domain/attention.ts`
- `src/domain/settlement-encoding.ts`
- `src/domain/settlement-contract.ts`
- `src/domain/settlement.ts`
- `src/domain/advertiser-funding.ts`
- `src/ui/settlement-dashboard-renderer.ts`
- `src/ui/phase4-demo-app.tsx`
- `contracts/AttentionEscrow.sol`

## External Dependencies

- `zod`
- `viem`
- `vitest` for tests
- `hardhat` and `@nomicfoundation/hardhat-toolbox-viem` for contract compile/test/deploy
- Solidity `^0.8.24` for the escrow contract source

## Example

```ts
import {
  createAttentionEvent,
  createPseudonymousUserProof
} from "../src/domain/attention";
import {
  submitSettlementTransaction,
  triggerSettlement
} from "../src/domain/settlement";

const attentionEvent = createAttentionEvent({
  id: "attention_001",
  campaignId: "campaign_travel_001",
  interstitialId: "interstitial_001",
  dwellSeconds: 3,
  realtimeInteractionScore: 1,
  contextRetentionScore: 1,
  deepLinkScore: 1,
  settlementPolicy,
  pseudonymousUserProof: createPseudonymousUserProof({
    campaignId: "campaign_travel_001",
    eligibilityTokenHash: "eligibility_hash",
    privacySalt: "local_salt"
  }),
  occurredAt: "2026-05-20T06:30:00.000Z"
});

const trigger = triggerSettlement({
  attentionEvent,
  settlementPolicy,
  settlementEventId: "settlement_001",
  now: "2026-05-20T06:30:00.000Z"
});

if (trigger.triggered) {
  const submitted = submitSettlementTransaction({
    settlementEvent: trigger.settlementEvent,
    proof: trigger.proof,
    chainId: 84532,
    contractAddress: "0x1111111111111111111111111111111111111111",
    submittedAt: "2026-05-20T06:30:00.000Z"
  });

  console.log(submitted.transaction.txHash);
}
```

## Funding Ledger Example

```ts
import {
  createAdvertiserFundingDashboard,
  createAttentionDebitLedgerEntry,
  createDepositLedgerEntry,
  createDemoFundingPolicyHash,
  parseEthAmountToWei
} from "../src/domain/advertiser-funding";

const policyHash = createDemoFundingPolicyHash("campaign_travel_001");
const amountWei = parseEthAmountToWei("0.01");
const depositEntry = createDepositLedgerEntry({
  campaignId: "campaign_travel_001",
  transaction: indexedDeposit.transaction,
  parsedEvent: indexedDeposit.parsedEvent,
  createdAt: "2026-05-20T06:30:00.000Z",
  updatedAt: "2026-05-20T06:30:12.000Z"
});
const spendEntry = createAttentionDebitLedgerEntry({
  settlementEvent: indexedSettlement.settlementEvent,
  transaction: indexedSettlement.transaction,
  amountWei: "100000000000000",
  createdAt: "2026-05-20T06:30:00.000Z",
  updatedAt: "2026-05-20T06:30:12.000Z"
});

const dashboard = createAdvertiserFundingDashboard({
  advertiserId: "advertiser_atlas",
  campaignId: "campaign_travel_001",
  chainId: 84532,
  escrowContractAddress: "0x88ca42ba054470cec6a31e8a25e8368634340b9a",
  walletAddress: "0xf382e32067B8231e57C69Dbcd550A495892F6B83",
  configuredWalletAddress: "0xf382e32067B8231e57C69Dbcd550A495892F6B83",
  policyHash,
  ledgerEntries: [depositEntry, spendEntry],
  updatedAt: "2026-05-20T06:30:12.000Z"
});

console.log(amountWei, dashboard.summary.availableWei);
```

## Known Limits

- Context retention is deterministic fixture logic that mirrors the
  embedding/RAG + LLM adjudicator contract. Live embeddings and OpenRouter
  adjudication can replace the internals without changing the public interface.
- `submitSettlementTransaction` defaults to a deterministic testnet gateway for
  local tests. `submitSettlementTransactionAsync` can use the live viem gateway.
- `submitEscrowDepositTransaction` defaults to a deterministic deposit gateway
  for local tests. `submitEscrowDepositTransactionAsync` can use the live viem
  deposit gateway.
- Hardhat compile, contract edge-case tests, Base Sepolia deploy, deposit, and
  settlement smoke evidence are present in the runbook.
- The dashboard reads deterministic funding fixtures by default. `POST
  /api/advertiser-funding/deposit` submits a live deposit only when
  `SETTLEMENT_MODE=testnet` and the configured testnet wallet matches.
- MVP dashboard deposits are submitted by the server-side testnet advertiser
  key. Production must replace this with wallet-signed EIP-1193 deposits.
- Funding ledger entries are local/indexed records. The source of truth for
  confirmed deposit and settlement state is the parsed contract receipt.

## Porting Checklist

- Keep `pseudonymousUserProof` hash-only and campaign-scoped.
- Reject settlement proofs when `scoreBps < thresholdBps`.
- Check duplicate proof hashes before creating a settlement event.
- Compare indexed contract events against local proof hash and score.
- Compare indexed campaign deposit events against the funding policy hash.
- Deduplicate ledger entries by confirmed proof hash or transaction event before
  computing advertiser spend.
- Do not put raw transcript, raw profile, or direct user id into proof or
  contract event fields.
- Convert plain app ids to `bytes32` with `keccak256(utf8(id))`; never send raw
  campaign or attention ids on-chain.
