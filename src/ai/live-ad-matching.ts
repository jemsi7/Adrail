import { createDemoAdThemeFixtures, createEligibilityTokenFixture, createIntentContextFixture } from "../domain/demo-fixtures";
import type { DemoAdTheme, DemoPresetDraft } from "../domain/demo-fixtures";
import {
  cosineSimilarity,
  selectAdOpportunityByEmbedding,
  selectAdOpportunityByLlmChoice,
  type AdDecision,
  type EmbeddingQueryMatch
} from "../domain/matching";
import {
  callOpenRouterChatJson,
  callOpenRouterEmbedding,
  createJsonSchemaResponseFormat,
  type OpenRouterConfig
} from "./openrouter";
import { DEFAULT_OPENROUTER_TEXT_MODEL } from "./live-llm";

const DEFAULT_NOW = "2026-05-20T06:30:00.000Z";
const MINIMUM_EMBEDDING_SCORE = 0.01;

export type CampaignMatchingMode = "fast" | "professional";

export type LiveEmbeddingAdSelectionResult = {
  selectedTheme: DemoAdTheme;
  decision: AdDecision;
  embeddingMatchesByCampaignId: Record<string, EmbeddingQueryMatch | undefined>;
};

export type LiveProfessionalAdSelectionResult = {
  selectedTheme: DemoAdTheme;
  decision: AdDecision;
  rationale: string;
  fitScore: number;
};

type SelectionContext = {
  now: string;
  fixtures: ReturnType<typeof createDemoAdThemeFixtures>;
  activeFixture: ReturnType<typeof createDemoAdThemeFixtures>[number];
  candidates: ReturnType<typeof createDemoAdThemeFixtures>;
  intentContext: ReturnType<typeof createIntentContextFixture>;
  eligibilityToken: ReturnType<typeof createEligibilityTokenFixture>;
};

type ProfessionalSelectionOutput = {
  selectedCampaignId: string;
  rationale: string;
  fitScore: number;
};

export async function selectAdThemeWithOpenRouterEmbeddings(input: {
  config: OpenRouterConfig;
  model: string;
  theme: DemoAdTheme;
  customPresets?: DemoPresetDraft[];
  userQuestion?: string;
  readyThemes?: string[];
  now?: string;
}): Promise<LiveEmbeddingAdSelectionResult> {
  const context = createSelectionContext(input);
  const queryRefs = context.candidates.flatMap((candidate) =>
    candidate.compiledPolicy.embeddingQueries.map((query) => ({
      campaignId: candidate.campaign.id,
      query
    }))
  );

  if (queryRefs.length === 0) {
    throw new Error("No approved embedding queries were available for live ad matching.");
  }

  const embeddingInputTexts = [
    buildConversationEmbeddingText({
      userQuestion: context.intentContext.userQuestion,
      retrievalSafeSummary: context.intentContext.currentNeedSummary,
      intentTags: context.intentContext.intentTags
    }),
    ...queryRefs.map((ref) => ref.query)
  ];
  const embeddings = await callOpenRouterEmbedding({
    config: input.config,
    model: input.model,
    input: embeddingInputTexts
  });

  if (embeddings.length !== embeddingInputTexts.length) {
    throw new Error("OpenRouter returned an unexpected number of embedding vectors.");
  }

  const userContextEmbedding = embeddings[0];
  const embeddingMatchesByCampaignId: Record<string, EmbeddingQueryMatch | undefined> = {};

  queryRefs.forEach((ref, index) => {
    const queryEmbedding = embeddings[index + 1];
    const score = cosineSimilarity(userContextEmbedding, queryEmbedding);
    const current = embeddingMatchesByCampaignId[ref.campaignId];

    if (!current || score > current.score) {
      embeddingMatchesByCampaignId[ref.campaignId] = {
        score,
        matchedQuery: ref.query
      };
    }
  });

  const decision = selectAdOpportunityByEmbedding({
    intentContext: context.intentContext,
    retrievalSafeSummary: context.intentContext.currentNeedSummary,
    eligibilityToken: context.eligibilityToken,
    candidates: context.candidates,
    embeddingMatchesByCampaignId,
    minimumEmbeddingScore: MINIMUM_EMBEDDING_SCORE,
    now: context.now
  });

  if (!decision.opportunity) {
    throw new Error("Embedding similarity did not produce an eligible sponsored scenario.");
  }

  const selectedFixture = context.candidates.find(
    (candidate) => candidate.campaign.id === decision.opportunity!.campaign.id
  );

  if (!selectedFixture) {
    throw new Error("Embedding-selected campaign was not found in the ready campaign set.");
  }

  return {
    selectedTheme: selectedFixture.theme,
    decision,
    embeddingMatchesByCampaignId
  };
}

export async function selectAdThemeWithOpenRouterProfessionalMatching(input: {
  config: OpenRouterConfig;
  model?: string;
  theme: DemoAdTheme;
  customPresets?: DemoPresetDraft[];
  userQuestion?: string;
  readyThemes?: string[];
  matchingModesByTheme?: Record<string, CampaignMatchingMode>;
  now?: string;
}): Promise<LiveProfessionalAdSelectionResult> {
  const context = createSelectionContext(input);
  const professionalThemes = new Set(
    Object.entries(input.matchingModesByTheme ?? {})
      .filter(([, mode]) => mode === "professional")
      .map(([theme]) => theme)
  );
  const candidateSummaries = context.candidates.map((candidate) => ({
    theme: candidate.theme,
    campaignId: candidate.campaign.id,
    matchingMode: professionalThemes.has(candidate.theme) ? "professional" : "fast",
    advertiserName: candidate.advertiserName,
    campaignName: candidate.campaign.name,
    objective: candidate.campaign.objective,
    productServiceSummary: candidate.adPoolItem.productServiceSummary,
    compiledPolicySummary: candidate.compiledPolicy.compiledSummary,
    approvedSignals: candidate.compiledPolicy.ast.requiredContextSignals,
    intentKeywords: candidate.compiledPolicy.ast.intentKeywords,
    embeddingQueries: candidate.compiledPolicy.embeddingQueries,
    mustIncludeAttributes: candidate.adPoolItem.mustIncludeAttributes,
    prohibitedClaims: candidate.adPoolItem.prohibitedClaims
  }));
  const output = await callOpenRouterChatJson<ProfessionalSelectionOutput>({
    config: input.config,
    model: input.model ?? DEFAULT_OPENROUTER_TEXT_MODEL,
    responseFormat: createJsonSchemaResponseFormat({
      name: "professional_ad_selection",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["selectedCampaignId", "rationale", "fitScore"],
        properties: {
          selectedCampaignId: { type: "string" },
          rationale: { type: "string" },
          fitScore: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    }),
    messages: [
      {
        role: "system",
        content: [
          "You are the Professional Matching ad selector for a privacy-safe AI ad platform.",
          "Choose exactly one eligible campaign for the current user need.",
          "Use semantic judgment over campaign policy, approved claims, and current need.",
          "Return a fitScore from 0 to 1 that reflects match confidence, not advertiser budget.",
          "Do not infer or target sensitive traits. Do not ask for raw transcripts or user identity.",
          "Return only a campaign id from the candidate list."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify({
          userContext: {
            latestUserMessage: context.intentContext.userQuestion,
            retrievalSafeSummary: context.intentContext.currentNeedSummary,
            intentTags: context.intentContext.intentTags
          },
          candidates: candidateSummaries
        })
      }
    ]
  });
  const selectedCampaign = context.candidates.find((candidate) =>
    candidate.campaign.id === output.selectedCampaignId
  );

  if (!selectedCampaign) {
    throw new Error("Professional Matching returned a campaign id outside the candidate list.");
  }

  const decision = selectAdOpportunityByLlmChoice({
    intentContext: context.intentContext,
    retrievalSafeSummary: context.intentContext.currentNeedSummary,
    eligibilityToken: context.eligibilityToken,
    candidates: context.candidates,
    selectedCampaignId: output.selectedCampaignId,
    rationale: output.rationale,
    fitScore: output.fitScore,
    now: context.now
  });

  if (!decision.opportunity) {
    throw new Error("Professional Matching selected a campaign that failed eligibility guards.");
  }

  return {
    selectedTheme: selectedCampaign.theme,
    decision,
    rationale: output.rationale,
    fitScore: output.fitScore
  };
}

function createSelectionContext(input: {
  theme: DemoAdTheme;
  customPresets?: DemoPresetDraft[];
  userQuestion?: string;
  readyThemes?: string[];
  now?: string;
}): SelectionContext {
  const now = input.now ?? DEFAULT_NOW;
  const fixtures = createDemoAdThemeFixtures(now, input.customPresets ?? []);
  const activeFixture = fixtures.find((fixture) => fixture.theme === input.theme);

  if (!activeFixture) {
    throw new Error(`Missing demo fixture for ${input.theme}.`);
  }

  const readyThemeSet = new Set(input.readyThemes && input.readyThemes.length > 0
    ? input.readyThemes
    : [input.theme]);
  const candidates = fixtures.filter((fixture) => readyThemeSet.has(fixture.theme));

  if (candidates.length === 0) {
    throw new Error("No ready campaign candidates were available for matching.");
  }

  const intentContext = createIntentContextFixture(
    activeFixture.theme,
    now,
    activeFixture,
    input.userQuestion
  );
  const eligibilityToken = createEligibilityTokenFixture({
    id: `eligibility_${activeFixture.theme}_live_matching`,
    snapshotId: `snapshot_${activeFixture.theme}_live_matching`,
    intentTags: input.userQuestion ? intentContext.intentTags : [activeFixture.theme, ...intentContext.intentTags],
    preferenceTags: !input.userQuestion && activeFixture.theme === "travel" ? ["budget", "nature"] : [],
    now
  });

  return {
    now,
    fixtures,
    activeFixture,
    candidates,
    intentContext,
    eligibilityToken
  };
}

function buildConversationEmbeddingText(input: {
  userQuestion: string;
  retrievalSafeSummary: string;
  intentTags: string[];
}): string {
  return [
    "User conversation context for privacy-safe ad matching.",
    `Latest user message: ${input.userQuestion}`,
    `Retrieval-safe summary: ${input.retrievalSafeSummary}`,
    `Intent tags: ${input.intentTags.join(", ")}`
  ].join("\n");
}
