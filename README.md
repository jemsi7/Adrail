# Agentic Ad Firewall

AI advertising transparency and settlement infrastructure for agentic services.

The MVP keeps service answers and sponsored content separate by rendering an
interactive sponsored interstitial before the answer. Advertisers write English
natural-language target policies, the platform compiles them into auditable
internal policy objects, and attention proofs can be settled through a testnet
escrow contract.

## Phase 1 Scope

- Core campaign, ad pool, policy, interstitial, attention, and settlement schemas.
- Platform-private personal intelligence and privacy-safe eligibility token schemas.
- Boundary helpers that keep campaign/ad interaction data out of answer-agent input.
- Advertiser response filtering that excludes personal data.
- Deterministic tests for the Phase 1 boundary guarantees.

## Commands

```bash
npm install
npm test
npm run typecheck
```
