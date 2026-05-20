import { describe, expect, it } from "vitest";
import { POST as compilePolicyPost } from "../app/api/compile-policy/route";
import { containsForbiddenAdvertiserData } from "../src/domain/boundaries";
import {
  buildAllPhase4DemoScenarios,
  buildPhase4DemoScenario
} from "../src/domain/demo-ux";
import { POST as demoScenariosPost } from "../app/api/demo-scenarios/route";
import { POST as liveScenarioPost } from "../app/api/live-scenario/route";

describe("Phase 4 demo UX scenario builder", () => {
  it("builds three seed campaigns with English demo copy", () => {
    const scenarios = buildAllPhase4DemoScenarios();

    expect(scenarios.map((scenario) => scenario.theme)).toEqual([
      "travel",
      "productivity",
      "learning"
    ]);
    expect(scenarios.every((scenario) => scenario.adExperience.interstitial.label === "Sponsored")).toBe(true);
    expect(scenarios.every((scenario) => !containsHangul(scenario))).toBe(true);
  });

  it("treats the original three campaigns as presets and accepts an added demo preset", async () => {
    const response = await demoScenariosPost(new Request("http://localhost/api/demo-scenarios", {
      method: "POST",
      body: JSON.stringify({
        customPresets: [createSecurityPreset()]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.scenarios.map((scenario: { theme: string }) => scenario.theme)).toEqual([
      "travel",
      "productivity",
      "learning",
      "custom_ai_security"
    ]);
    expect(payload.scenarios.at(-1).adExperience.interstitial.label).toBe("Sponsored");
    expect(payload.scenarios.at(-1).advertiserConsole.advertiserName).toBe("GuardLayer");
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
});

describe("Phase 4 live scenario API", () => {
  it("falls back to deterministic fixtures when no OpenRouter key is provided", async () => {
    const response = await liveScenarioPost(new Request("http://localhost/api/live-scenario", {
      method: "POST",
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

function createSecurityPreset() {
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
