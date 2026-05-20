import {
  type AdPoolItem,
  type Campaign,
  type CompiledTargetPolicy,
  type DynamicSettlementPolicy,
  type EligibilityToken,
  adPoolItemSchema,
  campaignSchema,
  compiledTargetPolicySchema,
  hashStableJson
} from "./schemas";
import type { PreparedSponsoredCreativeSet } from "./prepared-creatives";

export type IntentContext = {
  userQuestion: string;
  currentNeedSummary: string;
  intentTags: string[];
  occurredAt: string;
};

export type FrequencyState = {
  dismissedCampaignIds?: string[];
  notRelevantCampaignIds?: string[];
  recentImpressions?: Array<{ campaignId: string; occurredAt: string }>;
  maxImpressionsPerCampaign?: number;
  windowHours?: number;
};

export type CampaignAdCandidate = {
  campaign: Campaign;
  compiledPolicy: CompiledTargetPolicy;
  adPoolItem: AdPoolItem;
  advertiserName: string;
  settlementPolicy?: DynamicSettlementPolicy;
  preparedCreativeSet?: PreparedSponsoredCreativeSet;
};

export type TargetPolicyMatch = {
  matches: boolean;
  score: number;
  matchedSignals: string[];
  matchedKeywords: string[];
  matchedEmbeddingQueries: string[];
  reasons: string[];
};

export type RejectedAdCandidate = {
  campaignId: string;
  reason:
    | "campaign_not_approved"
    | "ad_pool_not_approved"
    | "policy_not_approved"
    | "category_opt_out"
    | "frequency_capped"
    | "no_remaining_budget"
    | "no_interaction_template"
    | "policy_mismatch";
};

export type AdOpportunity = {
  id: string;
  campaign: Campaign;
  compiledPolicy: CompiledTargetPolicy;
  adPoolItem: AdPoolItem;
  advertiserName: string;
  settlementPolicy?: DynamicSettlementPolicy;
  preparedCreativeSet?: PreparedSponsoredCreativeSet;
  relevanceScore: number;
  matchedSignals: string[];
  matchedKeywords: string[];
  matchedEmbeddingQueries: string[];
  selectedInteractionTemplate: AdPoolItem["allowedInteractionTemplates"][number];
  whyMatched: string;
  intentContext: IntentContext;
};

export type AdDecision = {
  shouldRender: boolean;
  reason: "eligible_campaign_selected" | "no_eligible_campaign";
  opportunity?: AdOpportunity;
  rejectedCandidates: RejectedAdCandidate[];
};

export type AdOpportunitySelectionInput = {
  intentContext: IntentContext;
  retrievalSafeSummary: string;
  eligibilityToken: EligibilityToken;
  candidates: CampaignAdCandidate[];
  frequencyState?: FrequencyState;
  now: string;
};

export type EmbeddingQueryMatch = {
  score: number;
  matchedQuery: string;
};

export type EmbeddingAdOpportunitySelectionInput = AdOpportunitySelectionInput & {
  embeddingMatchesByCampaignId: Record<string, EmbeddingQueryMatch | undefined>;
  minimumEmbeddingScore?: number;
};

export type LlmCampaignChoiceSelectionInput = AdOpportunitySelectionInput & {
  selectedCampaignId: string;
  rationale: string;
  fitScore?: number;
};

const SIGNAL_ALIASES: Record<string, string[]> = {
  travel: ["travel", "trip", "itinerary", "hotel", "weekend", "local", "experience", "budget"],
  productivity: ["productivity", "saas", "workflow", "automation", "team", "time", "collaboration"],
  learning: ["learning", "course", "upskill", "professional", "certification", "training"],
  finance_ops: ["finance", "invoice", "invoices", "reconciliation", "close", "payable", "expense", "cash"],
  home_energy: ["home", "energy", "electricity", "utility", "solar", "thermostat", "insulation", "bill"],
  creator_tools: ["creator", "newsletter", "content", "publishing", "sponsor", "media", "audience", "calendar"]
};

export function matchesTargetPolicy(input: {
  policy: CompiledTargetPolicy;
  eligibilityToken: EligibilityToken;
  retrievalSafeSummary: string;
  intentContext: IntentContext;
}): TargetPolicyMatch {
  const policy = compiledTargetPolicySchema.parse(input.policy);
  if (policy.safetyVerdict !== "approved") {
    return {
      matches: false,
      score: 0,
      matchedSignals: [],
      matchedKeywords: [],
      matchedEmbeddingQueries: [],
      reasons: ["compiled policy is not approved"]
    };
  }

  const requiredSignals = readStringArray(policy.ast.requiredContextSignals);
  const intentKeywords = readStringArray(policy.ast.intentKeywords);
  const corpus = normalizeCorpus([
    input.retrievalSafeSummary,
    input.intentContext.userQuestion,
    input.intentContext.currentNeedSummary,
    ...input.intentContext.intentTags,
    ...input.eligibilityToken.intentTags,
    ...input.eligibilityToken.preferenceTags
  ]);

  const matchedSignals = requiredSignals.filter((signal) =>
    signalMatchesCorpus(signal, corpus, input.eligibilityToken)
  );
  const matchedKeywords = intentKeywords.filter((keyword) => corpus.includes(keyword.toLowerCase()));
  const matchedEmbeddingQueries = policy.embeddingQueries.filter((query) =>
    tokenOverlap(query, corpus) >= 2 || signalQueryMatches(query, matchedSignals)
  );

  const signalScore =
    requiredSignals.length === 0 ? 0.2 : matchedSignals.length / requiredSignals.length;
  const keywordScore =
    intentKeywords.length === 0 ? 0.2 : Math.min(matchedKeywords.length / Math.min(intentKeywords.length, 6), 1);
  const embeddingScore =
    policy.embeddingQueries.length === 0
      ? 0
      : Math.min(matchedEmbeddingQueries.length / Math.min(policy.embeddingQueries.length, 3), 1);
  const score = Math.min((signalScore * 0.45) + (keywordScore * 0.35) + (embeddingScore * 0.2), 1);
  const matches =
    requiredSignals.length > 0
      ? matchedSignals.length > 0 && (matchedKeywords.length > 0 || matchedEmbeddingQueries.length > 0)
      : matchedKeywords.length > 0 || matchedEmbeddingQueries.length > 0;

  return {
    matches,
    score,
    matchedSignals,
    matchedKeywords,
    matchedEmbeddingQueries,
    reasons: matches
      ? ["policy matched retrieval-safe context"]
      : ["no sufficient signal, keyword, or embedding-query overlap"]
  };
}

export function selectAdOpportunity(input: AdOpportunitySelectionInput): AdDecision {
  const rejectedCandidates: RejectedAdCandidate[] = [];
  const ranked: AdOpportunity[] = [];

  for (const rawCandidate of input.candidates) {
    const candidate = parseCandidate(rawCandidate);
    const rejectionReason = getPreMatchRejection({
      candidate,
      eligibilityToken: input.eligibilityToken,
      frequencyState: input.frequencyState,
      now: input.now
    });

    if (rejectionReason) {
      rejectedCandidates.push({ campaignId: candidate.campaign.id, reason: rejectionReason });
      continue;
    }

    const match = matchesTargetPolicy({
      policy: candidate.compiledPolicy,
      eligibilityToken: input.eligibilityToken,
      retrievalSafeSummary: input.retrievalSafeSummary,
      intentContext: input.intentContext
    });

    if (!match.matches) {
      rejectedCandidates.push({ campaignId: candidate.campaign.id, reason: "policy_mismatch" });
      continue;
    }

    ranked.push(buildOpportunity({
      candidate,
      intentContext: input.intentContext,
      match
    }));
  }

  ranked.sort((left, right) => {
    if (right.relevanceScore !== left.relevanceScore) {
      return right.relevanceScore - left.relevanceScore;
    }

    return right.campaign.remainingBudgetCents - left.campaign.remainingBudgetCents;
  });

  if (ranked.length === 0) {
    return {
      shouldRender: false,
      reason: "no_eligible_campaign",
      rejectedCandidates
    };
  }

  return {
    shouldRender: true,
    reason: "eligible_campaign_selected",
    opportunity: ranked[0],
    rejectedCandidates
  };
}

export function selectAdOpportunityByEmbedding(
  input: EmbeddingAdOpportunitySelectionInput
): AdDecision {
  const rejectedCandidates: RejectedAdCandidate[] = [];
  const ranked: AdOpportunity[] = [];
  const minimumEmbeddingScore = input.minimumEmbeddingScore ?? 0;

  for (const rawCandidate of input.candidates) {
    const candidate = parseCandidate(rawCandidate);
    const rejectionReason = getPreMatchRejection({
      candidate,
      eligibilityToken: input.eligibilityToken,
      frequencyState: input.frequencyState,
      now: input.now
    });

    if (rejectionReason) {
      rejectedCandidates.push({ campaignId: candidate.campaign.id, reason: rejectionReason });
      continue;
    }

    const embeddingMatch = input.embeddingMatchesByCampaignId[candidate.campaign.id];

    if (!embeddingMatch || embeddingMatch.score < minimumEmbeddingScore) {
      rejectedCandidates.push({ campaignId: candidate.campaign.id, reason: "policy_mismatch" });
      continue;
    }

    const overlapDiagnostics = matchesTargetPolicy({
      policy: candidate.compiledPolicy,
      eligibilityToken: input.eligibilityToken,
      retrievalSafeSummary: input.retrievalSafeSummary,
      intentContext: input.intentContext
    });
    const match: TargetPolicyMatch = {
      matches: true,
      score: clamp01(embeddingMatch.score),
      matchedSignals: overlapDiagnostics.matchedSignals,
      matchedKeywords: overlapDiagnostics.matchedKeywords,
      matchedEmbeddingQueries: [embeddingMatch.matchedQuery],
      reasons: [`embedding cosine similarity ${embeddingMatch.score.toFixed(4)}`]
    };

    ranked.push(buildOpportunity({
      candidate,
      intentContext: input.intentContext,
      match
    }));
  }

  ranked.sort((left, right) => {
    if (right.relevanceScore !== left.relevanceScore) {
      return right.relevanceScore - left.relevanceScore;
    }

    return right.campaign.remainingBudgetCents - left.campaign.remainingBudgetCents;
  });

  if (ranked.length === 0) {
    return {
      shouldRender: false,
      reason: "no_eligible_campaign",
      rejectedCandidates
    };
  }

  return {
    shouldRender: true,
    reason: "eligible_campaign_selected",
    opportunity: ranked[0],
    rejectedCandidates
  };
}

export function selectAdOpportunityByLlmChoice(
  input: LlmCampaignChoiceSelectionInput
): AdDecision {
  const rejectedCandidates: RejectedAdCandidate[] = [];
  const selectedCandidate = input.candidates.find((candidate) =>
    candidate.campaign.id === input.selectedCampaignId
  );

  if (!selectedCandidate) {
    return {
      shouldRender: false,
      reason: "no_eligible_campaign",
      rejectedCandidates: []
    };
  }

  for (const rawCandidate of input.candidates) {
    const candidate = parseCandidate(rawCandidate);
    const rejectionReason = getPreMatchRejection({
      candidate,
      eligibilityToken: input.eligibilityToken,
      frequencyState: input.frequencyState,
      now: input.now
    });

    if (rejectionReason) {
      rejectedCandidates.push({ campaignId: candidate.campaign.id, reason: rejectionReason });
      continue;
    }

    if (candidate.campaign.id !== input.selectedCampaignId) {
      continue;
    }

    const compiledSignals = readStringArray(candidate.compiledPolicy.ast.requiredContextSignals);
    const compiledKeywords = readStringArray(candidate.compiledPolicy.ast.intentKeywords);
    const match: TargetPolicyMatch = {
      matches: true,
      score: clamp01(input.fitScore ?? 1),
      matchedSignals: compiledSignals,
      matchedKeywords: compiledKeywords.slice(0, 4),
      matchedEmbeddingQueries: [],
      reasons: [`professional matching selected by LLM: ${input.rationale}`]
    };

    return {
      shouldRender: true,
      reason: "eligible_campaign_selected",
      opportunity: buildOpportunity({
        candidate,
        intentContext: input.intentContext,
        match
      }),
      rejectedCandidates
    };
  }

  return {
    shouldRender: false,
    reason: "no_eligible_campaign",
    rejectedCandidates: [
      ...rejectedCandidates,
      { campaignId: input.selectedCampaignId, reason: "policy_mismatch" }
    ]
  };
}

export function withinFrequencyCap(
  campaignId: string,
  frequencyState: FrequencyState | undefined,
  now: string
): boolean {
  if (!frequencyState) {
    return true;
  }

  if (frequencyState.dismissedCampaignIds?.includes(campaignId)) {
    return false;
  }

  if (frequencyState.notRelevantCampaignIds?.includes(campaignId)) {
    return false;
  }

  const maxImpressions = frequencyState.maxImpressionsPerCampaign ?? 2;
  const windowHours = frequencyState.windowHours ?? 24;
  const windowStart = new Date(now).getTime() - (windowHours * 60 * 60 * 1000);
  const recentCount = (frequencyState.recentImpressions ?? []).filter((impression) => {
    if (impression.campaignId !== campaignId) {
      return false;
    }

    return new Date(impression.occurredAt).getTime() >= windowStart;
  }).length;

  return recentCount < maxImpressions;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return Math.max(-1, Math.min(1, dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))));
}

function parseCandidate(rawCandidate: CampaignAdCandidate): CampaignAdCandidate {
  return {
    ...rawCandidate,
    campaign: campaignSchema.parse(rawCandidate.campaign),
    adPoolItem: adPoolItemSchema.parse(rawCandidate.adPoolItem),
    compiledPolicy: compiledTargetPolicySchema.parse(rawCandidate.compiledPolicy)
  };
}

function getPreMatchRejection(input: {
  candidate: CampaignAdCandidate;
  eligibilityToken: EligibilityToken;
  frequencyState?: FrequencyState;
  now: string;
}): RejectedAdCandidate["reason"] | null {
  const { campaign, adPoolItem, compiledPolicy } = input.candidate;

  if (campaign.status !== "approved" || campaign.reviewStatus !== "approved") {
    return "campaign_not_approved";
  }

  if (adPoolItem.reviewStatus !== "approved") {
    return "ad_pool_not_approved";
  }

  if (compiledPolicy.safetyVerdict !== "approved") {
    return "policy_not_approved";
  }

  if (isOptedOut(input.eligibilityToken.categoryOptOuts, compiledPolicy, adPoolItem)) {
    return "category_opt_out";
  }

  if (!withinFrequencyCap(campaign.id, input.frequencyState, input.now)) {
    return "frequency_capped";
  }

  if (campaign.remainingBudgetCents <= 0) {
    return "no_remaining_budget";
  }

  if (adPoolItem.allowedInteractionTemplates.length === 0) {
    return "no_interaction_template";
  }

  return null;
}

function buildOpportunity(input: {
  candidate: CampaignAdCandidate;
  intentContext: IntentContext;
  match: TargetPolicyMatch;
}): AdOpportunity {
  const selectedInteractionTemplate =
    chooseInteractionTemplate(input.candidate.adPoolItem, input.match.matchedSignals);
  const id = `opportunity_${hashStableJson({
    campaignId: input.candidate.campaign.id,
    adPoolItemId: input.candidate.adPoolItem.id,
    matchedSignals: input.match.matchedSignals,
    occurredAt: input.intentContext.occurredAt
  }).slice(0, 16)}`;

  return {
    id,
    campaign: input.candidate.campaign,
    compiledPolicy: input.candidate.compiledPolicy,
    adPoolItem: input.candidate.adPoolItem,
    advertiserName: input.candidate.advertiserName,
    settlementPolicy: input.candidate.settlementPolicy,
    preparedCreativeSet: input.candidate.preparedCreativeSet,
    relevanceScore: Math.round(input.match.score * 10000),
    matchedSignals: input.match.matchedSignals,
    matchedKeywords: input.match.matchedKeywords,
    matchedEmbeddingQueries: input.match.matchedEmbeddingQueries,
    selectedInteractionTemplate,
    whyMatched: buildWhyMatched(input.match, input.intentContext.currentNeedSummary),
    intentContext: input.intentContext
  };
}

function chooseInteractionTemplate(
  adPoolItem: AdPoolItem,
  matchedSignals: string[]
): AdPoolItem["allowedInteractionTemplates"][number] {
  if (matchedSignals.includes("productivity") && adPoolItem.allowedInteractionTemplates.includes("slider")) {
    return "slider";
  }

  if (matchedSignals.includes("learning") && adPoolItem.allowedInteractionTemplates.includes("short_text")) {
    return "short_text";
  }

  if (adPoolItem.allowedInteractionTemplates.includes("choice")) {
    return "choice";
  }

  return adPoolItem.allowedInteractionTemplates[0];
}

function buildWhyMatched(match: TargetPolicyMatch, currentNeedSummary: string): string {
  const signalText = match.matchedSignals.length > 0
    ? `Signals: ${match.matchedSignals.join(", ")}.`
    : "No named signal matched.";
  const keywordText = match.matchedKeywords.length > 0
    ? ` Keywords: ${match.matchedKeywords.slice(0, 4).join(", ")}.`
    : "";

  return `${signalText}${keywordText} Retrieval-safe need summary: ${currentNeedSummary}`;
}

function isOptedOut(
  categoryOptOuts: string[],
  policy: CompiledTargetPolicy,
  adPoolItem: AdPoolItem
): boolean {
  const optedOut = categoryOptOuts.map((value) => value.toLowerCase());
  const policySignals = readStringArray(policy.ast.requiredContextSignals);
  const adText = normalizeCorpus([
    adPoolItem.objective,
    adPoolItem.productServiceSummary,
    ...adPoolItem.mustIncludeAttributes
  ]);

  return optedOut.some((category) =>
    policySignals.includes(category) || adText.includes(category)
  );
}

function signalMatchesCorpus(
  signal: string,
  corpus: string,
  eligibilityToken: EligibilityToken
): boolean {
  const normalizedSignal = signal.toLowerCase();
  const explicitSignals = [
    ...eligibilityToken.intentTags,
    ...eligibilityToken.preferenceTags
  ].map((tag) => tag.toLowerCase());

  if (explicitSignals.includes(normalizedSignal)) {
    return true;
  }

  return (SIGNAL_ALIASES[normalizedSignal] ?? [normalizedSignal]).some((alias) =>
    corpus.includes(alias)
  );
}

function signalQueryMatches(query: string, matchedSignals: string[]): boolean {
  const normalizedQuery = query.toLowerCase();
  return matchedSignals.some((signal) =>
    normalizedQuery.includes(signal) ||
    (SIGNAL_ALIASES[signal] ?? []).some((alias) => normalizedQuery.includes(alias))
  );
}

function tokenOverlap(text: string, corpus: string): number {
  const tokens = new Set((text.toLowerCase().match(/[a-z][a-z0-9-]+/g) ?? [])
    .filter((token) => token.length >= 4));
  let overlap = 0;

  for (const token of tokens) {
    if (corpus.includes(token)) {
      overlap += 1;
    }
  }

  return overlap;
}

function normalizeCorpus(values: string[]): string {
  return values.join(" ").toLowerCase().replace(/\s+/g, " ").trim();
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
