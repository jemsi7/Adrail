# Adrail

Adrail is an AI advertising transparency and settlement prototype for agentic
services.

The core idea is simple: in AI chat products, ads should not be hidden inside
the assistant's answer. Adrail separates the sponsored moment from the service
answer, makes the ad clearly labeled, protects raw user data from advertisers,
and turns verified attention into an auditable settlement event.

## Problem

In traditional web products, users can usually tell where content ends and ads
begin. In agentic AI products, the answer, recommendation, comparison, and next
action can all appear inside one conversational flow. If paid promotion is mixed
directly into that answer, users lose the ability to distinguish service advice
from sponsored influence.

Adrail treats that separation as the product.

## Solution

Adrail shows a short interactive `Sponsored` message before the assistant answer.
The ad can respond to the user's current need, but it remains visually and
systemically separate from the service answer.

Advertisers do not receive raw transcripts, profile vectors, or direct user
identifiers. They write an English natural-language targeting policy, and the
platform compiles it into an auditable internal policy summary and hash.

When a privacy-safe attention signal is verified, the demo can produce a
settlement-ready proof and testnet escrow transaction record.

## Demo Surfaces

- `/user-chat`: user-facing chat with a pre-answer sponsored message and a
  separate service answer bubble.
- `/advertiser-console`: campaign setup, natural-language targeting, review,
  performance, wallet funding, and settlement history.

The bundled campaigns are seed presets, not a fixed ad taxonomy. A custom
advertiser preset can be added from the console and then used in User Chat.

## What The Demo Proves

- Sponsored content is labeled and appears before the service answer.
- The service answer is generated separately from ad targeting and ad
  interaction state.
- Advertisers see campaign-level outcomes, not raw user conversations.
- Natural-language targeting policies compile into auditable summaries and
  policy hashes.
- Attention signals can become settlement-ready proofs.
- OpenRouter live mode is server-side only; keys are never entered in the
  browser.
- Fixture mode works without external API keys for reliable local demos.

## Quick Start

```bash
git clone https://github.com/jemsi7/Adrail.git
cd Adrail
npm install
cp .env.example .env
npm run dev
```

Then open:

- `http://localhost:3000/user-chat`
- `http://localhost:3000/advertiser-console`

With placeholder env values, the app runs in deterministic fixture mode. Add
server-side values in `.env` only when you want OpenRouter live output or live
testnet settlement.

## Optional Live Modes

OpenRouter live mode:

- Set `OPENROUTER_API_KEY` in `.env`.
- The browser never accepts or stores the key.
- Provider failures are shown as live errors instead of silently falling back to
  fixtures.

Testnet settlement mode:

- Set the settlement values listed in `.env.example`.
- Use testnet-only wallets and private keys.
- Do not use mainnet keys or wallets with real funds.
- See `docs/testnet-escrow-runbook.md` for the full flow.

## Commands

```bash
npm run dev
npm test
npm run typecheck
npm run build
npm run contract:test
```

Additional testnet scripts are available in `package.json` for contract deploy,
deposit, and settlement claim flows.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Vitest
- Solidity + Hardhat
- Viem
- Drizzle schema definitions
- OpenRouter for live LLM and embedding calls

## Privacy And Secret Boundary

Do not commit `.env`, API keys, private keys, seed phrases, local databases,
screenshots with sensitive data, generated decks, or local build output.

The repo intentionally ignores `.env`, `.next/`, local tool state, screenshots,
document exports, generated outputs, and Office lock files.

## More Detail

- `docs/demo-script.md`: one-minute demo path
- `docs/testnet-escrow-runbook.md`: testnet escrow setup and validation
- `docs/definitions/`: locked product, logic, UI, stack, config, test, and
  phase documents
- `docs/specs/`: reusable code asset specs
