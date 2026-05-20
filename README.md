# Adrail

Adrail is an AI advertising transparency and settlement demo for agentic
services. It keeps service answers and sponsored content visibly separate:
the user sees an interactive `Sponsored` message before the assistant answer,
advertisers describe targeting in English, and verified attention signals can
settle through a testnet escrow contract.

The repository is built for a hackathon-style product demo, but the code keeps
the important boundaries explicit: OpenRouter keys stay server-side, advertiser
screens do not expose raw user transcripts or profile vectors, and settlement
proofs use privacy-safe identifiers.

## What You Can Demo

- `User Chat`: a minimal chat surface where the sponsored message appears
  before the service answer.
- `Advertiser Console`: campaign setup, natural-language targeting, campaign
  review, performance, wallet funding, and settlement history.
- `OpenRouter live mode`: server-side structured output for ad generation,
  matching, and answer streaming when `OPENROUTER_API_KEY` is configured.
- `Fixture mode`: deterministic local demo data when no API key is configured.
- `Testnet escrow`: Solidity escrow contract, deposit script, settlement claim
  script, and UI/API boundaries for funding and spend ledger flows.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Vitest
- Solidity + Hardhat
- Drizzle schema definitions
- Viem for EVM testnet integration
- OpenRouter for live LLM and embedding calls

## Prerequisites

- Node.js 20 or newer
- npm
- Git
- Optional for live LLM mode: an OpenRouter API key
- Optional for live testnet settlement: an EVM testnet RPC URL, deployed escrow
  contract address, and testnet-only private keys

## Quick Start

```bash
git clone https://github.com/jemsi7/Adrail.git
cd Adrail
npm install
cp .env.example .env
npm run dev
```

Open the app:

- User chat: `http://localhost:3000/user-chat`
- Advertiser console: `http://localhost:3000/advertiser-console`

If `.env` still contains placeholder values, the app runs in deterministic
fixture mode. That is enough to review the core UX without any external API
calls.

## Environment Setup

Copy `.env.example` to `.env` and replace only the values you intend to use.
Never commit `.env`, private keys, seed phrases, local databases, screenshots,
or generated presentation/document exports.

### Fixture Mode

For the fastest local demo, leave `OPENROUTER_API_KEY=replace_me` and use:

```txt
APP_ENV=local
APP_LANGUAGE=en
DATABASE_URL=file:./local.db
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=replace_me
SETTLEMENT_MODE=simulated
```

In fixture mode:

- No OpenRouter calls are made.
- User Chat shows the bundled campaign selector.
- Sponsored copy, answer text, attention score, and proof data come from
  deterministic fixtures.
- Testnet private keys are not required.

### OpenRouter Live Mode

To use live LLM calls, set this in `.env`:

```txt
OPENROUTER_API_KEY=replace_me_with_your_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
ANSWER_MODEL=openai/gpt-4.1-mini
TARGET_POLICY_COMPILER_MODEL=openai/gpt-4.1-mini
AD_MEDIATOR_MODEL=openai/gpt-4.1-mini
INTERACTIVE_AD_MODEL=openai/gpt-4.1-mini
RETENTION_ADJUDICATOR_MODEL=openai/gpt-4.1-mini
EMBEDDING_MODEL=openai/text-embedding-3-small
```

Important behavior:

- The browser never accepts or stores the OpenRouter key.
- API routes read the key only from server environment variables.
- User Chat hides the preset selector when the key is configured.
- Provider failures are shown as live errors instead of silently falling back
  to fixtures.
- Live outputs still pass schema validation and policy guard logic before they
  are rendered.

### Testnet Settlement Mode

For live escrow deposit and settlement claim flows, set:

```txt
SETTLEMENT_MODE=testnet
CHAIN_ID=replace_me
ESCROW_CONTRACT_ADDRESS=replace_me
CHAIN_RPC_URL=replace_me
SETTLEMENT_SIGNER_PRIVATE_KEY=replace_me
ADVERTISER_DEPOSIT_WALLET=replace_me
ADVERTISER_DEPOSIT_PRIVATE_KEY=replace_me
SETTLEMENT_PAYOUT_RECIPIENT=replace_me
CAMPAIGN_DEPOSIT_AMOUNT_WEI=replace_me
SETTLEMENT_PAYOUT_AMOUNT_WEI=replace_me
PRIVACY_SALT=replace_me
AUDIT_LOG_SECRET=replace_me
```

Use testnet-only wallets. Do not use mainnet wallets or private keys with real
funds. The browser UI asks for a public wallet address only; private keys stay
behind server-side API routes.

See `docs/testnet-escrow-runbook.md` for the full contract deployment, deposit,
claim, and receipt-indexing workflow.

## Main App Flows

### User Chat

1. Open `/user-chat`.
2. In fixture mode, choose a seed campaign such as Travel, Productivity,
   Learning, Finance ops, Home energy, or Creator tools.
3. Submit a user question.
4. Confirm the `Sponsored` message appears before the service answer.
5. Use the micro-interaction, CTA, dismiss, or not relevant control.
6. Confirm the service answer appears as a separate answer bubble.
7. Open `Why this ad` or proof chips to inspect privacy and settlement details.

### Advertiser Console

1. Open `/advertiser-console`.
2. Review campaign status in the Campaigns view.
3. Create or edit a campaign using the staged setup flow.
4. Write an English natural-language targeting policy.
5. Inspect the compiled policy summary and policy hash.
6. Review allowed claims, prohibited claims, and campaign readiness.
7. In Settlement, validate wallet status and funding history.
8. In Performance, inspect privacy-safe aggregate attention signals.

### Custom Demo Preset

1. Open `/advertiser-console`.
2. Create a custom campaign preset with advertiser name, product summary,
   targeting policy, claims, interaction template, and CTA.
3. Activate the custom campaign.
4. Return to `/user-chat`.
5. The custom preset can be selected in fixture mode and participates in the
   same ad matching, sponsored rendering, proof, and settlement paths.

## Commands

```bash
npm run dev
npm run build
npm run start
npm test
npm run typecheck
npm run contract:compile
npm run contract:test
npm run contract:deploy:testnet
npm run contract:deposit:testnet
npm run contract:claim:testnet
```

Command notes:

- `npm run dev` starts Next.js on `0.0.0.0` for local LAN and mobile demos.
- `npm run build` creates the production Next.js build.
- `npm run start` runs `.next/standalone/server.js` after a successful build.
- `npm test` runs Vitest unit and integration tests.
- `npm run typecheck` runs TypeScript without emitting files.
- Contract commands require valid testnet config when they touch live networks.

## LAN And Tunnel Demos

The dev server binds to `0.0.0.0`, so another device on the same network can
open the demo using your machine's LAN IP.

For custom hosts or tunnels, set:

```txt
NEXT_ALLOWED_DEV_ORIGINS=demo.local,*.ngrok-free.app
```

Avoid `*` as a broad wildcard. Use explicit hosts or scoped subdomain patterns.

## Privacy And Secret Boundaries

Do not commit:

- `.env`, `.env.local`, `.env.production`
- OpenRouter API keys
- EVM private keys
- Wallet seed phrases
- Local databases with real user data
- Raw advertiser uploads containing secrets
- Screenshots or generated decks that may contain private data
- `.next/`, `outputs/`, DOCX/PDF exports, local tool state, or cache folders

The repository ignore rules exclude common local artifacts, including
`.env`, `.next/`, `.claude/`, `.impeccable/`, screenshots, generated outputs,
DOCX/PDF files, and Office lock files.

## Testing Checklist Before Pushing

Run these before opening or updating a pull request:

```bash
npm test
npm run typecheck
npm run build
npm run contract:test
git diff --check
```

Optional secret scan:

```bash
git status --ignored --short .env .env.local .env.production .next outputs
```

Then run your preferred secret scanner before pushing. The committed tree should
contain only placeholders such as `replace_me`, never real API keys, wallet
private keys, or tokens.

If `npm run contract:test` fails locally with a Hardhat compiler cache mutex
timeout, rerun it after confirming no other Hardhat process is holding the
compiler cache. This has been observed as a local tooling/cache issue rather
than a contract regression when a retry reports `No contracts to compile` and
all Solidity tests pass.

## Deploying From GitHub

The app can be deployed from this repository to a Node-compatible host that can
run Next.js standalone output.

Recommended build settings:

```txt
Install command: npm ci
Build command: npm run build
Start command: npm run start
```

Required production environment variables depend on the mode:

- Fixture-only demo: no real OpenRouter or testnet secrets are required.
- Live OpenRouter demo: set `OPENROUTER_API_KEY` and model variables.
- Live testnet demo: set the settlement variables listed above with testnet-only
  values.

The `.railwayignore` file excludes local screenshots, document exports, and
tool state from Railway-style deployments. GitHub source control is protected
separately through `.gitignore`.

## Project Structure

```txt
app/
  api/                         Next.js route handlers
  user-chat/                   User-facing chat route
  advertiser-console/          Advertiser console route
contracts/                     Solidity escrow contract
docs/
  definitions/                 Locked product, logic, UI, stack, and phase docs
  specs/                       Reusable code asset specs
scripts/                       Hardhat deploy/deposit/claim scripts
src/
  ai/                          OpenRouter adapters and live matching
  db/                          Drizzle schema definitions
  domain/                      Policy, matching, settlement, funding logic
  ui/                          Demo app and UI helpers
tests/                         Vitest coverage
test/                          Hardhat contract tests
```

## Demo Proof Points

- User-facing copy is English.
- Sponsored content is labeled `Sponsored`.
- The ad appears before the service answer, not inside the answer body.
- Advertisers see campaign-level aggregate metrics only.
- Natural-language target policies compile into auditable summaries and hashes.
- Sensitive targeting attempts are blocked by the compile path.
- Attention signals can create settlement-ready proofs and transaction records.
- User Chat and Advertiser Console are separate screens.
- Bundled campaigns are seed presets; custom presets follow the same pipeline.

## Documentation

- `docs/demo-script.md`: one-minute judge path and required proof points
- `docs/testnet-escrow-runbook.md`: live testnet escrow setup and validation
- `docs/definitions/`: locked product, logic, UI, tech stack, config, test, and
  phase documents
- `docs/specs/`: reusable asset specifications for data model, matching,
  settlement, and demo UX
