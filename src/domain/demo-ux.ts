import { applySponsoredInteraction, toAdvertiserCampaignResponse } from "./boundaries";
import {
  adjudicateContextRetention,
  calculateAttentionScore,
  createAttentionEvent,
  createPseudonymousUserProof,
  retrieveContextRetentionEvidence,
  scoreRealtimeInteraction,
  trackDwell,
  verifyDeepLink,
  type AttentionScoreContribution
} from "./attention";
import { generateInteractiveSponsoredInterstitial } from "./ad-generation";
import {
  createDemoAdThemeFixtures,
  createEligibilityTokenFixture,
  createIntentContextFixture,
  type DemoAdThemeFixture,
  type DemoPresetDraft
} from "./demo-fixtures";
import type { DemoAdTheme } from "./demo-fixtures";
import { selectAdOpportunity } from "./matching";
import {
  type AttentionEvent,
  type CompiledTargetPolicy,
  type ContextRetentionEvidence,
  type ContractTransaction,
  type SettlementEvent,
  type SettlementProof,
  type SponsoredInterstitial,
  type SponsoredInterstitialInteraction
} from "./schemas";
import {
  indexSettlementContractEvent,
  submitSettlementTransaction,
  triggerSettlement
} from "./settlement";

const DEFAULT_NOW = "2026-05-20T06:30:00.000Z";
const DEFAULT_INDEXED_AT = "2026-05-20T06:30:12.000Z";
const DEFAULT_CHAIN_ID = 84532;
const DEFAULT_CONTRACT_ADDRESS = "0x1111111111111111111111111111111111111111";
const DEFAULT_PRIVACY_SALT = "phase4-demo-privacy-salt";

export type DemoScriptStep = {
  timestamp: string;
  title: string;
  line: string;
  proofPoint: string;
};

export type { DemoAdTheme, DemoPresetDraft };

export type Phase4DemoScenario = {
  theme: DemoAdTheme;
  navigationLabel: string;
  fixture: DemoAdThemeFixture;
  userChat: {
    userQuestion: string;
    retrievalSafeSummary: string;
    followUpQuestion: string;
    serviceAnswer: string;
    sequence: Array<"user_question" | "pre_answer_sponsored_interstitial" | "service_answer" | "follow_up_retention">;
  };
  advertiserConsole: {
    advertiserName: string;
    campaignName: string;
    campaignStatus: string;
    naturalLanguageTargetPolicySource: string;
    compiledPolicy: Pick<
      CompiledTargetPolicy,
      "compiledSummary" | "safetyVerdict" | "prohibitedSensitiveSignals" | "policyHash" | "compilerVersion"
    >;
    settlementPolicySummary: {
      dwellWeightBps: number;
      interactionWeightBps: number;
      retentionWeightBps: number;
      deepLinkWeightBps: number;
      thresholdBps: number;
      policyHash: string;
    };
    aggregateMetrics: {
      impressions: number;
      attentionEvents: number;
      settledEvents: number;
      averageScoreBps: number;
      spendCents: number;
    };
  };
  platformReview: {
    reviewStatus: "approved";
    requiredContextSignals: string[];
    intentKeywords: string[];
    privacyBoundary: string;
    sensitiveTargeting: CompiledTargetPolicy["safetyVerdict"];
    mustIncludeAttributes: string[];
    prohibitedClaims: string[];
    violations: string[];
  };
  adExperience: {
    interstitial: SponsoredInterstitial;
    updatedInterstitial: SponsoredInterstitial;
    interactionValue: string;
    interactionEvent: SponsoredInterstitialInteraction;
    disclosureLines: string[];
  };
  settlementDashboard: {
    attentionEvent: AttentionEvent;
    contextRetentionEvidence: ContextRetentionEvidence;
    settlementProof: SettlementProof;
    settlementEvent: SettlementEvent;
    transaction: ContractTransaction;
    transactionHash: string;
    contractEventStatus: string;
    contributionRows: AttentionScoreContribution[];
  };
  demoScript: DemoScriptStep[];
};

export function buildAllPhase4DemoScenarios(
  now = DEFAULT_NOW,
  customPresets: DemoPresetDraft[] = []
): Phase4DemoScenario[] {
  const fixtures = createDemoAdThemeFixtures(now, customPresets);

  return fixtures.map((fixture) =>
    buildPhase4DemoScenarioFromFixture({
      fixture,
      candidates: fixtures,
      now
    })
  );
}

export function buildPhase4DemoScenario(input: {
  theme: DemoAdTheme;
  now?: string;
  indexedAt?: string;
  chainId?: number;
  contractAddress?: string;
  privacySalt?: string;
  customPresets?: DemoPresetDraft[];
}): Phase4DemoScenario {
  const now = input.now ?? DEFAULT_NOW;
  const fixtures = createDemoAdThemeFixtures(now, input.customPresets ?? []);
  const fixture = findThemeFixture(fixtures, input.theme);

  return buildPhase4DemoScenarioFromFixture({
    fixture,
    candidates: fixtures,
    now,
    indexedAt: input.indexedAt,
    chainId: input.chainId,
    contractAddress: input.contractAddress,
    privacySalt: input.privacySalt
  });
}

function buildPhase4DemoScenarioFromFixture(input: {
  fixture: DemoAdThemeFixture;
  candidates: DemoAdThemeFixture[];
  now?: string;
  indexedAt?: string;
  chainId?: number;
  contractAddress?: string;
  privacySalt?: string;
}): Phase4DemoScenario {
  const now = input.now ?? DEFAULT_NOW;
  const indexedAt = input.indexedAt ?? DEFAULT_INDEXED_AT;
  const chainId = input.chainId ?? DEFAULT_CHAIN_ID;
  const contractAddress = input.contractAddress ?? DEFAULT_CONTRACT_ADDRESS;
  const privacySalt = input.privacySalt ?? DEFAULT_PRIVACY_SALT;
  const fixture = input.fixture;
  const intentContext = createIntentContextFixture(fixture.theme, now, fixture);
  const eligibilityToken = createEligibilityTokenFixture({
    id: `eligibility_${fixture.theme}_phase4_demo`,
    snapshotId: `snapshot_${fixture.theme}_phase4_demo`,
    intentTags: [fixture.theme, ...intentContext.intentTags],
    preferenceTags: fixture.theme === "travel" ? ["budget", "nature"] : [],
    now
  });
  const decision = selectAdOpportunity({
    intentContext,
    retrievalSafeSummary: intentContext.currentNeedSummary,
    eligibilityToken,
    candidates: input.candidates,
    now
  });

  if (!decision.opportunity) {
    throw new Error(`Expected eligible Phase 4 ad opportunity for ${fixture.theme}.`);
  }

  const interstitial = generateInteractiveSponsoredInterstitial({
    opportunity: decision.opportunity,
    interstitialId: `interstitial_${fixture.theme}_phase4_demo`,
    generatedAt: now
  });
  const interactionValue = getDemoInteractionValue(fixture.theme);
  const { updatedInterstitial, interactionEvent } = applySponsoredInteraction({
    interstitial,
    interactionId: `interaction_${fixture.theme}_phase4_demo`,
    interactionInput: { value: interactionValue },
    occurredAt: now
  });
  const realtimeInteractionScore = scoreRealtimeInteraction(interactionEvent);
  const followUpQuestion = buildFollowUpQuestion(fixture);
  const retrieval = retrieveContextRetentionEvidence({
    campaignId: fixture.campaign.id,
    attentionEventId: `attention_${fixture.theme}_phase4_demo`,
    followUpEventId: `followup_${fixture.theme}_phase4_demo`,
    followUpQuestion,
    retrievalSafeSummary: intentContext.currentNeedSummary,
    adClaimSummaries: [fixture.adPoolItem.productServiceSummary],
    adAttributes: fixture.adPoolItem.mustIncludeAttributes
  });
  const contextRetentionEvidence = adjudicateContextRetention({
    retrieval,
    followUpQuestion,
    createdAt: now
  });
  const dwell = trackDwell({
    startedAt: now,
    endedAt: "2026-05-20T06:30:03.000Z",
    dwellThresholdSeconds: fixture.settlementPolicy!.dwellThresholdSeconds
  });
  const deepLink = verifyDeepLink({
    interstitial,
    event: {
      sourceInterstitialId: interstitial.id,
      actionType: interstitial.cta.actionType,
      target: interstitial.cta.target
    }
  });
  const attentionEvent = createAttentionEvent({
    id: `attention_${fixture.theme}_phase4_demo`,
    campaignId: fixture.campaign.id,
    interstitialId: interstitial.id,
    dwellSeconds: dwell.dwellSeconds,
    realtimeInteractionScore,
    contextRetentionScore: contextRetentionEvidence.score,
    deepLinkScore: deepLink.score,
    settlementPolicy: fixture.settlementPolicy!,
    pseudonymousUserProof: createPseudonymousUserProof({
      campaignId: fixture.campaign.id,
      eligibilityTokenHash: eligibilityToken.tokenHash,
      privacySalt
    }),
    occurredAt: now
  });
  const trigger = triggerSettlement({
    attentionEvent,
    settlementPolicy: fixture.settlementPolicy!,
    settlementEventId: `settlement_${fixture.theme}_phase4_demo`,
    now
  });

  if (!trigger.triggered) {
    throw new Error(`Expected Phase 4 settlement trigger, received ${trigger.reason}.`);
  }

  const submitted = submitSettlementTransaction({
    settlementEvent: trigger.settlementEvent,
    proof: trigger.proof,
    chainId,
    contractAddress,
    submittedAt: now
  });
  const indexed = indexSettlementContractEvent({
    receipt: {
      txHash: submitted.transaction.txHash,
      chainId,
      contractAddress,
      status: "confirmed",
      blockNumber: 123456,
      logs: [
        {
          eventName: "SettlementClaimed",
          args: {
            campaignId: trigger.proof.campaignId,
            attentionEventId: trigger.proof.attentionEventId,
            proofHash: `0x${trigger.proof.proofHash}`,
            scoreBps: trigger.proof.scoreBps,
            thresholdBps: trigger.proof.thresholdBps
          }
        }
      ]
    },
    settlementEvent: submitted.settlementEvent,
    transaction: submitted.transaction,
    indexedAt
  });
  const advertiserResponse = toAdvertiserCampaignResponse({
    campaign: fixture.campaign,
    compiledPolicy: fixture.compiledPolicy,
    settlementPolicy: fixture.settlementPolicy!,
    aggregateMetrics: getAggregateMetrics(fixture.theme)
  });
  const attentionScore = calculateAttentionScore({
    dwellSeconds: attentionEvent.dwellSeconds,
    realtimeInteractionScore: attentionEvent.realtimeInteractionScore,
    contextRetentionScore: attentionEvent.contextRetentionScore,
    deepLinkScore: attentionEvent.deepLinkScore,
    settlementPolicy: fixture.settlementPolicy!
  });

  return {
    theme: fixture.theme,
    navigationLabel: fixture.navigationLabel,
    fixture,
    userChat: {
      userQuestion: intentContext.userQuestion,
      retrievalSafeSummary: intentContext.currentNeedSummary,
      followUpQuestion,
      serviceAnswer: buildServiceAnswer(fixture),
      sequence: [
        "user_question",
        "pre_answer_sponsored_interstitial",
        "service_answer",
        "follow_up_retention"
      ]
    },
    advertiserConsole: {
      advertiserName: fixture.advertiserName,
      campaignName: fixture.campaign.name,
      campaignStatus: advertiserResponse.campaign.reviewStatus,
      naturalLanguageTargetPolicySource: fixture.naturalLanguageTargetPolicy.sourceText,
      compiledPolicy: advertiserResponse.compiledPolicy,
      settlementPolicySummary: {
        dwellWeightBps: advertiserResponse.settlementPolicy.dwellWeightBps,
        interactionWeightBps: advertiserResponse.settlementPolicy.interactionWeightBps,
        retentionWeightBps: advertiserResponse.settlementPolicy.retentionWeightBps,
        deepLinkWeightBps: advertiserResponse.settlementPolicy.deepLinkWeightBps,
        thresholdBps: advertiserResponse.settlementPolicy.thresholdBps,
        policyHash: advertiserResponse.settlementPolicy.policyHash
      },
      aggregateMetrics: advertiserResponse.aggregateMetrics
    },
    platformReview: {
      reviewStatus: "approved",
      requiredContextSignals: readStringArray(fixture.compiledPolicy.ast.requiredContextSignals),
      intentKeywords: readStringArray(fixture.compiledPolicy.ast.intentKeywords).slice(0, 8),
      privacyBoundary: String(fixture.compiledPolicy.ast.privacyBoundary ?? "platform_private_matching"),
      sensitiveTargeting: fixture.compiledPolicy.safetyVerdict,
      mustIncludeAttributes: fixture.adPoolItem.mustIncludeAttributes,
      prohibitedClaims: fixture.adPoolItem.prohibitedClaims,
      violations: []
    },
    adExperience: {
      interstitial,
      updatedInterstitial,
      interactionValue,
      interactionEvent,
      disclosureLines: [
        "This is a sponsored interactive ad.",
        `Advertiser: ${fixture.advertiserName}`,
        interstitial.disclosure.whyShown,
        interstitial.disclosure.dataBoundary,
        "You can dismiss this ad or mark this category as not relevant."
      ]
    },
    settlementDashboard: {
      attentionEvent,
      contextRetentionEvidence,
      settlementProof: trigger.proof,
      settlementEvent: indexed.settlementEvent,
      transaction: indexed.transaction,
      transactionHash: indexed.transaction.txHash,
      contractEventStatus: indexed.transaction.eventName ?? "Awaiting contract event",
      contributionRows: attentionScore.contributions
    },
    demoScript: buildDemoScript(fixture, fixture.advertiserName)
  };
}

function findThemeFixture(fixtures: DemoAdThemeFixture[], theme: DemoAdTheme): DemoAdThemeFixture {
  const fixture = fixtures.find((candidate) => candidate.theme === theme);

  if (!fixture) {
    throw new Error(`Missing demo fixture for ${theme}.`);
  }

  return fixture;
}

function getDemoInteractionValue(theme: DemoAdTheme): string {
  if (theme === "travel") {
    return "Nature";
  }

  if (theme === "productivity") {
    return "12";
  }

  if (theme === "learning") {
    return "Product operations";
  }

  return "Compare";
}

function buildFollowUpQuestion(fixture: DemoAdThemeFixture): string {
  if (fixture.followUpQuestion) {
    return fixture.followUpQuestion;
  }

  if (fixture.theme === "travel") {
    return "Can the weekend itinerary stay budget-aware with food and nature options?";
  }

  if (fixture.theme === "productivity") {
    return "Can this compare workflow automation templates with a security review checklist?";
  }

  if (fixture.theme === "learning") {
    return "Can this become a role-based course path with hands-on projects?";
  }

  return `Can this option preserve ${fixture.adPoolItem.mustIncludeAttributes.slice(0, 2).join(" and ")}?`;
}

function buildServiceAnswer(fixture: DemoAdThemeFixture): string {
  if (fixture.theme === "travel") {
    return "A solid weekend plan starts by choosing a travel radius, locking a daily budget, and grouping food, nature, and culture stops into two low-friction routes. I would shortlist three areas, compare travel time, and leave one flexible block for weather or energy.";
  }

  if (fixture.theme === "productivity") {
    return "Start with the repeated handoff that creates the most waiting time. Map the trigger, owner, approval rule, and notification path, then automate only the stable pieces. Keep a manual review point anywhere the decision needs judgment or policy interpretation.";
  }

  if (fixture.theme === "learning") {
    return "For a product operations move, build a path around analytics, process design, stakeholder communication, and operating cadence. Pick one project per skill area, publish the artifact, and review progress weekly against the target role description.";
  }

  return `A practical comparison starts by defining the outcome, constraints, and evaluation criteria for ${fixture.campaign.productServiceSummary}. I would compare the options against the user's stated need, keep sponsored claims separate, and avoid letting campaign data change the service answer.`;
}

function getAggregateMetrics(theme: DemoAdTheme) {
  if (theme === "travel") {
    return {
      impressions: 144,
      attentionEvents: 91,
      settledEvents: 58,
      averageScoreBps: 7825,
      spendCents: 17400
    };
  }

  if (theme === "productivity") {
    return {
      impressions: 118,
      attentionEvents: 87,
      settledEvents: 63,
      averageScoreBps: 8110,
      spendCents: 18900
    };
  }

  if (theme === "learning") {
    return {
      impressions: 96,
      attentionEvents: 69,
      settledEvents: 44,
      averageScoreBps: 7680,
      spendCents: 13200
    };
  }

  return {
    impressions: 96,
    attentionEvents: 62,
    settledEvents: 37,
    averageScoreBps: 7420,
    spendCents: 11100
  };
}

function buildDemoScript(fixture: DemoAdThemeFixture, advertiserName: string): DemoScriptStep[] {
  return [
    {
      timestamp: "00:00",
      title: "User intent",
      line: `Open the ${fixture.navigationLabel} scenario and submit the user question.`,
      proofPoint: "The chat records user intent without exposing raw profile data to the advertiser."
    },
    {
      timestamp: "00:10",
      title: "Pre-answer sponsored frame",
      line: `Show the ${advertiserName} interstitial before the service answer.`,
      proofPoint: "The ad is labeled Sponsored and separated from the answer path."
    },
    {
      timestamp: "00:25",
      title: "Micro-interaction",
      line: "Use the ad interaction once, then continue through the CTA or dismiss control.",
      proofPoint: "The interaction updates only the sponsored state and creates an attention signal."
    },
    {
      timestamp: "00:40",
      title: "Advertiser and review consoles",
      line: "Switch to the advertiser policy preview and platform review panels.",
      proofPoint: "The advertiser sees compiled policy, aggregate metrics, and no raw conversation."
    },
    {
      timestamp: "00:55",
      title: "Settlement proof",
      line: "Close on the settlement dashboard transaction hash and settled event.",
      proofPoint: "Attention proof, policy hash, and testnet transaction status are linked."
    }
  ];
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
