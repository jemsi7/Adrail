# Adrail

AI advertising transparency and settlement infrastructure for agentic services.

The MVP keeps service answers and sponsored content separate by rendering an
interactive sponsored interstitial before the answer. Advertisers write English
natural-language target policies, the platform compiles them into auditable
internal policy objects, and attention proofs can be settled through a testnet
escrow contract.

## Demo Screens

- `/user-chat`: user-facing chat with the pre-answer sponsored interstitial.
- `/advertiser-console`: advertiser policy editor, preset builder, platform review, and settlement dashboard.

The six bundled campaigns are seed presets, not a fixed taxonomy. Add another
demo preset in the Advertiser Console and it will also appear in User Chat.

OpenRouter is live-ready. Add `OPENROUTER_API_KEY` to `.env` to use
structured-output LLM calls. When the key is configured, User Chat opens on a
clean new-chat thread, hides the preset selector, and uses the live LLM path
only; provider failures are surfaced instead of falling back to fixture content.
Without that value, the deterministic fixture path stays available. The demo
screen never accepts or stores the OpenRouter key in the browser.

## Phase 1 Scope

- Core campaign, ad pool, policy, interstitial, attention, and settlement schemas.
- Platform-private personal intelligence and privacy-safe eligibility token schemas.
- Boundary helpers that keep campaign/ad interaction data out of answer-agent input.
- Advertiser response filtering that excludes personal data.
- Deterministic tests for the Phase 1 boundary guarantees.

## Commands

```bash
npm install
npm run dev
npm test
npm run typecheck
```

`npm run dev` binds the Next dev server to `0.0.0.0` for LAN/mobile demos.
The dev config auto-allows the machine's current LAN IPv4 address for Next's
internal dev resources. For a custom demo host or tunnel, set
`NEXT_ALLOWED_DEV_ORIGINS=demo.local,*.ngrok-free.app` before starting the
server.
