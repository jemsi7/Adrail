# Adrail Demo UX

## What This Asset Does

This asset implements the Phase 4 demo UX layer for Adrail. It
assembles the Phase 1-3 domain contracts into judge-ready screens with user
chat, pre-answer sponsored interstitial, advertiser policy preview, platform
review, privacy disclosure, custom preset creation, OpenRouter live refresh,
and settlement dashboard data.

## Interfaces

- `buildPhase4DemoScenario(input)`
- `buildAllPhase4DemoScenarios(now, customPresets)`
- `DemoPresetDraft`
- `Phase4DemoApp`
- `POST /api/compile-policy`
- `POST /api/demo-scenarios`
- `POST /api/live-scenario`

## Internal Dependencies

- `src/domain/demo-ux.ts`
- `src/domain/demo-fixtures.ts`
- `src/domain/matching.ts`
- `src/domain/ad-generation.ts`
- `src/domain/attention.ts`
- `src/domain/settlement.ts`
- `src/ui/phase4-demo-app.tsx`
- `app/page.tsx`
- `app/user-chat/page.tsx`
- `app/advertiser-console/page.tsx`
- `app/api/compile-policy/route.ts`
- `app/api/demo-scenarios/route.ts`
- `app/api/live-scenario/route.ts`
- `src/ai/openrouter.ts`
- `src/ai/live-llm.ts`

## External Dependencies

- Next.js
- React
- Zod
- Vitest for tests

## Example

```ts
import { buildPhase4DemoScenario } from "../src/domain/demo-ux";

const scenario = buildPhase4DemoScenario({ theme: "productivity" });

console.log(scenario.adExperience.interstitial.label);
console.log(scenario.settlementDashboard.transactionHash);
```

## Known Limits

- The local demo uses deterministic fixtures for model output and transaction
  submission when no OpenRouter key is configured.
- OpenRouter live output is accepted only after structured JSON parsing, schema
  validation, and sponsored policy guard checks.
- The compile API updates policy previews but does not persist campaigns to a
  database.
- Live wallet, RPC, and deployed contract wiring remain deployment work.

## Porting Checklist

- Keep the service answer separate from advertiser targeting data.
- Keep policy compilation on the server because hashing uses Node crypto.
- Keep the OpenRouter API key server-side in `.env`; do not add browser key
  fields, session storage, or client header injection.
- Do not expose raw transcript, user profile, direct user id, or eligibility
  token in advertiser-facing views.
- Keep the six seed presets intact for the MVP judge path, but do not treat
  them as an exhaustive ad-type enum.
- Route User Chat and Advertiser Console separately when porting the demo shell.
