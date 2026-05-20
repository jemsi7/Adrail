import {
  type AttentionEvent,
  type ContextRetentionEvidence,
  type DynamicSettlementPolicy,
  type SponsoredInterstitial,
  type SponsoredInterstitialInteraction,
  attentionEventSchema,
  contextRetentionEvidenceSchema,
  dynamicSettlementPolicySchema,
  hashStableJson
} from "./schemas";

export const CONTEXT_RETENTION_CLASSIFIER_VERSION = "phase3-deterministic-retention-v1";

type SignalType = AttentionEvent["signalTypes"][number];

export type DwellTrackingResult = {
  dwellSeconds: number;
  thresholdMet: boolean;
};

export type RetrievedRetentionEvidenceChunk = {
  id: string;
  summary: string;
  similarityScore: number;
};

export type ContextRetentionRetrievalResult = {
  campaignId: string;
  attentionEventId: string;
  followUpEventId: string;
  evidenceChunks: RetrievedRetentionEvidenceChunk[];
};

export type DeepLinkVerificationResult = {
  verified: boolean;
  score: 0 | 1;
  reason: "agent_deeplink_verified" | "cta_mismatch" | "no_deeplink_event";
};

export type AttentionScoreContribution = {
  signalType: SignalType;
  normalizedScore: number;
  weightBps: number;
  contributionBps: number;
};

export type AttentionScoreResult = {
  scoreBps: number;
  thresholdBps: number;
  settlementEligible: boolean;
  signalTypes: SignalType[];
  contributions: AttentionScoreContribution[];
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "around",
  "because",
  "before",
  "does",
  "from",
  "have",
  "into",
  "keep",
  "that",
  "this",
  "under",
  "want",
  "with",
  "your"
]);

export function trackDwell(input: {
  startedAt: string;
  endedAt: string;
  dwellThresholdSeconds: number;
}): DwellTrackingResult {
  const elapsedMs = new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime();
  const dwellSeconds = Math.max(0, Math.round((elapsedMs / 1000) * 100) / 100);

  return {
    dwellSeconds,
    thresholdMet: dwellSeconds >= input.dwellThresholdSeconds
  };
}

export function scoreRealtimeInteraction(
  interaction: {
    realtimeInteractionScore: SponsoredInterstitialInteraction["realtimeInteractionScore"];
    isolatedFromAnswer: boolean;
  }
): number {
  if (interaction.isolatedFromAnswer !== true) {
    throw new Error("Realtime ad interaction must remain isolated from Answer Agent input.");
  }

  return clamp01(interaction.realtimeInteractionScore);
}

export function retrieveContextRetentionEvidence(input: {
  campaignId: string;
  attentionEventId: string;
  followUpEventId: string;
  followUpQuestion: string;
  retrievalSafeSummary?: string;
  adClaimSummaries: string[];
  adAttributes: string[];
  maxChunks?: number;
}): ContextRetentionRetrievalResult {
  const query = [input.followUpQuestion, input.retrievalSafeSummary ?? ""].join(" ");
  const sourceSummaries = [...input.adAttributes, ...input.adClaimSummaries];
  const evidenceChunks = sourceSummaries
    .map((summary, index) => ({
      id: `retention_chunk_${hashStableJson({
        campaignId: input.campaignId,
        summary,
        index
      }).slice(0, 12)}`,
      summary,
      similarityScore: calculateTokenSimilarity(query, summary)
    }))
    .filter((chunk) => chunk.similarityScore > 0)
    .sort((left, right) => right.similarityScore - left.similarityScore)
    .slice(0, input.maxChunks ?? 4);

  return {
    campaignId: input.campaignId,
    attentionEventId: input.attentionEventId,
    followUpEventId: input.followUpEventId,
    evidenceChunks
  };
}

export function adjudicateContextRetention(input: {
  retrieval: ContextRetentionRetrievalResult;
  followUpQuestion: string;
  createdAt: string;
}): ContextRetentionEvidence {
  const bestSimilarity = input.retrieval.evidenceChunks[0]?.similarityScore ?? 0;
  const score = bestSimilarity >= 0.6 ? 1 : bestSimilarity >= 0.25 ? 0.5 : 0;
  const confidence = input.retrieval.evidenceChunks.length === 0
    ? 0.35
    : Math.min(0.95, Math.max(0.45, bestSimilarity + 0.2));
  const rationale = buildRetentionRationale(score, input.retrieval.evidenceChunks);

  return contextRetentionEvidenceSchema.parse({
    id: `retention_evidence_${hashStableJson({
      campaignId: input.retrieval.campaignId,
      attentionEventId: input.retrieval.attentionEventId,
      followUpEventId: input.retrieval.followUpEventId,
      followUpQuestion: input.followUpQuestion
    }).slice(0, 16)}`,
    campaignId: input.retrieval.campaignId,
    attentionEventId: input.retrieval.attentionEventId,
    followUpEventId: input.retrieval.followUpEventId,
    evidenceChunks: input.retrieval.evidenceChunks,
    score,
    rationale,
    confidence,
    classifierVersion: CONTEXT_RETENTION_CLASSIFIER_VERSION,
    createdAt: input.createdAt
  });
}

export function verifyDeepLink(input: {
  interstitial: Pick<SponsoredInterstitial, "id" | "cta">;
  event?: {
    sourceInterstitialId: string;
    actionType: SponsoredInterstitial["cta"]["actionType"];
    target: string;
  };
}): DeepLinkVerificationResult {
  if (!input.event) {
    return {
      verified: false,
      score: 0,
      reason: "no_deeplink_event"
    };
  }

  const verified =
    input.event.sourceInterstitialId === input.interstitial.id &&
    input.event.actionType === input.interstitial.cta.actionType &&
    input.event.target === input.interstitial.cta.target;

  return verified
    ? {
        verified: true,
        score: 1,
        reason: "agent_deeplink_verified"
      }
    : {
        verified: false,
        score: 0,
        reason: "cta_mismatch"
      };
}

export function validateDynamicSettlementPolicy(
  policy: DynamicSettlementPolicy
): DynamicSettlementPolicy {
  const parsed = dynamicSettlementPolicySchema.parse(policy);

  if (parsed.status !== "active") {
    throw new Error("Only active settlement policies can trigger settlement.");
  }

  return parsed;
}

export function calculateAttentionScore(input: {
  dwellSeconds: number;
  realtimeInteractionScore: number;
  contextRetentionScore: number;
  deepLinkScore: number;
  settlementPolicy: DynamicSettlementPolicy;
}): AttentionScoreResult {
  const policy = validateDynamicSettlementPolicy(input.settlementPolicy);
  const dwellScore = clamp01(input.dwellSeconds / policy.dwellThresholdSeconds);
  const interactionScore = clamp01(input.realtimeInteractionScore);
  const retentionScore = clamp01(input.contextRetentionScore);
  const deepLinkScore = clamp01(input.deepLinkScore);
  const contributions: AttentionScoreContribution[] = [
    {
      signalType: "dwell",
      normalizedScore: dwellScore,
      weightBps: policy.dwellWeightBps,
      contributionBps: Math.round(dwellScore * policy.dwellWeightBps)
    },
    {
      signalType: "realtime_interaction",
      normalizedScore: interactionScore,
      weightBps: policy.interactionWeightBps,
      contributionBps: Math.round(interactionScore * policy.interactionWeightBps)
    },
    {
      signalType: "context_retention",
      normalizedScore: retentionScore,
      weightBps: policy.retentionWeightBps,
      contributionBps: Math.round(retentionScore * policy.retentionWeightBps)
    },
    {
      signalType: "deep_link",
      normalizedScore: deepLinkScore,
      weightBps: policy.deepLinkWeightBps,
      contributionBps: Math.round(deepLinkScore * policy.deepLinkWeightBps)
    }
  ];
  const scoreBps = Math.min(
    10000,
    contributions.reduce((total, contribution) => total + contribution.contributionBps, 0)
  );

  return {
    scoreBps,
    thresholdBps: policy.thresholdBps,
    settlementEligible: scoreBps >= policy.thresholdBps,
    signalTypes: contributions
      .filter((contribution) => contribution.normalizedScore > 0)
      .map((contribution) => contribution.signalType),
    contributions
  };
}

export function createAttentionEvent(input: {
  id: string;
  campaignId: string;
  interstitialId: string;
  dwellSeconds: number;
  realtimeInteractionScore: number;
  contextRetentionScore: number;
  deepLinkScore: number;
  settlementPolicy: DynamicSettlementPolicy;
  pseudonymousUserProof: string;
  occurredAt: string;
}): AttentionEvent {
  const score = calculateAttentionScore(input);

  if (score.signalTypes.length === 0) {
    throw new Error("Attention event requires at least one non-zero attention signal.");
  }

  return attentionEventSchema.parse({
    id: input.id,
    campaignId: input.campaignId,
    interstitialId: input.interstitialId,
    signalTypes: score.signalTypes,
    dwellSeconds: input.dwellSeconds,
    realtimeInteractionScore: input.realtimeInteractionScore,
    contextRetentionScore: input.contextRetentionScore,
    deepLinkScore: input.deepLinkScore,
    scoreBps: score.scoreBps,
    thresholdBps: score.thresholdBps,
    settlementEligible: score.settlementEligible,
    pseudonymousUserProof: input.pseudonymousUserProof,
    occurredAt: input.occurredAt
  });
}

export function createPseudonymousUserProof(input: {
  campaignId: string;
  userVaultId?: string;
  eligibilityTokenHash?: string;
  privacySalt: string;
}): string {
  return hashStableJson({
    campaignId: input.campaignId,
    userVaultId: input.userVaultId ?? null,
    eligibilityTokenHash: input.eligibilityTokenHash ?? null,
    privacySalt: input.privacySalt
  });
}

function buildRetentionRationale(
  score: number,
  chunks: RetrievedRetentionEvidenceChunk[]
): string {
  if (chunks.length === 0 || score === 0) {
    return "No meaningful overlap between the follow-up request and approved sponsored attributes.";
  }

  const leadingSummaries = chunks
    .slice(0, 2)
    .map((chunk) => `"${chunk.summary}"`)
    .join(" and ");

  return score === 1
    ? `Follow-up request explicitly reused sponsored attributes from ${leadingSummaries}.`
    : `Follow-up request weakly referenced sponsored attributes from ${leadingSummaries}.`;
}

function calculateTokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of rightTokens) {
    if (leftTokens.has(token)) {
      overlap += 1;
    }
  }

  return Math.round((overlap / Math.min(leftTokens.size, rightTokens.size)) * 100) / 100;
}

function tokenize(value: string): string[] {
  return (value.toLowerCase().match(/[a-z][a-z0-9-]+/g) ?? [])
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
