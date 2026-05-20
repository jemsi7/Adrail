import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { POST as compilePolicyPost } from "../app/api/compile-policy/route";
import UserChatPage from "../app/user-chat/page";
import { GET as advertiserFundingGet } from "../app/api/advertiser-funding/route";
import { POST as advertiserFundingDepositPost } from "../app/api/advertiser-funding/deposit/route";
import { POST as advertiserFundingSettlementClaimPost } from "../app/api/advertiser-funding/settlement-claim/route";
import { POST as advertiserFundingWalletPost } from "../app/api/advertiser-funding/wallet/route";
import {
  clearEscrowLedgerStore,
  recordEscrowLedgerEntry
} from "../src/domain/advertiser-funding-store";
import { containsForbiddenAdvertiserData } from "../src/domain/boundaries";
import {
  buildAllPhase4DemoScenarios,
  buildPhase4DemoScenario
} from "../src/domain/demo-ux";
import { POST as demoScenariosPost } from "../app/api/demo-scenarios/route";
import { POST as liveAnswerPost } from "../app/api/live-answer/route";
import { POST as liveScenarioPost } from "../app/api/live-scenario/route";
import {
  DEFAULT_CUSTOM_FORM,
  PerformanceDashboard,
  Phase4DemoApp,
  SponsoredAdLoadingFrame,
  UserChatPanel,
  buildAdvertiserFundingRefreshPath,
  canOpenCustomPresetBuilderStep,
  fetchAdvertiserFundingDashboard,
  formStateToPreset,
  getActiveMatchingModeStatus,
  isCustomPresetTheme,
  removeCustomPresetByTheme,
  resolveActiveDemoTheme,
  resolveMatchingModesByTheme,
  resolveSelectedCampaignThemes,
  shouldAutoClaimSettlement,
  shouldRenderSponsoredAdLoading,
  type CustomPresetFormState
} from "../src/ui/phase4-demo-app";
import {
  RESERVED_DEMO_PRESET_IDS,
  isReservedDemoPresetCampaignName,
  normalizeDemoPresetId,
  sanitizeDemoPresetDrafts,
  type DemoPresetDraft
} from "../src/domain/demo-presets";
import { LIVE_ANSWER_ERROR_MESSAGE } from "../src/ui/live-answer-error";
import {
  createRuntimePerformanceMeasurement,
  updateRuntimePerformanceWithFollowUp
} from "../src/ui/runtime-performance";

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
const originalOpenRouterBaseUrl = process.env.OPENROUTER_BASE_URL;
const originalSettlementMode = process.env.SETTLEMENT_MODE;
const settlementEnvKeys = [
  "CHAIN_ID",
  "CHAIN_RPC_URL",
  "ESCROW_CONTRACT_ADDRESS",
  "SETTLEMENT_SIGNER_PRIVATE_KEY",
  "SETTLEMENT_PAYOUT_RECIPIENT",
  "SETTLEMENT_PAYOUT_AMOUNT_WEI",
  "ADVERTISER_DEPOSIT_WALLET"
] as const;
const originalSettlementEnv = Object.fromEntries(
  settlementEnvKeys.map((key) => [key, process.env[key]])
);
const noop = () => undefined;

type LiveAnswerStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; providerMode: string }
  | { type: "error"; message: string; providerMode: string };

beforeEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.SETTLEMENT_MODE;
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearEscrowLedgerStore();

  if (originalOpenRouterApiKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
  }

  if (originalOpenRouterBaseUrl === undefined) {
    delete process.env.OPENROUTER_BASE_URL;
  } else {
    process.env.OPENROUTER_BASE_URL = originalOpenRouterBaseUrl;
  }

  if (originalSettlementMode === undefined) {
    delete process.env.SETTLEMENT_MODE;
  } else {
    process.env.SETTLEMENT_MODE = originalSettlementMode;
  }

  for (const key of settlementEnvKeys) {
    const originalValue = originalSettlementEnv[key];

    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
});

describe("Phase 4 demo UX scenario builder", () => {
  it("builds system seed campaigns with English demo copy", () => {
    const scenarios = buildAllPhase4DemoScenarios();

    expect(scenarios.map((scenario) => scenario.theme)).toEqual([...RESERVED_DEMO_PRESET_IDS]);
    expect(scenarios.every((scenario) => scenario.adExperience.interstitial.label === "Sponsored")).toBe(true);
    expect(scenarios.every((scenario) => !containsHangul(scenario))).toBe(true);
  });

  it("treats the bundled seed campaigns as presets and accepts an added demo preset", async () => {
    const response = await demoScenariosPost(new Request("http://localhost/api/demo-scenarios", {
      method: "POST",
      body: JSON.stringify({
        customPresets: [createSecurityPreset()]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.scenarios.map((scenario: { theme: string }) => scenario.theme)).toEqual([
      ...RESERVED_DEMO_PRESET_IDS,
      "custom_ai_security"
    ]);
    expect(payload.scenarios.at(-1).adExperience.interstitial.label).toBe("Sponsored");
    expect(payload.scenarios.at(-1).advertiserConsole.advertiserName).toBe("GuardLayer");
    expect(payload.customPresets.at(-1).preparedCreativeSet.variants.at(0).interactionType).toBe("choice");
  });

  it("normalizes custom campaign preset ids for route selection", async () => {
    const response = await demoScenariosPost(new Request("http://localhost/api/demo-scenarios", {
      method: "POST",
      body: JSON.stringify({
        customPresets: [{
          ...createSecurityPreset(),
          id: "AI Security Review"
        }]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.scenarios.map((scenario: { theme: string }) => scenario.theme)).toContain("ai_security_review");
    expect(normalizeDemoPresetId("AI Security Review")).toBe("ai_security_review");
  });

  it("rejects API custom preset ids that normalize to reserved seed ids", async () => {
    const response = await demoScenariosPost(new Request("http://localhost/api/demo-scenarios", {
      method: "POST",
      body: JSON.stringify({
        customPresets: [{
          ...createSecurityPreset(),
          id: "Travel"
        }]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid custom demo preset payload.");
    expect(JSON.stringify(payload.issues)).toContain("reserved");
  });

  it("rejects API custom preset campaign names that duplicate seed campaigns", async () => {
    const response = await demoScenariosPost(new Request("http://localhost/api/demo-scenarios", {
      method: "POST",
      body: JSON.stringify({
        customPresets: [{
          ...createSecurityPreset(),
          id: "atlas_clone",
          advertiserName: "Atlas Local",
          campaignName: "Atlas Local Weekend"
        }]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid custom demo preset payload.");
    expect(JSON.stringify(payload.issues)).toContain("campaign name");
  });

  it("deduplicates custom preset scenarios by normalized id before rendering", () => {
    const scenarios = buildAllPhase4DemoScenarios(undefined, [
      {
        ...createSecurityPreset(),
        id: "AI Security Review",
        advertiserName: "First GuardLayer"
      },
      {
        ...createSecurityPreset(),
        id: "ai_security_review",
        advertiserName: "Second GuardLayer"
      }
    ]);

    expect(scenarios.map((scenario) => scenario.theme)).toEqual([
      ...RESERVED_DEMO_PRESET_IDS,
      "ai_security_review"
    ]);
    expect(scenarios.at(-1)?.advertiserConsole.advertiserName).toBe("Second GuardLayer");
  });

  it("keeps custom campaign registry scenarios from being replaced by seed matches", () => {
    const scenarios = buildAllPhase4DemoScenarios(undefined, [
      {
        ...createSecurityPreset(),
        id: "weekend_clone",
        navigationLabel: "Weekend Clone",
        advertiserName: "Weekend Studio",
        campaignName: "Weekend Studio Planner",
        objective: "Start a privacy-safe weekend planning session",
        productServiceSummary: "Curated weekend itinerary planning for food, nature, and culture.",
        naturalLanguageTargetPolicy: "Reach people currently planning weekend travel, itinerary ideas, food, culture, or nature trips.",
        mustIncludeAttributes: [
          "Budget-aware weekend options",
          "Food and nature itinerary ideas"
        ],
        userQuestion: "Can you help me plan a relaxed weekend trip with food and nature nearby?"
      }
    ]);

    expect(scenarios.map((scenario) => scenario.theme)).toEqual([
      ...RESERVED_DEMO_PRESET_IDS,
      "weekend_clone"
    ]);
    expect(new Set(scenarios.map((scenario) => scenario.fixture.campaign.id)).size).toBe(scenarios.length);
    expect(scenarios.at(-1)?.advertiserConsole.advertiserName).toBe("Weekend Studio");
  });

  it("deduplicates custom preset drafts by campaign display name", () => {
    const sanitized = sanitizeDemoPresetDrafts([
      {
        ...createSecurityPreset(),
        id: "first_ai_security",
        advertiserName: "First GuardLayer"
      },
      {
        ...createSecurityPreset(),
        id: "second_ai_security",
        advertiserName: "Second GuardLayer",
        campaignName: "GuardLayer Agent Reviews"
      }
    ]);

    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]).toMatchObject({
      id: "second_ai_security",
      advertiserName: "Second GuardLayer"
    });
  });

  it("returns a recoverable error when a custom preset cannot produce an eligible campaign", async () => {
    const response = await demoScenariosPost(new Request("http://localhost/api/demo-scenarios", {
      method: "POST",
      body: JSON.stringify({
        customPresets: [{
          ...createSecurityPreset(),
          naturalLanguageTargetPolicy: "Reach people based on religion and political affiliation."
        }]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error).toBe("Unable to build demo scenarios from the provided campaign presets.");
    expect(payload.detail).toContain("did not produce an eligible sponsored scenario");
  });

  it("keeps the pre-answer sponsored interstitial separate from the service answer", () => {
    const scenario = buildPhase4DemoScenario({ theme: "travel" });

    expect(scenario.userChat.sequence).toEqual([
      "user_question",
      "pre_answer_sponsored_interstitial",
      "service_answer",
      "follow_up_retention"
    ]);
    expect(scenario.adExperience.interstitial.label).toBe("Sponsored");
    expect(scenario.userChat.serviceAnswer).not.toContain(scenario.advertiserConsole.advertiserName);
    expect(scenario.userChat.serviceAnswer).not.toContain(scenario.advertiserConsole.campaignName);
    expect(scenario.userChat.serviceAnswer).not.toContain("Sponsored");
  });

  it("shows advertiser and review data without personal user fields", () => {
    const scenario = buildPhase4DemoScenario({ theme: "productivity" });

    expect(containsForbiddenAdvertiserData(scenario.advertiserConsole)).toBe(false);
    expect(scenario.advertiserConsole.naturalLanguageTargetPolicySource).toContain("workflow automation");
    expect(scenario.advertiserConsole.compiledPolicy.safetyVerdict).toBe("approved");
    expect(scenario.platformReview.requiredContextSignals).toContain("productivity");
    expect(scenario.platformReview.mustIncludeAttributes).toContain("Security review checklist");
    expect(scenario.platformReview.violations).toEqual([]);
  });

  it("renders a settled dashboard-ready testnet transaction", () => {
    const scenario = buildPhase4DemoScenario({ theme: "learning" });

    expect(scenario.settlementDashboard.attentionEvent.settlementEligible).toBe(true);
    expect(scenario.settlementDashboard.settlementEvent.status).toBe("settled");
    expect(scenario.settlementDashboard.transaction.status).toBe("confirmed");
    expect(scenario.settlementDashboard.transactionHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(scenario.settlementDashboard.contractEventStatus).toBe("SettlementClaimed");
    expect(scenario.settlementDashboard.settlementProof.pseudonymousUserProof).toHaveLength(64);
    expect(scenario.settlementDashboard.settlementProof.pseudonymousUserProof).not.toContain("user");
  });

  it("builds a funding dashboard with deposit, attention debit, and available balance", () => {
    const scenario = buildPhase4DemoScenario({ theme: "travel" });

    expect(scenario.fundingDashboard.walletProfile.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(scenario.fundingDashboard.summary.depositedWei).toBe("10000000000000000");
    expect(scenario.fundingDashboard.summary.spentWei).toBe("100000000000000");
    expect(scenario.fundingDashboard.summary.availableWei).toBe("9900000000000000");
    expect(scenario.fundingDashboard.ledgerEntries.map((entry) => entry.type)).toEqual([
      "deposit",
      "attention_debit"
    ]);
  });
});

describe("Advertiser funding API", () => {
  it("returns a funding dashboard without exposing private keys", async () => {
    const response = await advertiserFundingGet(new Request("http://localhost/api/advertiser-funding?theme=travel"));
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload.fundingDashboard.summary.availableWei).toBe("9900000000000000");
    expect(serialized).not.toContain("PRIVATE_KEY");
    expect(serialized).not.toContain("SETTLEMENT_SIGNER");
  });

  it("refreshes the funding dashboard with a no-store request for settlement tab loads", async () => {
    const scenario = buildPhase4DemoScenario({ theme: "travel" });
    const expectedPath = "/api/advertiser-funding?theme=travel&campaignId=campaign_travel_001";
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe(expectedPath);
      expect(init?.cache).toBe("no-store");

      return Response.json({
        fundingDashboard: scenario.fundingDashboard
      });
    });

    expect(buildAdvertiserFundingRefreshPath({
      theme: scenario.theme,
      campaignId: scenario.fixture.campaign.id
    })).toBe(expectedPath);

    const refreshedDashboard = await fetchAdvertiserFundingDashboard({
      theme: scenario.theme,
      campaignId: scenario.fixture.campaign.id,
      fetcher
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(refreshedDashboard.summary.availableWei).toBe("9900000000000000");
    expect(refreshedDashboard.ledgerEntries.map((entry) => entry.type)).toEqual([
      "deposit",
      "attention_debit"
    ]);
  });

  it("returns stored live settlement ledger rows in testnet wallet history", async () => {
    process.env.SETTLEMENT_MODE = "testnet";
    process.env.CHAIN_ID = "84532";
    process.env.ESCROW_CONTRACT_ADDRESS = "0x88ca42ba054470cec6a31e8a25e8368634340b9a";
    process.env.ADVERTISER_DEPOSIT_WALLET = "0xf382e32067B8231e57C69Dbcd550A495892F6B83";

    const scenario = buildPhase4DemoScenario({ theme: "travel" });

    recordEscrowLedgerEntry(scenario.fundingDashboard.ledgerEntries[0]);
    recordEscrowLedgerEntry(scenario.fundingDashboard.ledgerEntries[1]);

    const response = await advertiserFundingGet(new Request(
      "http://localhost/api/advertiser-funding?theme=travel&campaignId=campaign_travel_001"
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.fundingDashboard.ledgerEntries.map((entry: { type: string }) => entry.type)).toEqual([
      "deposit",
      "attention_debit"
    ]);
    expect(payload.fundingDashboard.summary.spentWei).toBe("100000000000000");
  });

  it("keeps testnet wallet history readable when a live debit is indexed before a local deposit row", async () => {
    process.env.SETTLEMENT_MODE = "testnet";
    process.env.CHAIN_ID = "84532";
    process.env.ESCROW_CONTRACT_ADDRESS = "0x88ca42ba054470cec6a31e8a25e8368634340b9a";
    process.env.ADVERTISER_DEPOSIT_WALLET = "0xf382e32067B8231e57C69Dbcd550A495892F6B83";

    const scenario = buildPhase4DemoScenario({ theme: "travel" });

    recordEscrowLedgerEntry(scenario.fundingDashboard.ledgerEntries[1]);

    const response = await advertiserFundingGet(new Request(
      "http://localhost/api/advertiser-funding?theme=travel&campaignId=campaign_travel_001"
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.fundingDashboard.ledgerEntries.map((entry: { type: string }) => entry.type)).toEqual([
      "deposit",
      "attention_debit"
    ]);
    expect(payload.fundingDashboard.summary.availableWei).toBe("9900000000000000");
  });

  it("validates wallet address format through the server boundary", async () => {
    const response = await advertiserFundingWalletPost(new Request("http://localhost/api/advertiser-funding/wallet", {
      method: "POST",
      body: JSON.stringify({
        advertiserId: "advertiser_atlas",
        walletAddress: "not-a-wallet"
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/valid EVM wallet/i);
  });

  it("does not submit live deposits outside testnet settlement mode", async () => {
    process.env.SETTLEMENT_MODE = "simulated";

    const response = await advertiserFundingDepositPost(new Request("http://localhost/api/advertiser-funding/deposit", {
      method: "POST",
      body: JSON.stringify({
        advertiserId: "advertiser_atlas",
        campaignId: "campaign_travel_001",
        walletAddress: "0xf382e32067B8231e57C69Dbcd550A495892F6B83",
        amountEth: "0.01",
        policyHash: "a".repeat(64)
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/SETTLEMENT_MODE=testnet/);
  });

  it("does not submit live settlement claims outside testnet settlement mode", async () => {
    process.env.SETTLEMENT_MODE = "simulated";
    const scenario = buildPhase4DemoScenario({ theme: "travel" });

    const response = await advertiserFundingSettlementClaimPost(new Request(
      "http://localhost/api/advertiser-funding/settlement-claim",
      {
        method: "POST",
        body: JSON.stringify({
          advertiserId: scenario.fixture.campaign.advertiserId,
          campaignId: scenario.fixture.campaign.id,
          theme: scenario.theme,
          walletAddress: scenario.fundingDashboard.walletProfile.walletAddress,
          policyHash: scenario.fundingDashboard.account.policyHash
        })
      }
    ));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/SETTLEMENT_MODE=testnet/);
  });

  it("rejects automatic settlement claim requests when measured attention is below threshold", async () => {
    process.env.SETTLEMENT_MODE = "testnet";
    process.env.CHAIN_ID = "84532";
    process.env.CHAIN_RPC_URL = "http://127.0.0.1:8545";
    process.env.ESCROW_CONTRACT_ADDRESS = "0x88ca42ba054470cec6a31e8a25e8368634340b9a";
    process.env.SETTLEMENT_SIGNER_PRIVATE_KEY = "0x" + "1".repeat(64);
    process.env.SETTLEMENT_PAYOUT_RECIPIENT = "0xf382e32067B8231e57C69Dbcd550A495892F6B83";
    process.env.SETTLEMENT_PAYOUT_AMOUNT_WEI = "100000000000000";
    const scenario = buildPhase4DemoScenario({ theme: "travel" });

    const response = await advertiserFundingSettlementClaimPost(new Request(
      "http://localhost/api/advertiser-funding/settlement-claim",
      {
        method: "POST",
        body: JSON.stringify({
          advertiserId: scenario.fixture.campaign.advertiserId,
          campaignId: scenario.fixture.campaign.id,
          theme: scenario.theme,
          walletAddress: scenario.fundingDashboard.walletProfile.walletAddress,
          policyHash: scenario.fundingDashboard.account.policyHash,
          attentionMeasurement: {
            source: "browser_session",
            campaignId: scenario.fixture.campaign.id,
            interstitialId: scenario.adExperience.interstitial.id,
            measuredAt: "2026-05-20T06:32:00.000Z",
            scoreBps: 1000,
            thresholdBps: 6500,
            signalTypes: ["dwell"]
          }
        })
      }
    ));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/below the campaign settlement threshold/i);
  });
});

describe("Phase 4 live scenario API", () => {
  it("ignores browser-provided OpenRouter headers and falls back without a server env key", async () => {
    const response = await liveScenarioPost(new Request("http://localhost/api/live-scenario", {
      method: "POST",
      headers: {
        "x-openrouter-api-key": "sk-or-browser-session-test"
      },
      body: JSON.stringify({
        theme: "travel",
        customPresets: []
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.providerMode).toBe("deterministic_fixture");
    expect(payload.scenario.theme).toBe("travel");
    expect(payload.fallbackReason).toContain("No OpenRouter API key");
  });

  it("accepts a submitted user chat question in the live scenario boundary", async () => {
    const submittedQuestion = "Can you help me compare quiet weekend options near Seoul?";
    const response = await liveScenarioPost(new Request("http://localhost/api/live-scenario", {
      method: "POST",
      body: JSON.stringify({
        theme: "travel",
        customPresets: [],
        userQuestion: submittedQuestion
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.providerMode).toBe("deterministic_fixture");
    expect(payload.scenario.userChat.userQuestion).toBe(submittedQuestion);
  });

  it("selects the best matching ad campaign from multiple readyThemes and aligns the scenario parameters", () => {
    const scenario = buildPhase4DemoScenario({
      theme: "travel",
      readyThemes: ["travel", "productivity"],
      userQuestion: "How can my team save time on repeated workflow handoffs?"
    });

    expect(scenario.theme).toBe("productivity");
    expect(scenario.advertiserConsole.campaignName).toBe("FlowPilot Teams");
    expect(scenario.settlementDashboard.attentionEvent.campaignId).toBe("campaign_productivity_001");
    expect(scenario.fundingDashboard.account.campaignId).toBe("campaign_productivity_001");
  });

  it("accepts readyThemes in live scenario API post and returns matched dynamic theme scenario", async () => {
    const response = await liveScenarioPost(new Request("http://localhost/api/live-scenario", {
      method: "POST",
      body: JSON.stringify({
        theme: "travel",
        customPresets: [],
        readyThemes: ["travel", "learning"],
        userQuestion: "What should I learn to move into a product operations role?"
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.scenario.theme).toBe("learning");
    expect(payload.scenario.advertiserConsole.advertiserName).toBe("SkillForge");
    expect(payload.scenario.settlementDashboard.attentionEvent.campaignId).toBe("campaign_learning_001");
  });

  it("uses OpenRouter embeddings and cosine similarity to select the displayed sponsored campaign", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-server-test";
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      if (String(url).includes("/embeddings")) {
        const inputs = body.input as string[];

        expect(inputs[0]).toContain("Latest user message");
        expect(inputs[0]).toContain("relaxed weekend trip");

        return new Response(JSON.stringify({
          data: inputs.map((text, index) => ({
            embedding: index === 0 || /learning|course|upskill|professional|certification|training/i.test(text)
              ? [0, 1]
              : [1, 0]
          }))
        }), { status: 200 });
      }

      expect(String(url)).toContain("/chat/completions");
      expect(body.response_format.json_schema.name).toBe("sponsored_interstitial_copy");

      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headline: "A skill path matched by embeddings",
                body: "Build a focused learning path from the current request.",
                cardDetails: [
                  { title: "Path", detail: "Project-based sequence" }
                ],
                interactionPrompt: "Choose a learning focus",
                ctaLabel: "Draft my learning path"
              })
            }
          }
        ]
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await liveScenarioPost(new Request("http://localhost/api/live-scenario", {
      method: "POST",
      body: JSON.stringify({
        theme: "travel",
        customPresets: [],
        readyThemes: ["travel", "learning"],
        userQuestion: "Can you help me plan a relaxed weekend trip with food and nature nearby?"
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.providerMode).toBe("openrouter_live");
    expect(payload.scenario.theme).toBe("learning");
    expect(payload.scenario.advertiserConsole.advertiserName).toBe("SkillForge");
    expect(payload.scenario.adExperience.interstitial.headline).toContain("A skill path matched by embeddings");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining("/embeddings"),
      expect.stringContaining("/chat/completions")
    ]);
  });

  it("uses Professional Matching for campaigns switched to LLM selection", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-server-test";
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      expect(String(url)).not.toContain("/embeddings");

      expect(String(url)).toContain("/chat/completions");

      if (body.response_format.json_schema.name === "professional_ad_selection") {
        const payload = JSON.parse(body.messages.at(-1).content);

        expect(payload.candidates.map((candidate: { theme: string }) => candidate.theme)).toEqual([
          "travel",
          "productivity"
        ]);

        return new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  selectedCampaignId: "campaign_productivity_001",
                  rationale: "The current need asks for workflow handoff automation.",
                  fitScore: 0.94
                })
              }
            }
          ]
        }), { status: 200 });
      }

      expect(body.response_format.json_schema.name).toBe("sponsored_interstitial_copy");

      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headline: "A workflow ad picked by Professional Matching",
                body: "Reduce repeated handoffs with a private team workflow recommendation.",
                cardDetails: [
                  { title: "Automation", detail: "Turn repeated updates into a shared flow" }
                ],
                interactionPrompt: "Choose a workflow bottleneck",
                ctaLabel: "Map my workflow"
              })
            }
          }
        ]
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await liveScenarioPost(new Request("http://localhost/api/live-scenario", {
      method: "POST",
      body: JSON.stringify({
        theme: "travel",
        customPresets: [],
        readyThemes: ["travel", "productivity"],
        matchingModesByTheme: {
          productivity: "professional"
        },
        userQuestion: "How can my team save time on repeated workflow handoffs?"
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.providerMode).toBe("openrouter_live");
    expect(payload.scenario.theme).toBe("productivity");
    expect(payload.scenario.advertiserConsole.advertiserName).toBe("FlowPilot");
    expect(payload.scenario.adExperience.interstitial.headline).toContain("Professional Matching");
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining("/chat/completions"),
      expect.stringContaining("/chat/completions")
    ]);
  });

  it("streams deterministic fixture answers when no server OpenRouter key is configured", async () => {
    const response = await liveAnswerPost(new Request("http://localhost/api/live-answer", {
      method: "POST",
      headers: {
        "x-openrouter-api-key": "sk-or-browser-session-test"
      },
      body: JSON.stringify({
        theme: "travel",
        customPresets: []
      })
    }));
    const events = await readSseEvents(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(events.at(-1)).toMatchObject({
      type: "done",
      providerMode: "deterministic_fixture"
    });
    expect(events.filter((event) => event.type === "delta").map((event) => event.text).join(""))
      .toContain("A solid weekend plan starts");
  });

  it("streams only the service answer text from OpenRouter structured output", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-server-test";
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      expect(body.stream).toBe(true);
      expect(body.response_format.json_schema.name).toBe("service_answer");
      expect(JSON.stringify(body.messages)).not.toContain("advertiserName");
      expect(JSON.stringify(body.messages)).not.toContain("campaignName");

      return new Response([
        `data: ${JSON.stringify({ choices: [{ delta: { content: "{\"answer\":\"A streamed " } }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: "private answer.\"}" } }] })}\n\n`,
        "data: [DONE]\n\n"
      ].join(""), {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream"
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await liveAnswerPost(new Request("http://localhost/api/live-answer", {
      method: "POST",
      body: JSON.stringify({
        theme: "productivity",
        customPresets: [],
        userQuestion: "How should I evaluate workflow automation?"
      })
    }));
    const events = await readSseEvents(response);
    const streamedText = events
      .filter((event) => event.type === "delta")
      .map((event) => event.text)
      .join("");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(streamedText).toBe("A streamed private answer.");
    expect(streamedText).not.toContain("{\"answer\"");
    expect(events.at(-1)).toMatchObject({
      type: "done",
      answer: "A streamed private answer.",
      providerMode: "openrouter_live"
    });
  });

  it("does not fall back to fixture mode when a server OpenRouter key is configured", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-server-test";
    vi.stubGlobal("fetch", async () => new Response("provider down", { status: 500 }));

    const response = await liveScenarioPost(new Request("http://localhost/api/live-scenario", {
      method: "POST",
      body: JSON.stringify({
        theme: "travel",
        customPresets: []
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.providerMode).toBe("openrouter_live");
    expect(payload.error).toBe("OpenRouter live scenario failed.");
    expect(payload.scenario).toBeUndefined();
  });

  it("opens the env-configured live user chat directly on a clean new chat", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-server-test";
    const fetchMock = vi.fn(async () => new Response("provider down", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const element = await UserChatPage();
    const props = (element as {
      props: {
        initialAnswerError?: string;
        initialCleanChatReady?: boolean;
        openRouterLiveConfigured?: boolean;
      };
    }).props;

    expect(props.openRouterLiveConfigured).toBe(true);
    expect(props.initialCleanChatReady).toBe(true);
    expect(props.initialAnswerError).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the env-configured live user chat as an empty thread first", () => {
    const scenarios = buildAllPhase4DemoScenarios();
    const markup = renderToStaticMarkup(createElement(Phase4DemoApp, {
      scenarios,
      mode: "user-chat",
      openRouterLiveConfigured: true,
      initialCleanChatReady: true
    }));

    expect(markup).toContain("New chat");
    expect(markup).toContain("Ready when you are.");
    expect(markup).not.toContain("Advertiser message");
    expect(markup).not.toContain("LLM answer failed");
    expect(markup).not.toContain("Can you help me plan a relaxed weekend trip");
  });

  it("uses an ad loading state instead of fixture creative while live matching is pending", () => {
    expect(shouldRenderSponsoredAdLoading({
      adState: "visible",
      liveRefreshStatus: "pending",
      useStreamedAnswer: true
    })).toBe(true);
    expect(shouldRenderSponsoredAdLoading({
      adState: "visible",
      liveRefreshStatus: "pending",
      useStreamedAnswer: false
    })).toBe(false);
    expect(shouldRenderSponsoredAdLoading({
      adState: "cta",
      liveRefreshStatus: "pending",
      useStreamedAnswer: true
    })).toBe(false);

    const markup = renderToStaticMarkup(createElement(SponsoredAdLoadingFrame));

    expect(markup).toContain('aria-label="Ad loading"');
    expect(markup).toContain("Ad loading");
    expect(markup).toContain("Selecting a privacy-safe sponsored message");
    expect(markup).not.toContain("Atlas Local");
    expect(markup).not.toContain("FlowPilot");
    expect(markup).not.toContain("SkillForge");
  });

  it("renders the live pending user chat with an ad loading frame instead of the current fixture ad", () => {
    const [scenario] = buildAllPhase4DemoScenarios();
    const markup = renderToStaticMarkup(createElement(UserChatPanel, {
      scenario,
      adState: "visible",
      interactionValue: scenario.adExperience.interactionValue,
      liveRefreshStatus: "pending",
      answerStream: { status: "idle", text: "" },
      useStreamedAnswer: true,
      answerError: "",
      composerModelName: "openai/gpt-4.1-mini",
      cleanChatReady: false,
      newChatNoticeOpen: false,
      submittedQuestion: "Which program should I compare for a Web3 career shift?",
      onInteractionValue: noop,
      onCta: noop,
      onDismiss: noop,
      onNotRelevant: noop,
      onDisclosure: noop,
      onRetryAnswer: noop,
      onResetAd: noop,
      onRunLive: noop,
      onCancelNewChat: noop,
      onConfirmNewChat: noop,
      onStartCleanChat: noop,
      onSubmitQuestion: noop
    }));

    expect(markup).toContain("Which program should I compare for a Web3 career shift?");
    expect(markup).toContain("Ad loading");
    expect(markup).toContain("Selecting a privacy-safe sponsored message");
    expect(markup).toContain("Matching approved campaigns without sharing your private chat");
    expect(markup).not.toContain(scenario.adExperience.interstitial.advertiserName);
    expect(markup).not.toContain(scenario.adExperience.interstitial.headline);
    expect(markup).not.toContain('aria-label="Sponsored interstitial"');
  });

  it("renders prepared creative visualizations and interaction results in the sponsored frame", () => {
    const scenarios = buildAllPhase4DemoScenarios();
    const choiceScenario = scenarios.find((scenario) => scenario.theme === "travel")!;
    const sliderScenario = scenarios.find((scenario) => scenario.theme === "productivity")!;
    const choiceMarkup = renderToStaticMarkup(createElement(UserChatPanel, {
      scenario: choiceScenario,
      adState: "visible",
      interactionValue: "Nature",
      liveRefreshStatus: "idle",
      answerStream: { status: "idle", text: "" },
      useStreamedAnswer: false,
      answerError: "",
      composerModelName: "deterministic fixture",
      cleanChatReady: false,
      newChatNoticeOpen: false,
      submittedQuestion: choiceScenario.userChat.userQuestion,
      onInteractionValue: noop,
      onCta: noop,
      onDismiss: noop,
      onNotRelevant: noop,
      onDisclosure: noop,
      onRetryAnswer: noop,
      onResetAd: noop,
      onRunLive: noop,
      onCancelNewChat: noop,
      onConfirmNewChat: noop,
      onStartCleanChat: noop,
      onSubmitQuestion: noop
    }));
    const sliderMarkup = renderToStaticMarkup(createElement(UserChatPanel, {
      scenario: sliderScenario,
      adState: "visible",
      interactionValue: "12",
      liveRefreshStatus: "idle",
      answerStream: { status: "idle", text: "" },
      useStreamedAnswer: false,
      answerError: "",
      composerModelName: "deterministic fixture",
      cleanChatReady: false,
      newChatNoticeOpen: false,
      submittedQuestion: sliderScenario.userChat.userQuestion,
      onInteractionValue: noop,
      onCta: noop,
      onDismiss: noop,
      onNotRelevant: noop,
      onDisclosure: noop,
      onRetryAnswer: noop,
      onResetAd: noop,
      onRunLive: noop,
      onCancelNewChat: noop,
      onConfirmNewChat: noop,
      onStartCleanChat: noop,
      onSubmitQuestion: noop
    }));

    expect(choiceMarkup).toContain("Prepared sponsored creative preview");
    expect(choiceMarkup).toContain("Choice result");
    expect(choiceMarkup).toContain("Nature path");
    expect(sliderMarkup).toContain("Slider preview");
    expect(sliderMarkup).toContain("slider-meter-preview");
    expect(sliderMarkup).toContain("Balanced plan");
  });

  it("places live answer failures inside the answer card UI", () => {
    const scenarios = buildAllPhase4DemoScenarios();
    const markup = renderToStaticMarkup(createElement(Phase4DemoApp, {
      scenarios,
      mode: "user-chat",
      openRouterLiveConfigured: true,
      initialAnswerError: LIVE_ANSWER_ERROR_MESSAGE
    }));

    expect(markup).toContain("answer-card--error");
    expect(markup).toContain("LLM answer failed");
    expect(markup).toContain("The LLM answer failed. Please check the Server connection and try again.");
    expect(markup).toContain("Server response failed");
    expect(markup).toContain("No deterministic fixture answer was substituted.");
    expect(markup).toContain('aria-label="Answer retry controls"');
    expect(markup).toContain('aria-label="Retry answer"');
    expect(markup).toContain("Retry answer");
    expect(markup).not.toContain("Ad proof controls");
    expect(markup).not.toContain("LLM error");
  });

  it("keeps retry answer as an answer-only live control after the sponsored gate", () => {
    const [scenario] = buildAllPhase4DemoScenarios();
    const markup = renderToStaticMarkup(createElement(UserChatPanel, {
      scenario,
      adState: "dismissed",
      interactionValue: scenario.adExperience.interactionValue,
      liveRefreshStatus: "idle",
      answerStream: {
        status: "complete",
        text: "A private streamed answer can be retried without regenerating the sponsored message."
      },
      useStreamedAnswer: true,
      answerError: "",
      composerModelName: "openai/gpt-4.1-mini",
      cleanChatReady: false,
      newChatNoticeOpen: false,
      submittedQuestion: "Can you help me compare privacy-safe AI plans?",
      onInteractionValue: noop,
      onCta: noop,
      onDismiss: noop,
      onNotRelevant: noop,
      onDisclosure: noop,
      onRetryAnswer: noop,
      onResetAd: noop,
      onRunLive: noop,
      onCancelNewChat: noop,
      onConfirmNewChat: noop,
      onStartCleanChat: noop,
      onSubmitQuestion: noop
    }));

    expect(markup).toContain('aria-label="Answer and proof controls"');
    expect(markup).toContain('aria-label="Retry answer"');
    expect(markup).toContain("Retry answer");
    expect(markup).toContain("A private streamed answer can be retried");
    expect(markup).toContain("Why this ad");
    expect(markup).toContain("Ad proof");
    expect(markup).toContain("Settlement");
  });

  it("keeps the live user chat topbar free of provider badges", () => {
    const scenarios = buildAllPhase4DemoScenarios();
    const markup = renderToStaticMarkup(createElement(Phase4DemoApp, {
      scenarios,
      mode: "user-chat",
      openRouterLiveConfigured: true
    }));

    expect(markup).not.toContain("OpenRouter live");
    expect(markup).not.toContain("live-mode-pill");
    expect(markup).not.toContain("Preset:");
  });

  it("renders the user chat composer as an editable submit form", () => {
    const scenarios = buildAllPhase4DemoScenarios();
    const markup = renderToStaticMarkup(createElement(Phase4DemoApp, {
      scenarios,
      mode: "user-chat"
    }));

    expect(markup).toContain('aria-label="Chat composer"');
    expect(markup).toContain('aria-label="Ask anything"');
    expect(markup).toContain('type="submit"');
    expect(markup).not.toMatch(/\sreadOnly(?:=|\s|>)/);
    expect(markup).not.toMatch(/\sreadonly(?:=|\s|>)/);
  });

  it("right-aligns the live user chat new-chat and advertiser-console actions", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.app-shell--user-chat \.topbar--chat-app\.topbar--no-center-control\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(260px, max-content\) minmax\(0, 1fr\) max-content;[^}]*width:\s*100%;[^}]*max-width:\s*none;/s);
    expect(css).toMatch(/\.app-shell--user-chat \.topbar--chat-app\.topbar--no-center-control \.chat-top-actions\s*\{[^}]*grid-column:\s*3;[^}]*justify-self:\s*end;[^}]*justify-content:\s*flex-end;[^}]*margin-left:\s*0;/s);
  });

  it("keeps the user chat composer anchored to the bottom across breakpoints", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.chat-composer\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*max\(16px, env\(safe-area-inset-bottom\)\);[^}]*margin-top:\s*auto;/s);
    expect(css).toMatch(/@media \(max-width: 680px\)[\s\S]*\.chat-composer\s*\{[\s\S]*position:\s*sticky;[\s\S]*bottom:\s*max\(12px, env\(safe-area-inset-bottom\)\);[\s\S]*margin-top:\s*auto;/);
    expect(css).not.toMatch(/\.chat-composer\s*\{[^}]*position:\s*static;/s);
  });

  it("orders the advertiser dashboard around the campaign workflow", () => {
    const scenarios = buildAllPhase4DemoScenarios();
    const markup = renderToStaticMarkup(createElement(Phase4DemoApp, {
      scenarios,
      mode: "advertiser-console"
    }));
    const workflowLabels = [
      "Campaigns",
      "Create",
      "Targeting",
      "Creative",
      "Review",
      "Performance",
      "Settlement"
    ];

    expect(markup).toContain("Choose a campaign to manage.");
    expect(markup).toContain("campaign-list");
    expect(markup).toContain("campaign-row");
    expect(markup).toContain("Preview ready");
    expect(markup).not.toContain("workflow-lifecycle");
    expect(markup).not.toContain("workflow-strip");
    expect(markup).not.toContain("Demo Script");

    const positions = workflowLabels.map((label) => markup.indexOf(`>${label}<`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });

  it("keeps initially ready campaign active toggles checkable", () => {
    const scenarios = buildAllPhase4DemoScenarios();
    const markup = renderToStaticMarkup(createElement(Phase4DemoApp, {
      scenarios,
      mode: "advertiser-console"
    }));
    const activeToggleInputs = markup.match(/<input[^>]*aria-label="Activate [^"]+"[^>]*>/g) ?? [];

    expect(activeToggleInputs).toHaveLength(RESERVED_DEMO_PRESET_IDS.length);
    expect(activeToggleInputs.every((input) => !input.includes("disabled"))).toBe(true);
  });

  it("renders campaign-level Fast and Professional matching switches", () => {
    const scenarios = buildAllPhase4DemoScenarios();
    const markup = renderToStaticMarkup(createElement(Phase4DemoApp, {
      scenarios,
      mode: "advertiser-console"
    }));

    expect(markup).toContain("Matching");
    expect(markup).toContain("Mode");
    expect(markup).toContain("No active campaigns");
    expect(markup.match(/Matching mode for /g)).toHaveLength(RESERVED_DEMO_PRESET_IDS.length);
    expect(markup.match(/>Fast</g)?.length).toBeGreaterThanOrEqual(RESERVED_DEMO_PRESET_IDS.length);
    expect(markup.match(/>Professional</g)?.length).toBeGreaterThanOrEqual(RESERVED_DEMO_PRESET_IDS.length);
  });

  it("summarizes active matching mode as Fast unless any active campaign is Professional", () => {
    expect(getActiveMatchingModeStatus({
      selectedThemes: ["travel", "learning"],
      matchingModeByTheme: {
        travel: "fast",
        learning: "fast"
      }
    })).toMatchObject({
      mode: "fast",
      label: "Fast Matching"
    });
    expect(getActiveMatchingModeStatus({
      selectedThemes: ["travel", "learning"],
      matchingModeByTheme: {
        learning: "professional"
      }
    })).toMatchObject({
      mode: "professional",
      label: "Professional Matching"
    });
  });

  it("restores active campaign checkbox themes from persisted route handoff state", () => {
    const customPreset = createSecurityPreset();
    const scenarios = buildAllPhase4DemoScenarios(undefined, [customPreset]);

    expect(resolveSelectedCampaignThemes({
      scenarios,
      persistedThemes: [
        "learning",
        "AI Security Review",
        "custom_ai_security",
        "",
        "missing-theme",
        42
      ]
    })).toEqual(["learning", "custom_ai_security"]);
    expect(resolveSelectedCampaignThemes({
      scenarios,
      persistedThemes: "learning"
    })).toEqual([]);
  });

  it("restores campaign matching modes only for available campaigns", () => {
    const customPreset = createSecurityPreset();
    const scenarios = buildAllPhase4DemoScenarios(undefined, [customPreset]);

    expect(resolveMatchingModesByTheme({
      scenarios,
      persistedModes: {
        learning: "professional",
        custom_ai_security: "professional",
        travel: "fast",
        missing: "professional",
        productivity: "slow"
      }
    })).toEqual({
      learning: "professional",
      custom_ai_security: "professional",
      travel: "fast"
    });
    expect(resolveMatchingModesByTheme({
      scenarios,
      persistedModes: ["learning"]
    })).toEqual({});
  });

  it("moves attention signal detail into a privacy-safe performance tab", () => {
    const [scenario] = buildAllPhase4DemoScenarios();
    const measuredPerformance = updateRuntimePerformanceWithFollowUp({
      measurement: createRuntimePerformanceMeasurement({
        scenario,
        startedAtMs: 0,
        endedAtMs: 3000,
        interactionTouched: true,
        interactionValue: scenario.adExperience.interactionValue,
        measuredAt: "2026-05-20T06:31:00.000Z"
      }),
      scenario,
      followUpQuestion: scenario.userChat.followUpQuestion,
      measuredAt: "2026-05-20T06:31:30.000Z"
    });
    const markup = renderToStaticMarkup(PerformanceDashboard({
      scenario,
      reviewStatus: "approved",
      measuredPerformance
    }));

    expect(markup).toContain("Measured attention");
    expect(markup).toContain("Privacy-safe attention signal breakdown");
    expect(markup).toContain("Measured test event, no identity");
    expect(markup).toContain("No raw transcript, profile vector, direct identifier, or browsing history is shown.");
    expect(markup).toContain("Dwell");
    expect(markup).toContain("Realtime interaction");
    expect(markup).toContain("Context retention");
    expect(markup).toContain("Deep link");
    expect(markup).not.toContain(scenario.settlementDashboard.attentionEvent.id);
    expect(markup).not.toContain(scenario.settlementDashboard.attentionEvent.pseudonymousUserProof);
  });

  it("keeps performance empty before a verified user-chat test event", () => {
    const [scenario] = buildAllPhase4DemoScenarios();
    const markup = renderToStaticMarkup(createElement(PerformanceDashboard, {
      scenario,
      reviewStatus: "approved"
    }));

    expect(markup).toContain("No verified test event yet.");
    expect(markup).toContain("Zero measured attention events");
    expect(markup).toContain("Raw conversation, user profile, and browsing history remain hidden");
    expect(markup).not.toContain("Privacy-safe attention signal breakdown");
    expect(markup).not.toContain("Attention score");
    expect(markup).not.toContain("Realtime interaction");
  });

  it("calculates performance from browser-session measurements instead of fixture attention", () => {
    const [scenario] = buildAllPhase4DemoScenarios();
    const measuredPerformance = createRuntimePerformanceMeasurement({
      scenario,
      startedAtMs: 1000,
      endedAtMs: 2250,
      interactionTouched: false,
      interactionValue: scenario.adExperience.interactionValue,
      measuredAt: "2026-05-20T06:32:00.000Z"
    });

    expect(measuredPerformance.source).toBe("browser_session");
    expect(measuredPerformance.dwellSeconds).toBe(1.25);
    expect(measuredPerformance.realtimeInteractionScore).toBe(0);
    expect(measuredPerformance.contextRetentionScore).toBe(0);
    expect(measuredPerformance.deepLinkScore).toBe(1);
    expect(measuredPerformance.scoreBps).not.toBe(scenario.settlementDashboard.attentionEvent.scoreBps);
  });

  it("updates context retention only after a measured follow-up request", () => {
    const [scenario] = buildAllPhase4DemoScenarios();
    const initialMeasurement = createRuntimePerformanceMeasurement({
      scenario,
      startedAtMs: 0,
      endedAtMs: 3000,
      interactionTouched: true,
      interactionValue: scenario.adExperience.interactionValue,
      measuredAt: "2026-05-20T06:32:00.000Z"
    });
    const updatedMeasurement = updateRuntimePerformanceWithFollowUp({
      measurement: initialMeasurement,
      scenario,
      followUpQuestion: scenario.userChat.followUpQuestion,
      measuredAt: "2026-05-20T06:33:00.000Z"
    });

    expect(initialMeasurement.retention.followUpObserved).toBe(false);
    expect(initialMeasurement.contextRetentionScore).toBe(0);
    expect(updatedMeasurement.retention.followUpObserved).toBe(true);
    expect(updatedMeasurement.retention.evidenceCount).toBeGreaterThan(0);
    expect(updatedMeasurement.contextRetentionScore).toBeGreaterThan(0);
    expect(updatedMeasurement.scoreBps).toBeGreaterThan(initialMeasurement.scoreBps);
  });

  it("auto-claims settlement only after browser attention passes threshold", () => {
    const [scenario] = buildAllPhase4DemoScenarios();
    const eligibleMeasurement = createRuntimePerformanceMeasurement({
      scenario,
      startedAtMs: 0,
      endedAtMs: 3000,
      interactionTouched: true,
      interactionValue: scenario.adExperience.interactionValue,
      measuredAt: "2026-05-20T06:32:00.000Z"
    });
    const belowThresholdMeasurement = createRuntimePerformanceMeasurement({
      scenario,
      startedAtMs: 0,
      endedAtMs: 500,
      interactionTouched: false,
      interactionValue: scenario.adExperience.interactionValue,
      measuredAt: "2026-05-20T06:33:00.000Z"
    });
    const fundingWithoutDebit = {
      ...scenario.fundingDashboard,
      ledgerEntries: scenario.fundingDashboard.ledgerEntries.filter((entry) => entry.type !== "attention_debit")
    };

    expect(eligibleMeasurement.settlementEligible).toBe(true);
    expect(shouldAutoClaimSettlement({
      measurement: eligibleMeasurement,
      fundingDashboard: fundingWithoutDebit,
      reviewStatus: "approved"
    })).toBe(true);
    expect(shouldAutoClaimSettlement({
      measurement: belowThresholdMeasurement,
      fundingDashboard: fundingWithoutDebit,
      reviewStatus: "approved"
    })).toBe(false);
    expect(shouldAutoClaimSettlement({
      measurement: eligibleMeasurement,
      fundingDashboard: fundingWithoutDebit,
      reviewStatus: "rejected"
    })).toBe(false);
    expect(shouldAutoClaimSettlement({
      measurement: eligibleMeasurement,
      fundingDashboard: scenario.fundingDashboard,
      reviewStatus: "approved"
    })).toBe(false);
  });

  it("keeps Safari dashboard controls out of native button layout quirks", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

    expect(css).toMatch(/button,\s*\.screen-tabs a\s*\{[^}]*appearance:\s*none;[^}]*-webkit-appearance:\s*none;/s);
    expect(css).toMatch(/\.campaign-list\s*\{[^}]*border-collapse:\s*separate;[^}]*border-spacing:\s*0;/s);
    expect(css).toMatch(/\.campaign-table th,\s*\.campaign-table td\s*\{[^}]*border-bottom:\s*1px solid var\(--line\);/s);
    expect(css).toMatch(/\.console-stepper button\s*\{[^}]*display:\s*inline-flex;/s);
  });

  it("locks later create-campaign steps until previous required fields are complete", () => {
    const completeForm = createCompleteCustomPresetForm();

    expect(canOpenCustomPresetBuilderStep({
      ...completeForm,
      advertiserName: ""
    }, "offer")).toBe(false);
    expect(canOpenCustomPresetBuilderStep({
      ...completeForm,
      productServiceSummary: ""
    }, "creative")).toBe(false);
    expect(canOpenCustomPresetBuilderStep({
      ...completeForm,
      productServiceSummary: ""
    }, "offer")).toBe(true);
    expect(canOpenCustomPresetBuilderStep(completeForm, "delivery")).toBe(true);
  });

  it("prefills the create-campaign form with the Protocol Camp launch brief", () => {
    expect(DEFAULT_CUSTOM_FORM).toMatchObject({
      id: "PC-1a",
      navigationLabel: "1a-1a",
      advertiserName: "Shard Lab",
      campaignName: "Protocol Camp",
      objective: "to promote Shard Lab's new bootcamp Protocol Camp",
      allowedInteractionTemplate: "choice",
      ctaLabel: "Apply to Protocol Camp",
      ctaTarget: "agent://protocol-camp/apply"
    });
    expect(DEFAULT_CUSTOM_FORM.productServiceSummary).toContain("12-week intensive Web3 builder bootcamp");
    expect(DEFAULT_CUSTOM_FORM.naturalLanguageTargetPolicy).toContain("Technical Builders");
    expect(DEFAULT_CUSTOM_FORM.mustIncludeAttributes).toContain("Not a hackathon");
    expect(DEFAULT_CUSTOM_FORM.prohibitedClaims).toContain("Do not guarantee funding");
    expect(canOpenCustomPresetBuilderStep(DEFAULT_CUSTOM_FORM, "delivery")).toBe(true);

    const protocolCampPreset = formStateToPreset(DEFAULT_CUSTOM_FORM);
    const scenarios = buildAllPhase4DemoScenarios(undefined, [protocolCampPreset]);
    const scenario = scenarios.find((candidate) => candidate.theme === "pc_1a");

    expect(protocolCampPreset.id).toBe("pc_1a");
    expect(protocolCampPreset.mustIncludeAttributes).toContain(
      "Community over education: peer cohort and ecosystem entry pass and not just a course"
    );
    expect(protocolCampPreset.prohibitedClaims).toContain(
      "Do not promise a production-grade blockchain product in 12 weeks"
    );
    expect(scenario?.advertiserConsole.advertiserName).toBe("Shard Lab");
    expect(scenario?.advertiserConsole.campaignName).toBe("Protocol Camp");
    expect(scenario?.adExperience.interstitial.label).toBe("Sponsored");
    expect(scenario?.platformReview.sensitiveTargeting).toBe("approved");
  });

  it("migrates stale local custom preset drafts before refreshing scenarios", () => {
    const staleFormPreset = {
      ...createCompleteCustomPresetForm(),
      id: "AI Security Review"
    };
    const sanitized = sanitizeDemoPresetDrafts([staleFormPreset]);

    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]).toMatchObject({
      id: "ai_security_review",
      allowedInteractionTemplates: ["choice"],
      mustIncludeAttributes: [
        "Prompt and tool-risk checklist",
        "Data-flow review"
      ],
      prohibitedClaims: [
        "guaranteed compliance",
        "prevents every breach"
      ]
    });
  });

  it("rejects custom preset drafts with reserved system preset ids", () => {
    const reservedPreset = {
      ...createCompleteCustomPresetForm(),
      id: "learning"
    };
    const sanitized = sanitizeDemoPresetDrafts([reservedPreset]);

    expect(sanitized).toHaveLength(0);
  });

  it("rejects custom preset drafts with reserved system campaign names", () => {
    const reservedPreset = {
      ...createCompleteCustomPresetForm(),
      id: "atlas_clone",
      campaignName: "Atlas Local Weekend"
    };
    const sanitized = sanitizeDemoPresetDrafts([reservedPreset]);

    expect(isReservedDemoPresetCampaignName(reservedPreset.campaignName)).toBe(true);
    expect(sanitized).toHaveLength(0);
  });

  it("restores the configured advertiser preset as the active user-chat campaign", () => {
    const customPreset = createSecurityPreset();
    const scenarios = buildAllPhase4DemoScenarios(undefined, [customPreset]);

    expect(resolveActiveDemoTheme({
      scenarios,
      preferredTheme: "AI Security Review",
      customPresets: [customPreset],
      fallbackTheme: "travel"
    })).toBe("custom_ai_security");
    expect(resolveActiveDemoTheme({
      scenarios,
      customPresets: [customPreset],
      fallbackTheme: "travel"
    })).toBe("custom_ai_security");
  });

  it("removes the selected custom campaign preset while keeping seed campaigns locked", () => {
    const customPreset = createSecurityPreset();
    const deleted = removeCustomPresetByTheme([customPreset], "custom_ai_security");
    const seedAttempt = removeCustomPresetByTheme([customPreset], "travel");

    expect(isCustomPresetTheme([customPreset], "custom_ai_security")).toBe(true);
    expect(isCustomPresetTheme([customPreset], "travel")).toBe(false);
    expect(deleted.removedPreset?.campaignName).toBe("GuardLayer Agent Review");
    expect(deleted.nextPresets).toHaveLength(0);
    expect(seedAttempt.removedPreset).toBeUndefined();
    expect(seedAttempt.nextPresets).toHaveLength(1);
  });

  it("shows the selected-campaign delete action only as enabled for custom presets", () => {
    const customPreset = createSecurityPreset();
    const seedMarkup = renderToStaticMarkup(createElement(Phase4DemoApp, {
      scenarios: buildAllPhase4DemoScenarios(),
      mode: "advertiser-console"
    }));
    const customScenarios = buildAllPhase4DemoScenarios(undefined, [customPreset]);
    const customScenario = customScenarios.find((scenario) => scenario.theme === "custom_ai_security");
    const customMarkup = renderToStaticMarkup(createElement(Phase4DemoApp, {
      scenarios: customScenario ? [customScenario, ...customScenarios.filter((scenario) => scenario !== customScenario)] : customScenarios,
      mode: "advertiser-console"
    }));

    expect(seedMarkup).toContain("Delete selected");
    expect(seedMarkup).toMatch(/<button[^>]*disabled=""[^>]*>Delete selected<\/button>/);
    expect(customMarkup).toContain("Delete selected");
    expect(customMarkup).not.toMatch(/<button[^>]*disabled=""[^>]*>Delete selected<\/button>/);
  });
});

describe("Phase 4 policy compile API", () => {
  it("returns a compiled preview for the advertiser policy editor", async () => {
    const response = await compilePolicyPost(new Request("http://localhost/api/compile-policy", {
      method: "POST",
      body: JSON.stringify({
        campaignId: "campaign_preview",
        sourcePolicyId: "source_policy_preview",
        sourceText: "Reach teams comparing productivity SaaS and workflow automation.",
        createdAt: "2026-05-20T06:30:00.000Z"
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.safetyVerdict).toBe("approved");
    expect(payload.requiredContextSignals).toContain("productivity");
    expect(payload.policyHash).toHaveLength(64);
  });

  it("blocks sensitive targeting in edited natural-language policies", async () => {
    const response = await compilePolicyPost(new Request("http://localhost/api/compile-policy", {
      method: "POST",
      body: JSON.stringify({
        campaignId: "campaign_preview",
        sourcePolicyId: "source_policy_preview",
        sourceText: "Reach people based on religion and political affiliation.",
        createdAt: "2026-05-20T06:30:00.000Z"
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.safetyVerdict).toBe("blocked");
    expect(payload.prohibitedSensitiveSignals).toEqual([
      "religion",
      "political_affiliation"
    ]);
  });

  it("does not return a deterministic compiled preview when a server OpenRouter key is configured and the provider fails", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-server-test";
    vi.stubGlobal("fetch", async () => new Response("provider down", { status: 500 }));

    const response = await compilePolicyPost(new Request("http://localhost/api/compile-policy", {
      method: "POST",
      body: JSON.stringify({
        campaignId: "campaign_preview",
        sourcePolicyId: "source_policy_preview",
        sourceText: "Reach teams comparing productivity SaaS and workflow automation.",
        createdAt: "2026-05-20T06:30:00.000Z"
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.providerMode).toBe("openrouter_live");
    expect(payload.error).toBe("OpenRouter compile failed.");
    expect(payload.compiledSummary).toBeUndefined();
  });
});

function containsHangul(value: unknown): boolean {
  if (typeof value === "string") {
    return /[\u3131-\u318e\uac00-\ud7a3]/.test(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsHangul(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsHangul(item));
  }

  return false;
}

async function readSseEvents(response: Response): Promise<LiveAnswerStreamEvent[]> {
  const body = await response.text();

  return body
    .split(/\r?\n\r?\n/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith("data:"))
    .map((chunk) => chunk.slice("data:".length).trim())
    .filter(Boolean)
    .map((chunk) => JSON.parse(chunk) as LiveAnswerStreamEvent);
}

function createSecurityPreset(): DemoPresetDraft {
  return {
    id: "custom_ai_security",
    navigationLabel: "AI Security",
    advertiserName: "GuardLayer",
    campaignName: "GuardLayer Agent Review",
    objective: "Start an agent-assisted AI security review",
    productServiceSummary: "AI security review workspace for prompt, tool, and data-flow risk checks.",
    naturalLanguageTargetPolicy: "Reach teams evaluating AI security reviews, prompt risk, tool permissions, and agent deployment readiness.",
    mustIncludeAttributes: [
      "Prompt and tool-risk checklist",
      "Data-flow review",
      "Agent deployment readiness score"
    ],
    prohibitedClaims: [
      "guaranteed compliance",
      "prevents every breach"
    ],
    allowedInteractionTemplates: ["choice"],
    ctaLabel: "Start an AI security review",
    ctaTarget: "agent://security/review",
    userQuestion: "Can you help me check whether our internal AI agent is safe to deploy?"
  };
}

function createCompleteCustomPresetForm(): CustomPresetFormState {
  return {
    id: "custom_ai_security",
    navigationLabel: "AI Security",
    advertiserName: "GuardLayer",
    campaignName: "GuardLayer Agent Review",
    objective: "Start an agent-assisted AI security review",
    productServiceSummary: "AI security review workspace for prompt, tool, and data-flow risk checks.",
    naturalLanguageTargetPolicy: "Reach teams evaluating AI security reviews, prompt risk, tool permissions, and agent deployment readiness.",
    mustIncludeAttributes: "Prompt and tool-risk checklist\nData-flow review",
    prohibitedClaims: "guaranteed compliance\nprevents every breach",
    allowedInteractionTemplate: "choice",
    ctaLabel: "Start an AI security review",
    ctaTarget: "agent://security/review",
    userQuestion: "Can you help me check whether our internal AI agent is safe to deploy?"
  };
}
