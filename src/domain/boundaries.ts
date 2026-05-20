import { z } from "zod";
import {
  type Campaign,
  type CompiledTargetPolicy,
  type DynamicSettlementPolicy,
  type SponsoredInterstitial,
  campaignSchema,
  hashStableJson,
  sponsoredInterstitialInteractionSchema,
  sponsoredInterstitialSchema
} from "./schemas";

export const answerAgentInputSchema = z.object({
  userQuestion: z.string().min(1),
  conversationContext: z.object({
    retrievalSafeSummary: z.string().min(1),
    recentUserMessages: z.array(z.string().min(1))
  }).strict(),
  serviceKnowledge: z.array(z.object({
    id: z.string().min(1),
    summary: z.string().min(1)
  }).strict()),
  consent: z.object({
    adPersonalization: z.boolean(),
    categoryOptOuts: z.array(z.string().min(1))
  }).strict()
}).strict();

export type AnswerAgentInput = z.infer<typeof answerAgentInputSchema>;

export const advertiserCampaignResponseSchema = z.object({
  campaign: campaignSchema.pick({
    id: true,
    advertiserId: true,
    name: true,
    objective: true,
    productServiceSummary: true,
    status: true,
    reviewStatus: true,
    budgetCents: true,
    remainingBudgetCents: true,
    createdAt: true,
    updatedAt: true
  }),
  compiledPolicy: z.object({
    campaignId: z.string().min(1),
    compiledSummary: z.string().min(1),
    safetyVerdict: z.enum(["approved", "needs_review", "blocked"]),
    prohibitedSensitiveSignals: z.array(z.string().min(1)),
    policyHash: z.string().min(16),
    compilerVersion: z.string().min(1)
  }).strict(),
  settlementPolicy: z.object({
    campaignId: z.string().min(1),
    dwellWeightBps: z.number().int().min(0).max(10000),
    interactionWeightBps: z.number().int().min(0).max(10000),
    retentionWeightBps: z.number().int().min(0).max(10000),
    deepLinkWeightBps: z.number().int().min(0).max(10000),
    thresholdBps: z.number().int().min(5000).max(9000),
    dwellThresholdSeconds: z.number().positive(),
    version: z.number().int().positive(),
    policyHash: z.string().min(16),
    status: z.enum(["active", "retired"])
  }).strict(),
  aggregateMetrics: z.object({
    impressions: z.number().int().nonnegative(),
    attentionEvents: z.number().int().nonnegative(),
    settledEvents: z.number().int().nonnegative(),
    averageScoreBps: z.number().int().min(0).max(10000),
    spendCents: z.number().int().nonnegative()
  }).strict()
}).strict();

export type AdvertiserCampaignResponse = z.infer<typeof advertiserCampaignResponseSchema>;

const FORBIDDEN_ADVERTISER_KEYS = new Set([
  "rawtranscript",
  "transcript",
  "profilevector",
  "directuserid",
  "userid",
  "uservaultid",
  "personalintelligencesnapshot",
  "personalintelligence",
  "eligibilitytoken",
  "pseudonymoususerproof",
  "conversationcontext",
  "recentusermessages"
]);

export function buildAnswerAgentInput(input: {
  userQuestion: string;
  retrievalSafeSummary: string;
  recentUserMessages: string[];
  serviceKnowledge?: Array<{ id: string; summary: string }>;
  consent?: { adPersonalization: boolean; categoryOptOuts: string[] };
} & Record<string, unknown>): AnswerAgentInput {
  return answerAgentInputSchema.parse({
    userQuestion: input.userQuestion,
    conversationContext: {
      retrievalSafeSummary: input.retrievalSafeSummary,
      recentUserMessages: input.recentUserMessages
    },
    serviceKnowledge: input.serviceKnowledge ?? [],
    consent: input.consent ?? {
      adPersonalization: false,
      categoryOptOuts: []
    }
  });
}

export function toAdvertiserCampaignResponse(input: {
  campaign: Campaign;
  compiledPolicy: CompiledTargetPolicy;
  settlementPolicy: DynamicSettlementPolicy;
  aggregateMetrics: AdvertiserCampaignResponse["aggregateMetrics"];
}): AdvertiserCampaignResponse {
  const response = advertiserCampaignResponseSchema.parse({
    campaign: input.campaign,
    compiledPolicy: {
      campaignId: input.compiledPolicy.campaignId,
      compiledSummary: input.compiledPolicy.compiledSummary,
      safetyVerdict: input.compiledPolicy.safetyVerdict,
      prohibitedSensitiveSignals: input.compiledPolicy.prohibitedSensitiveSignals,
      policyHash: input.compiledPolicy.policyHash,
      compilerVersion: input.compiledPolicy.compilerVersion
    },
    settlementPolicy: {
      campaignId: input.settlementPolicy.campaignId,
      dwellWeightBps: input.settlementPolicy.dwellWeightBps,
      interactionWeightBps: input.settlementPolicy.interactionWeightBps,
      retentionWeightBps: input.settlementPolicy.retentionWeightBps,
      deepLinkWeightBps: input.settlementPolicy.deepLinkWeightBps,
      thresholdBps: input.settlementPolicy.thresholdBps,
      dwellThresholdSeconds: input.settlementPolicy.dwellThresholdSeconds,
      version: input.settlementPolicy.version,
      policyHash: input.settlementPolicy.policyHash,
      status: input.settlementPolicy.status
    },
    aggregateMetrics: input.aggregateMetrics
  });

  if (containsForbiddenAdvertiserData(response)) {
    throw new Error("Advertiser response includes personal data.");
  }

  return response;
}

export function containsForbiddenAdvertiserData(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenAdvertiserData(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, nestedValue]) => {
      const normalizedKey = key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      return FORBIDDEN_ADVERTISER_KEYS.has(normalizedKey) || containsForbiddenAdvertiserData(nestedValue);
    });
  }

  return false;
}

export function applySponsoredInteraction(input: {
  interstitial: SponsoredInterstitial;
  interactionId: string;
  interactionInput: Record<string, unknown>;
  occurredAt: string;
}) {
  const interstitial = sponsoredInterstitialSchema.parse(input.interstitial);
  const selectedOutput = String(input.interactionInput.value ?? "");
  const updatedInterstitial = sponsoredInterstitialSchema.parse({
    ...interstitial,
    headline: selectedOutput
      ? `${interstitial.headline} (${selectedOutput})`
      : interstitial.headline,
    visualSpec: {
      ...interstitial.visualSpec,
      lastInteraction: input.interactionInput
    }
  });

  const interactionEvent = sponsoredInterstitialInteractionSchema.parse({
    id: input.interactionId,
    interstitialId: interstitial.id,
    type: interstitial.interactionSpec.type,
    input: input.interactionInput,
    resultingStateHash: hashStableJson(updatedInterstitial),
    realtimeInteractionScore: selectedOutput ? 1 : 0.5,
    isolatedFromAnswer: true,
    occurredAt: input.occurredAt
  });

  return {
    updatedInterstitial,
    interactionEvent
  };
}
