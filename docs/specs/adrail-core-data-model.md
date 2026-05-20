# Adrail Core Data Model

## What This Asset Does

This asset defines the Phase 1 schemas and boundary helpers for the Agentic Ad
Firewall MVP. It fixes the system boundary between service answers, sponsored
interstitials, advertiser-facing responses, platform-private personal
intelligence, attention proofs, and settlement records.

## Interfaces

- `campaignSchema`
- `naturalLanguageTargetPolicySchema`
- `compiledTargetPolicySchema`
- `adPoolItemSchema`
- `personalIntelligenceSnapshotSchema`
- `eligibilityTokenSchema`
- `sponsoredInterstitialSchema`
- `sponsoredInterstitialInteractionSchema`
- `contextRetentionEvidenceSchema`
- `attentionEventSchema`
- `dynamicSettlementPolicySchema`
- `settlementEventSchema`
- `settlementProofSchema`
- `contractTransactionSchema`
- `buildAnswerAgentInput(input)`
- `toAdvertiserCampaignResponse(input)`
- `applySponsoredInteraction(input)`
- `detectSensitiveTargeting(policyText)`
- `compileNaturalLanguageTargetPolicy(input)`

## Internal Dependencies

- `src/domain/schemas.ts`
- `src/domain/boundaries.ts`
- `src/domain/policy.ts`
- `src/db/schema.ts`

## External Dependencies

- `zod`
- `drizzle-orm`
- `vitest` for tests

## Example

```ts
import { buildAnswerAgentInput } from "../src/domain/boundaries";

const answerInput = buildAnswerAgentInput({
  userQuestion: "Plan a two-day trip near Bangkok.",
  retrievalSafeSummary: "User is exploring short local travel ideas.",
  recentUserMessages: ["I want a relaxed weekend trip."],
  campaignId: "ignored_campaign_field"
});
```

`answerInput` contains only service-answer fields. Campaign data and ad
interaction results are intentionally omitted.

## Known Limits

- Sensitive targeting detection is deterministic and rule-based in Phase 1.
- Embedding/RAG matching is represented as schemas and deterministic fixture
  compilation only; live retrieval belongs to Phase 2 and Phase 3.
- Contract transaction records are indexed as local schema rows; the Solidity
  contract and submitter are Phase 3.

## Porting Checklist

- Keep advertiser-facing API responses aggregate-only.
- Never pass campaign bid, target policy, or ad interaction state into answer
  agent input.
- Keep platform-private `userVaultId` out of advertiser responses.
- Preserve settlement policy hash and proof hash fields when moving to another
  database.
