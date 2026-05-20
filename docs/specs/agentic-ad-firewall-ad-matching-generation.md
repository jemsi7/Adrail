# Agentic Ad Firewall Ad Matching And Generation

## What This Asset Does

This asset implements Phase 2 of Agentic Ad Firewall: it compiles advertiser
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
- `src/domain/ad-generation.ts`
- `src/domain/demo-fixtures.ts`
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

## Known Limits

- Matching uses deterministic keyword/signal overlap fixtures, not live
  embeddings.
- The React renderer is component-ready but not yet mounted in a Next.js page.
- Policy guard validates exact prohibited claim strings and must-include
  attributes; deeper claim grounding belongs to later hardening.
- No database persistence or API route wiring is included in Phase 2.

## Porting Checklist

- Keep `EligibilityToken` and retrieval-safe summaries as the only user context
  inputs to matching.
- Never pass raw transcripts, profile vectors, or ad interaction state into the
  Answer Agent.
- Keep `Sponsored` label validation in the guard before rendering.
- Preserve campaign-level frequency cap and category opt-out checks.
- Add live embedding/RAG and LLM adjudication behind the existing deterministic
  interfaces rather than changing the public contract.
