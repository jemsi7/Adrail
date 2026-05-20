# Agentic Ad Firewall

AI advertising transparency and settlement infrastructure for agentic services.

The MVP keeps service answers and sponsored content separate by rendering an
interactive sponsored interstitial before the answer. Advertisers write English
natural-language target policies, the platform compiles them into auditable
internal policy objects, and attention proofs can be settled through a testnet
escrow contract.

## Demo Screens

- `/user-chat`: user-facing chat with the pre-answer sponsored interstitial.
- `/advertiser-console`: advertiser policy editor, preset builder, platform review, and settlement dashboard.

The three bundled campaigns are seed presets, not a fixed taxonomy. Add another
demo preset in the Advertiser Console and it will also appear in User Chat.

OpenRouter is live-ready. Add `OPENROUTER_API_KEY` to `.env` or enter a key in
the demo screen session field to use structured-output LLM calls; without a key,
the deterministic fixture path stays available.


## Commands

```bash
npm install
npm run dev
npm test
npm run typecheck
```
