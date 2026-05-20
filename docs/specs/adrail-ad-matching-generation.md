# Adrail Ad Matching And Generation

## What This Asset Does

This asset implements Phase 2 of Adrail: it compiles advertiser
natural-language target policy into auditable matching fields, selects an
eligible campaign from privacy-safe user context, generates an Interactive
Sponsored Interstitial, validates claim/policy boundaries, and renders the
result as scripted React/HTML UI.

## Interfaces

- `detectSensitiveTargeting(policyText)`
- `compileNaturalLanguageTargetPolicy(input)`
- `generateEmbeddingQueries(sourceText)`
- `matchesTargetPolicy(input)`
- `selectAdOpportunity(input)`
- `selectAdOpportunityByEmbedding(input)`
- `selectAdOpportunityByLlmChoice(input)`
- `cosineSimilarity(left, right)`
- `selectAdThemeWithOpenRouterEmbeddings(input)`
- `selectAdThemeWithOpenRouterProfessionalMatching(input)`
- `prepareSponsoredCreativeSet(input)`
- `selectPreparedCreativeVariant(input)`
- `withinFrequencyCap(campaignId, frequencyState, now)`
- `generateInteractiveSponsoredInterstitial(input)`
- `createMicroInteractionTemplate(opportunity)`
- `createScriptedGraphicSpec(opportunity, interactionSpec)`
- `validateApprovedClaimSet(input)`
- `guardSponsoredInterstitial(input)`
- `renderScriptedGraphicHtml(visualSpec)`
- `renderSponsoredInterstitialHtml(interstitial)`
- `createDemoAdThemeFixtures(now)`

## Internal Dependencies

- `src/domain/policy.ts`
- `src/domain/matching.ts`
- `src/domain/prepared-creatives.ts`
- `src/domain/ad-generation.ts`
- `src/domain/demo-fixtures.ts`
- `src/ai/live-ad-matching.ts`
- `src/ai/openrouter.ts`
- `src/ui/scripted-graphic-renderer.ts`
- `src/ui/sponsored-interstitial-renderer.ts`
- `src/domain/schemas.ts`

## External Dependencies

- `zod`
- `react`
- `@types/react`
- `@types/react-dom`
- `vitest` for tests

## Example

```ts
import { generateInteractiveSponsoredInterstitial } from "../src/domain/ad-generation";
import {
  createDemoAdThemeFixtures,
  createEligibilityTokenFixture,
  createIntentContextFixture
} from "../src/domain/demo-fixtures";
import { selectAdOpportunity } from "../src/domain/matching";

const now = "2026-05-20T06:30:00.000Z";
const fixtures = createDemoAdThemeFixtures(now);
const intentContext = createIntentContextFixture("travel", now);
const eligibilityToken = createEligibilityTokenFixture({
  id: "eligibility_demo",
  snapshotId: "snapshot_demo",
  intentTags: ["travel", "weekend"],
  now
});

const decision = selectAdOpportunity({
  intentContext,
  retrievalSafeSummary: intentContext.currentNeedSummary,
  eligibilityToken,
  candidates: fixtures,
  now
});

if (decision.opportunity) {
  const interstitial = generateInteractiveSponsoredInterstitial({
    opportunity: decision.opportunity,
    interstitialId: "interstitial_demo",
    generatedAt: now
  });
}
```

## Prepared Creative Variants

Campaign fixtures attach a `preparedCreativeSet` before matching. Each allowed
interaction template gets a prepared variant:

- `choice` includes option-specific result copy and highlight text.
- `slider` includes range bands used by the User Chat meter visualization.
- `short_text` includes a brief template that reflects the user's one-line input.

At render time, `generateInteractiveSponsoredInterstitial` selects the prepared
variant for the chosen opportunity template and only adds runtime disclosure,
metadata, and guard validation. The service answer path still receives no ad
interaction state.

## Live Matching Paths

When `OPENROUTER_API_KEY` is configured, `/api/live-scenario` evaluates active
campaigns by their advertiser-selected matching mode before rendering the
sponsored message.

- Fast Matching calls the OpenRouter embeddings endpoint, embeds the
  privacy-safe conversation context plus approved campaign `embeddingQueries`,
  computes cosine similarity per campaign, and selects the highest scoring
  eligible Fast candidate.
- Professional Matching calls the OpenRouter chat completion endpoint with
  privacy-safe user context and all active approved campaign summaries, then
  lets the LLM choose one eligible active candidate with a bounded fit score.
- If any active campaign is set to Professional Matching, the whole active
  campaign set uses the Professional path. Fast Matching is used only when every
  active campaign is set to Fast.

When no server API key is configured, the deterministic keyword/signal matcher
remains the fixture fallback so the demo stays runnable offline.

## Known Limits

- Live matching is currently wired to `/api/live-scenario`; database
  persistence of embedding vectors and per-campaign matching mode settings is
  not implemented.
- Prepared creative variants are generated in the demo fixture/campaign
  boundary, not persisted in a production database table yet.
- Policy guard validates exact prohibited claim strings and must-include
  attributes; deeper claim grounding belongs to later hardening.
- Context-retention settlement evidence still uses deterministic RAG-style token
  retrieval; a live embedding retriever for retention remains a later hardening
  step.

## Porting Checklist

- Keep `EligibilityToken` and retrieval-safe summaries as the only user context
  inputs to matching.
- Never pass raw transcripts, profile vectors, or ad interaction state into the
  Answer Agent.
- Keep `Sponsored` label validation in the guard before rendering.
- Preserve campaign-level frequency cap and category opt-out checks.
- Keep live Fast/Professional selection behind the existing privacy-safe
  matching contract; do not pass raw transcripts or profile vectors to
  advertisers.
