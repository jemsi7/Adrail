# Agentic Ad Firewall Attention Settlement

## What This Asset Does

This asset implements Phase 3 attention verification and testnet settlement
plumbing for the Agentic Ad Firewall MVP. It turns privacy-safe attention
signals into a settlement proof, submits that proof through a testnet
transaction gateway, indexes the contract event, and renders a dashboard-ready
HTML summary.

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
- `renderSettlementDashboardHtml(input)`
- `contracts/AttentionEscrow.sol`

## Internal Dependencies

- `src/domain/schemas.ts`
- `src/domain/attention.ts`
- `src/domain/settlement-encoding.ts`
- `src/domain/settlement-contract.ts`
- `src/domain/settlement.ts`
- `src/ui/settlement-dashboard-renderer.ts`
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

## Known Limits

- Context retention is deterministic fixture logic that mirrors the
  embedding/RAG + LLM adjudicator contract. Live embeddings and OpenRouter
  adjudication can replace the internals without changing the public interface.
- `submitSettlementTransaction` defaults to a deterministic testnet gateway for
  local tests. `submitSettlementTransactionAsync` can use the live viem gateway.
- `submitEscrowDepositTransaction` defaults to a deterministic deposit gateway
  for local tests. `submitEscrowDepositTransactionAsync` can use the live viem
  deposit gateway.
- Hardhat compile and contract edge-case tests are present. Actual testnet
  completion still requires user-provided RPC/key settings and a deployed
  contract address.
- The dashboard fixture path still uses deterministic receipts unless the app
  is explicitly wired to live receipts for a configured testnet run.

## Porting Checklist

- Keep `pseudonymousUserProof` hash-only and campaign-scoped.
- Reject settlement proofs when `scoreBps < thresholdBps`.
- Check duplicate proof hashes before creating a settlement event.
- Compare indexed contract events against local proof hash and score.
- Do not put raw transcript, raw profile, or direct user id into proof or
  contract event fields.
- Convert plain app ids to `bytes32` with `keccak256(utf8(id))`; never send raw
  campaign or attention ids on-chain.
