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
- `parseSettlementContractEvent(receipt)`
- `indexSettlementContractEvent(input)`
- `renderSettlementDashboardHtml(input)`
- `contracts/AttentionEscrow.sol`

## Internal Dependencies

- `src/domain/schemas.ts`
- `src/domain/attention.ts`
- `src/domain/settlement.ts`
- `src/ui/settlement-dashboard-renderer.ts`
- `contracts/AttentionEscrow.sol`

## External Dependencies

- `zod`
- `vitest` for tests
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
  local tests. A live wallet/RPC gateway should implement the same
  `SettlementTransactionGateway` interface.
- The Solidity contract source is present, but deployment scripts and Hardhat
  edge-case tests belong to the hardening/deployment phase.

## Porting Checklist

- Keep `pseudonymousUserProof` hash-only and campaign-scoped.
- Reject settlement proofs when `scoreBps < thresholdBps`.
- Check duplicate proof hashes before creating a settlement event.
- Compare indexed contract events against local proof hash and score.
- Do not put raw transcript, raw profile, or direct user id into proof or
  contract event fields.
