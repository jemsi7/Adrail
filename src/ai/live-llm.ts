import { z } from "zod";
import { applySponsoredInteraction, buildAnswerAgentInput } from "../domain/boundaries";
import { guardSponsoredInterstitial } from "../domain/ad-generation";
import {
  TARGET_POLICY_COMPILER_VERSION,
  detectSensitiveTargeting,
  extractPolicyContextSignals,
  extractPolicyKeywords
} from "../domain/policy";
import type { Phase4DemoScenario } from "../domain/demo-ux";
import {
  type AdPoolItem,
  type CompiledTargetPolicy,
  type SponsoredInterstitial,
  compiledTargetPolicySchema,
  hashStableJson,
  sponsoredInterstitialSchema
} from "../domain/schemas";
import {
  callOpenRouterChatJson,
  createJsonSchemaResponseFormat,
  type OpenRouterConfig
} from "./openrouter";

export const DEFAULT_OPENROUTER_TEXT_MODEL = "openai/gpt-4.1-mini";
export const DEFAULT_OPENROUTER_EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const LIVE_POLICY_COMPILER_VERSION = "openrouter-structured-output-v1";

const livePolicyOutputSchema = z.object({
  compiledSummary: z.string().min(1),
  safetyVerdict: z.enum(["approved", "needs_review", "blocked"]),
  prohibitedSensitiveSignals: z.array(z.string()).default([]),
  requiredContextSignals: z.array(z.string()).default([]),
  intentKeywords: z.array(z.string()).default([]),
  embeddingQueries: z.array(z.string()).default([])
}).strict();

const liveAnswerOutputSchema = z.object({
  answer: z.string().min(1)
}).strict();

const liveInterstitialOutputSchema = z.object({
  headline: z.string().min(1),
  body: z.string().min(1),
  cardDetails: z.array(z.object({
    title: z.string().min(1),
    detail: z.string().min(1)
  }).strict()).min(1),
  interactionPrompt: z.string().min(1),
  ctaLabel: z.string().min(1)
}).strict();

export async function compilePolicyWithOpenRouter(input: {
  config: OpenRouterConfig;
  model?: string;
  id: string;
  campaignId: string;
  sourcePolicyId: string;
  sourceText: string;
  createdAt: string;
}): Promise<CompiledTargetPolicy> {
  const output = livePolicyOutputSchema.parse(await callOpenRouterChatJson({
    config: input.config,
    model: input.model ?? DEFAULT_OPENROUTER_TEXT_MODEL,
    responseFormat: createJsonSchemaResponseFormat({
      name: "compiled_target_policy",
      schema: {
        type: "object",
        additionalProperties: false,
        required: [
          "compiledSummary",
          "safetyVerdict",
          "prohibitedSensitiveSignals",
          "requiredContextSignals",
          "intentKeywords",
          "embeddingQueries"
        ],
        properties: {
          compiledSummary: { type: "string" },
          safetyVerdict: { type: "string", enum: ["approved", "needs_review", "blocked"] },
          prohibitedSensitiveSignals: { type: "array", items: { type: "string" } },
          requiredContextSignals: { type: "array", items: { type: "string" } },
          intentKeywords: { type: "array", items: { type: "string" } },
          embeddingQueries: { type: "array", items: { type: "string" } }
        }
      }
    }),
    messages: [
      {
        role: "system",
        content: [
          "You compile advertiser natural-language targeting into privacy-safe policy metadata.",
          "Never approve policies based on sensitive traits such as health, religion, race, politics, sexuality, minors, or hardship.",
          "Return compact English fields only. Do not include raw user data."
        ].join(" ")
      },
      {
        role: "user",
        content: `Advertiser policy:\n${input.sourceText}`
      }
    ]
  }));
  const deterministicDetection = detectSensitiveTargeting(input.sourceText);
  const prohibitedSensitiveSignals = uniqueStrings([
    ...output.prohibitedSensitiveSignals,
    ...deterministicDetection.prohibitedSensitiveSignals
  ]);
  const safetyVerdict =
    deterministicDetection.verdict === "blocked" || output.safetyVerdict === "blocked"
      ? "blocked"
      : output.safetyVerdict;
  const requiredContextSignals = uniqueStrings([
    ...output.requiredContextSignals,
    ...extractPolicyContextSignals(input.sourceText)
  ]).slice(0, 12);
  const intentKeywords = uniqueStrings([
    ...output.intentKeywords,
    ...extractPolicyKeywords(input.sourceText)
  ]).slice(0, 24);
  const embeddingQueries = safetyVerdict === "approved"
    ? uniqueStrings(output.embeddingQueries).slice(0, 8)
    : [];
  const ast = {
    kind: "natural_language_policy_v2",
    language: "en",
    sourceText: input.sourceText.trim(),
    requiredContextSignals,
    intentKeywords,
    blockedSensitiveSignals: prohibitedSensitiveSignals,
    matchMode: "required_signal_or_keyword_overlap",
    privacyBoundary: "platform_private_matching",
    provider: "openrouter"
  };
  const compilerVersion = `${TARGET_POLICY_COMPILER_VERSION}+${LIVE_POLICY_COMPILER_VERSION}`;
  const policyHash = hashStableJson({
    campaignId: input.campaignId,
    sourcePolicyId: input.sourcePolicyId,
    ast,
    embeddingQueries,
    compilerVersion
  });

  return compiledTargetPolicySchema.parse({
    id: input.id,
    campaignId: input.campaignId,
    sourcePolicyId: input.sourcePolicyId,
    ast,
    embeddingQueries,
    prohibitedSensitiveSignals,
    compiledSummary: safetyVerdict === "blocked"
      ? `Blocked policy due to prohibited sensitive targeting: ${prohibitedSensitiveSignals.join(", ")}`
      : output.compiledSummary,
    safetyVerdict,
    policyHash,
    compilerVersion,
    createdAt: input.createdAt
  });
}

export async function generateAnswerWithOpenRouter(input: {
  config: OpenRouterConfig;
  model?: string;
  userQuestion: string;
  retrievalSafeSummary: string;
}): Promise<string> {
  const answerInput = buildAnswerAgentInput({
    userQuestion: input.userQuestion,
    retrievalSafeSummary: input.retrievalSafeSummary,
    recentUserMessages: [input.userQuestion],
    serviceKnowledge: [],
    consent: {
      adPersonalization: true,
      categoryOptOuts: []
    }
  });
  const output = liveAnswerOutputSchema.parse(await callOpenRouterChatJson({
    config: input.config,
    model: input.model ?? DEFAULT_OPENROUTER_TEXT_MODEL,
    responseFormat: createJsonSchemaResponseFormat({
      name: "service_answer",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["answer"],
        properties: {
          answer: { type: "string" }
        }
      }
    }),
    messages: [
      {
        role: "system",
        content: [
          "You are the service Answer Agent.",
          "Answer the user's question directly in English.",
          "You must not mention advertisers, sponsored content, campaign bids, or ad interactions."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify(answerInput)
      }
    ]
  }));

  return output.answer;
}

export async function customizeInterstitialWithOpenRouter(input: {
  config: OpenRouterConfig;
  model?: string;
  interstitial: SponsoredInterstitial;
  adPoolItem: AdPoolItem;
  compiledPolicy: CompiledTargetPolicy;
  userNeedSummary: string;
}): Promise<SponsoredInterstitial> {
  const output = liveInterstitialOutputSchema.parse(await callOpenRouterChatJson({
    config: input.config,
    model: input.model ?? DEFAULT_OPENROUTER_TEXT_MODEL,
    responseFormat: createJsonSchemaResponseFormat({
      name: "sponsored_interstitial_copy",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "body", "cardDetails", "interactionPrompt", "ctaLabel"],
        properties: {
          headline: { type: "string" },
          body: { type: "string" },
          cardDetails: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "detail"],
              properties: {
                title: { type: "string" },
                detail: { type: "string" }
              }
            }
          },
          interactionPrompt: { type: "string" },
          ctaLabel: { type: "string" }
        }
      }
    }),
    messages: [
      {
        role: "system",
        content: [
          "You generate copy for a clearly labeled sponsored interstitial.",
          "Stay inside the approved claim set and do not imply the service answer is paid.",
          "Do not include personal data or raw conversation text."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify({
          advertiserName: input.interstitial.advertiserName,
          campaignName: input.interstitial.sponsoredMetadata.campaignId,
          productServiceSummary: input.adPoolItem.productServiceSummary,
          userNeedSummary: input.userNeedSummary,
          mustIncludeAttributes: input.adPoolItem.mustIncludeAttributes,
          prohibitedClaims: input.adPoolItem.prohibitedClaims,
          existingInteractionType: input.interstitial.interactionSpec.type
        })
      }
    ]
  }));
  const visualSpec = {
    ...input.interstitial.visualSpec,
    cards: input.adPoolItem.mustIncludeAttributes.map((attribute, index) => ({
      title: attribute,
      detail: output.cardDetails[index]?.detail ?? "Included from the approved campaign brief."
    }))
  };
  const interstitial = sponsoredInterstitialSchema.parse({
    ...input.interstitial,
    headline: `${input.adPoolItem.productServiceSummary.split(".")[0]}: ${output.headline}`,
    body: `${output.body} Includes ${input.adPoolItem.mustIncludeAttributes.join("; ")}.`,
    visualSpec,
    interactionSpec: {
      ...input.interstitial.interactionSpec,
      prompt: output.interactionPrompt
    },
    cta: {
      ...input.interstitial.cta,
      label: output.ctaLabel
    }
  });
  const guard = guardSponsoredInterstitial({
    interstitial,
    adPoolItem: input.adPoolItem,
    compiledPolicy: input.compiledPolicy
  });

  if (!guard.approved) {
    throw new Error(`OpenRouter interstitial failed policy guard: ${guard.violations.join(", ")}`);
  }

  return interstitial;
}

export async function enhanceScenarioWithOpenRouter(input: {
  scenario: Phase4DemoScenario;
  config: OpenRouterConfig;
  model?: string;
}): Promise<Phase4DemoScenario> {
  const [serviceAnswer, interstitial] = await Promise.all([
    generateAnswerWithOpenRouter({
      config: input.config,
      model: input.model,
      userQuestion: input.scenario.userChat.userQuestion,
      retrievalSafeSummary: input.scenario.userChat.retrievalSafeSummary
    }),
    customizeInterstitialWithOpenRouter({
      config: input.config,
      model: input.model,
      interstitial: input.scenario.adExperience.interstitial,
      adPoolItem: input.scenario.fixture.adPoolItem,
      compiledPolicy: input.scenario.fixture.compiledPolicy,
      userNeedSummary: input.scenario.userChat.retrievalSafeSummary
    })
  ]);
  const { updatedInterstitial, interactionEvent } = applySponsoredInteraction({
    interstitial,
    interactionId: input.scenario.adExperience.interactionEvent.id,
    interactionInput: input.scenario.adExperience.interactionEvent.input,
    occurredAt: input.scenario.adExperience.interactionEvent.occurredAt
  });

  return {
    ...input.scenario,
    userChat: {
      ...input.scenario.userChat,
      serviceAnswer
    },
    adExperience: {
      ...input.scenario.adExperience,
      interstitial,
      updatedInterstitial,
      interactionEvent,
      disclosureLines: [
        "This is a sponsored interactive ad.",
        `Advertiser: ${interstitial.advertiserName}`,
        interstitial.disclosure.whyShown,
        interstitial.disclosure.dataBoundary,
        "OpenRouter generated this live demo copy under the same policy guard."
      ]
    }
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
