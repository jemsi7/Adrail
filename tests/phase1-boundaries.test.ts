import { describe, expect, it } from "vitest";
import {
  applySponsoredInteraction,
  buildAnswerAgentInput,
  containsForbiddenAdvertiserData,
  toAdvertiserCampaignResponse
} from "../src/domain/boundaries";
import { compileNaturalLanguageTargetPolicy, detectSensitiveTargeting } from "../src/domain/policy";
import {
  type Campaign,
  type DynamicSettlementPolicy,
  type SponsoredInterstitial,
  hashStableJson
} from "../src/domain/schemas";

const now = "2026-05-20T06:30:00.000Z";
const policyHash = hashStableJson({ policy: "travel-weekend" });

const campaign: Campaign = {
  id: "campaign_travel_001",
  advertiserId: "advertiser_atlas",
  name: "Atlas Local Weekends",
  objective: "Drive agent deeplink itinerary planning",
  productServiceSummary: "Curated local weekend experiences for flexible budgets.",
  status: "approved",
  reviewStatus: "approved",
  budgetCents: 500000,
  remainingBudgetCents: 475000,
  createdAt: now,
  updatedAt: now
};

const settlementPolicy: DynamicSettlementPolicy = {
  id: "settlement_policy_001",
  campaignId: campaign.id,
  dwellWeightBps: 2500,
  interactionWeightBps: 2000,
  retentionWeightBps: 3000,
  deepLinkWeightBps: 2500,
  thresholdBps: 6500,
  dwellThresholdSeconds: 2.5,
  version: 1,
  policyHash,
  status: "active",
  createdAt: now
};

const interstitial: SponsoredInterstitial = {
  id: "interstitial_001",
  campaignId: campaign.id,
  adPoolItemId: "ad_pool_travel_001",
  advertiserName: "Atlas Local",
  label: "Sponsored",
  headline: "Shape a weekend plan around your budget",
  body: "Choose a trip style and Atlas Local will preview matching experiences.",
  visualSpec: {
    theme: "travel",
    layout: "three-card-itinerary"
  },
  interactionSpec: {
    type: "choice",
    prompt: "Pick a trip style",
    allowedOutputs: ["Food", "Nature", "Culture"]
  },
  cta: {
    label: "Build an itinerary with my budget",
    actionType: "agent_deeplink",
    target: "agent://itinerary/budget"
  },
  disclosure: {
    whyShown: "Shown because your current request is about planning a local weekend trip.",
    dataBoundary: "The advertiser does not receive your raw conversation or profile."
  },
  sponsoredMetadata: {
    campaignId: campaign.id,
    policyHash,
    generatedAt: now
  },
  createdAt: now
};

describe("Phase 1 data boundaries", () => {
  it("keeps campaign fields out of answer agent input", () => {
    const answerInput = buildAnswerAgentInput({
      userQuestion: "Plan a two-day trip near Bangkok.",
      retrievalSafeSummary: "User is exploring short local travel ideas.",
      recentUserMessages: ["I want a relaxed weekend trip."],
      serviceKnowledge: [{ id: "knowledge_001", summary: "General travel planning guidance." }],
      campaignId: campaign.id,
      campaignBidCents: 250,
      advertiserTargetPolicy: "Target users planning weekend trips.",
      adInteractionResult: "Nature"
    });

    expect(JSON.stringify(answerInput)).not.toContain("campaign");
    expect(JSON.stringify(answerInput)).not.toContain("advertiser");
    expect(JSON.stringify(answerInput)).not.toContain("Nature");
    expect(Object.keys(answerInput)).toEqual([
      "userQuestion",
      "conversationContext",
      "serviceKnowledge",
      "consent"
    ]);
  });

  it("does not pass ad interaction results into answer input", () => {
    const answerInputBefore = buildAnswerAgentInput({
      userQuestion: "What should I do this weekend?",
      retrievalSafeSummary: "User wants weekend activity recommendations.",
      recentUserMessages: ["I want something outdoors."]
    });

    const { interactionEvent, updatedInterstitial } = applySponsoredInteraction({
      interstitial,
      interactionId: "interaction_001",
      interactionInput: { value: "Nature" },
      occurredAt: now
    });

    expect(interactionEvent.isolatedFromAnswer).toBe(true);
    expect(interactionEvent.realtimeInteractionScore).toBe(1);
    expect(updatedInterstitial.visualSpec).toMatchObject({
      lastInteraction: { value: "Nature" }
    });
    expect(answerInputBefore).toEqual({
      userQuestion: "What should I do this weekend?",
      conversationContext: {
        retrievalSafeSummary: "User wants weekend activity recommendations.",
        recentUserMessages: ["I want something outdoors."]
      },
      serviceKnowledge: [],
      consent: {
        adPersonalization: false,
        categoryOptOuts: []
      }
    });
  });

  it("removes personal data from advertiser campaign responses", () => {
    const compiledPolicy = compileNaturalLanguageTargetPolicy({
      id: "compiled_policy_001",
      campaignId: campaign.id,
      sourcePolicyId: "source_policy_001",
      sourceText: "Reach people currently planning weekend travel and local experiences.",
      createdAt: now
    });

    const response = toAdvertiserCampaignResponse({
      campaign,
      compiledPolicy,
      settlementPolicy,
      aggregateMetrics: {
        impressions: 10,
        attentionEvents: 4,
        settledEvents: 2,
        averageScoreBps: 7100,
        spendCents: 1200
      }
    });

    expect(response.compiledPolicy.safetyVerdict).toBe("approved");
    expect(containsForbiddenAdvertiserData(response)).toBe(false);
    expect(JSON.stringify(response)).not.toContain("rawTranscript");
    expect(JSON.stringify(response)).not.toContain("profileVector");
    expect(JSON.stringify(response)).not.toContain("userVaultId");
  });

  it("blocks sensitive natural-language target policies", () => {
    const detection = detectSensitiveTargeting(
      "Target people with diabetes who are looking for wellness travel packages."
    );

    expect(detection.verdict).toBe("blocked");
    expect(detection.prohibitedSensitiveSignals).toContain("health_condition");

    const compiledPolicy = compileNaturalLanguageTargetPolicy({
      id: "compiled_policy_blocked_001",
      campaignId: campaign.id,
      sourcePolicyId: "source_policy_blocked_001",
      sourceText: "Target people with diabetes who are looking for wellness travel packages.",
      createdAt: now
    });

    expect(compiledPolicy.safetyVerdict).toBe("blocked");
    expect(compiledPolicy.embeddingQueries).toEqual([]);
    expect(compiledPolicy.prohibitedSensitiveSignals).toEqual(["health_condition"]);
  });
});
