# Agentic Ad Firewall Demo Script

## One-Minute Judge Path

1. Open `/user-chat` and choose one of the three seed presets: Travel, Productivity, or Learning.
2. Submit or inspect the user question in the chat screen.
3. Point out that the answer is blocked by a full sponsored interstitial, not mixed into the answer body.
4. Use the ad micro-interaction once.
5. Open Ad info and show that the advertiser does not receive raw conversation, profile, or a direct identifier.
6. Continue through the CTA, dismiss, or not-relevant control.
7. Show the service answer appearing as a separate answer bubble.
8. Open `/advertiser-console` and show the natural-language target policy editor plus compiled policy preview.
9. Open Platform Review and show context signals, approved claims, prohibited claims, and review status.
10. Open Settlement Dashboard and show attention score, proof hash, transaction hash, and `SettlementClaimed`.
11. Add the AI Security custom preset from the builder and switch back to `/user-chat` to show that the demo is not limited to three ad types.
12. Enter an OpenRouter API key in the session field and refresh LLM output to show live structured-output mode; leave it blank to show deterministic fixture fallback.

## Required Proof Points

- The user-facing UI is English.
- Every ad has a `Sponsored` label.
- The ad appears before the service answer.
- The advertiser sees campaign-level aggregate metrics only.
- Natural-language target policies compile into auditable summaries and hashes.
- Sensitive targeting edits are blocked by the compile API.
- Attention signals produce a dashboard-ready testnet transaction hash.
- User Chat and Advertiser Console are separate screens.
- The three bundled campaigns are default presets, and a fourth custom preset can be added during the demo.
- OpenRouter structured-output calls are used only when a key is provided; live output still passes schema validation and policy guard checks.

## Seeded Demo Themes

- Travel and local experiences: Atlas Local
- Productivity or SaaS tools: FlowPilot
- Online learning or professional upskilling: SkillForge
- Addable custom preset: GuardLayer AI Security
