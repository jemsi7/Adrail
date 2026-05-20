import type { Phase4DemoScenario } from "../domain/demo-ux";

type SignalContribution = Phase4DemoScenario["settlementDashboard"]["contributionRows"][number];
type SignalType = SignalContribution["signalType"];

export type RuntimePerformanceMeasurement = {
  source: "browser_session";
  campaignId: string;
  interstitialId: string;
  outcome: "cta";
  measuredAt: string;
  dwellSeconds: number;
  dwellThresholdSeconds: number;
  realtimeInteractionScore: number;
  contextRetentionScore: number;
  deepLinkScore: number;
  scoreBps: number;
  thresholdBps: number;
  settlementEligible: boolean;
  signalTypes: SignalType[];
  contributionRows: SignalContribution[];
  interactionTouched: boolean;
  interactionValue: string;
  retention: {
    followUpObserved: boolean;
    confidence: number;
    rationale: string;
    evidenceCount: number;
    evidenceSummaries: string[];
    classifierVersion: "browser-session-retention-v1";
  };
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

export function createRuntimePerformanceMeasurement(input: {
  scenario: Phase4DemoScenario;
  startedAtMs: number;
  endedAtMs: number;
  interactionTouched: boolean;
  interactionValue: string;
  measuredAt?: string;
}): RuntimePerformanceMeasurement {
  const policy = readSettlementPolicy(input.scenario);
  const dwellSeconds = Math.max(0, Math.round(((input.endedAtMs - input.startedAtMs) / 1000) * 100) / 100);
  const retention = buildRetentionResult(input.scenario);
  const scores = calculateRuntimeScore({
    scenario: input.scenario,
    dwellSeconds,
    realtimeInteractionScore: input.interactionTouched ? 1 : 0,
    contextRetentionScore: retention.score,
    deepLinkScore: 1
  });

  return {
    source: "browser_session",
    campaignId: input.scenario.fixture.campaign.id,
    interstitialId: input.scenario.adExperience.interstitial.id,
    outcome: "cta",
    measuredAt: input.measuredAt ?? new Date().toISOString(),
    dwellSeconds,
    dwellThresholdSeconds: policy.dwellThresholdSeconds,
    realtimeInteractionScore: input.interactionTouched ? 1 : 0,
    contextRetentionScore: retention.score,
    deepLinkScore: 1,
    scoreBps: scores.scoreBps,
    thresholdBps: policy.thresholdBps,
    settlementEligible: scores.scoreBps >= policy.thresholdBps,
    signalTypes: scores.signalTypes,
    contributionRows: scores.contributionRows,
    interactionTouched: input.interactionTouched,
    interactionValue: input.interactionValue,
    retention: {
      followUpObserved: false,
      confidence: 0,
      rationale: "No follow-up request has been measured after the sponsored message yet.",
      evidenceCount: 0,
      evidenceSummaries: [],
      classifierVersion: "browser-session-retention-v1"
    }
  };
}

export function updateRuntimePerformanceWithFollowUp(input: {
  measurement: RuntimePerformanceMeasurement;
  scenario: Phase4DemoScenario;
  followUpQuestion: string;
  measuredAt?: string;
}): RuntimePerformanceMeasurement {
  const retention = buildRetentionResult(input.scenario, input.followUpQuestion);
  const scores = calculateRuntimeScore({
    scenario: input.scenario,
    dwellSeconds: input.measurement.dwellSeconds,
    realtimeInteractionScore: input.measurement.realtimeInteractionScore,
    contextRetentionScore: retention.score,
    deepLinkScore: input.measurement.deepLinkScore
  });

  return {
    ...input.measurement,
    measuredAt: input.measuredAt ?? new Date().toISOString(),
    contextRetentionScore: retention.score,
    scoreBps: scores.scoreBps,
    settlementEligible: scores.scoreBps >= input.measurement.thresholdBps,
    signalTypes: scores.signalTypes,
    contributionRows: scores.contributionRows,
    retention: {
      followUpObserved: true,
      confidence: retention.confidence,
      rationale: retention.rationale,
      evidenceCount: retention.evidenceSummaries.length,
      evidenceSummaries: retention.evidenceSummaries,
      classifierVersion: "browser-session-retention-v1"
    }
  };
}

export function isRuntimePerformanceMeasurement(value: unknown): value is RuntimePerformanceMeasurement {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RuntimePerformanceMeasurement>;

  return candidate.source === "browser_session" &&
    candidate.outcome === "cta" &&
    typeof candidate.campaignId === "string" &&
    typeof candidate.interstitialId === "string" &&
    typeof candidate.measuredAt === "string" &&
    typeof candidate.dwellSeconds === "number" &&
    typeof candidate.realtimeInteractionScore === "number" &&
    typeof candidate.contextRetentionScore === "number" &&
    typeof candidate.deepLinkScore === "number" &&
    typeof candidate.scoreBps === "number" &&
    typeof candidate.thresholdBps === "number" &&
    typeof candidate.settlementEligible === "boolean" &&
    Array.isArray(candidate.contributionRows) &&
    Boolean(candidate.retention);
}

function calculateRuntimeScore(input: {
  scenario: Phase4DemoScenario;
  dwellSeconds: number;
  realtimeInteractionScore: number;
  contextRetentionScore: number;
  deepLinkScore: number;
}): {
  scoreBps: number;
  signalTypes: SignalType[];
  contributionRows: SignalContribution[];
} {
  const policy = readSettlementPolicy(input.scenario);
  const normalizedScores: Record<SignalType, number> = {
    dwell: clamp01(input.dwellSeconds / policy.dwellThresholdSeconds),
    realtime_interaction: clamp01(input.realtimeInteractionScore),
    context_retention: clamp01(input.contextRetentionScore),
    deep_link: clamp01(input.deepLinkScore)
  };
  const weights: Record<SignalType, number> = {
    dwell: policy.dwellWeightBps,
    realtime_interaction: policy.interactionWeightBps,
    context_retention: policy.retentionWeightBps,
    deep_link: policy.deepLinkWeightBps
  };
  const contributionRows = ([
    "dwell",
    "realtime_interaction",
    "context_retention",
    "deep_link"
  ] as SignalType[]).map((signalType) => ({
    signalType,
    normalizedScore: normalizedScores[signalType],
    weightBps: weights[signalType],
    contributionBps: Math.round(normalizedScores[signalType] * weights[signalType])
  }));

  return {
    scoreBps: Math.min(
      10000,
      contributionRows.reduce((total, row) => total + row.contributionBps, 0)
    ),
    signalTypes: contributionRows
      .filter((row) => row.normalizedScore > 0)
      .map((row) => row.signalType),
    contributionRows
  };
}

function buildRetentionResult(
  scenario: Phase4DemoScenario,
  followUpQuestion?: string
): {
  score: number;
  confidence: number;
  rationale: string;
  evidenceSummaries: string[];
} {
  if (!followUpQuestion?.trim()) {
    return {
      score: 0,
      confidence: 0,
      rationale: "No follow-up request has been measured after the sponsored message yet.",
      evidenceSummaries: []
    };
  }

  const sourceSummaries = [
    ...scenario.fixture.adPoolItem.mustIncludeAttributes,
    scenario.fixture.adPoolItem.productServiceSummary
  ];
  const chunks = sourceSummaries
    .map((summary) => ({
      summary,
      similarityScore: calculateTokenSimilarity(followUpQuestion, summary)
    }))
    .filter((chunk) => chunk.similarityScore > 0)
    .sort((left, right) => right.similarityScore - left.similarityScore)
    .slice(0, 3);
  const bestSimilarity = chunks[0]?.similarityScore ?? 0;
  const score = bestSimilarity >= 0.6 ? 1 : bestSimilarity >= 0.25 ? 0.5 : 0;
  const confidence = chunks.length === 0
    ? 0.35
    : Math.min(0.95, Math.max(0.45, bestSimilarity + 0.2));

  if (chunks.length === 0 || score === 0) {
    return {
      score,
      confidence,
      rationale: "The measured follow-up did not reuse approved sponsored attributes.",
      evidenceSummaries: chunks.map((chunk) => chunk.summary)
    };
  }

  const leadingSummaries = chunks
    .slice(0, 2)
    .map((chunk) => `"${chunk.summary}"`)
    .join(" and ");

  return {
    score,
    confidence,
    rationale: score === 1
      ? `Measured follow-up explicitly reused sponsored attributes from ${leadingSummaries}.`
      : `Measured follow-up weakly referenced sponsored attributes from ${leadingSummaries}.`,
    evidenceSummaries: chunks.map((chunk) => chunk.summary)
  };
}

function readSettlementPolicy(scenario: Phase4DemoScenario) {
  const policy = scenario.fixture.settlementPolicy;

  if (!policy) {
    throw new Error("Runtime performance measurement requires a settlement policy.");
  }

  return policy;
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
