import { z } from "zod";
import type {
  AdPoolItem,
  Campaign,
  CompiledTargetPolicy,
  SponsoredInterstitial
} from "./schemas";

type InteractionType = SponsoredInterstitial["interactionSpec"]["type"];

export type PreparedChoiceOutcome = {
  value: string;
  title: string;
  detail: string;
  highlight: string;
};

export type PreparedSliderBand = {
  min: number;
  max: number;
  label: string;
  detail: string;
};

export type PreparedInteractionResultSpec =
  | {
      type: "choice";
      outcomes: PreparedChoiceOutcome[];
    }
  | {
      type: "slider";
      minLabel: string;
      maxLabel: string;
      bands: PreparedSliderBand[];
    }
  | {
      type: "short_text";
      placeholder: string;
      resultTitle: string;
      resultTemplate: string;
      examples: string[];
    };

export type PreparedSponsoredCreativeVariant = {
  interactionType: InteractionType;
  headline: string;
  body: string;
  interactionSpec: SponsoredInterstitial["interactionSpec"];
  visualSpec: Record<string, unknown>;
  resultSpec: PreparedInteractionResultSpec;
};

export type PreparedSponsoredCreativeSet = {
  campaignId: string;
  adPoolItemId: string;
  preparedAt: string;
  sourceHash: string;
  variants: PreparedSponsoredCreativeVariant[];
};

const interactionTypeSchema = z.enum(["choice", "slider", "short_text"]);

const preparedChoiceOutcomeSchema = z.object({
  value: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  highlight: z.string().min(1)
}).strict();

const preparedSliderBandSchema = z.object({
  min: z.number(),
  max: z.number(),
  label: z.string().min(1),
  detail: z.string().min(1)
}).strict();

export const preparedInteractionResultSpecSchema: z.ZodType<PreparedInteractionResultSpec> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("choice"),
    outcomes: z.array(preparedChoiceOutcomeSchema).min(1)
  }).strict(),
  z.object({
    type: z.literal("slider"),
    minLabel: z.string().min(1),
    maxLabel: z.string().min(1),
    bands: z.array(preparedSliderBandSchema).min(1)
  }).strict(),
  z.object({
    type: z.literal("short_text"),
    placeholder: z.string().min(1),
    resultTitle: z.string().min(1),
    resultTemplate: z.string().min(1),
    examples: z.array(z.string().min(1)).min(1)
  }).strict()
]);

export const preparedSponsoredCreativeVariantSchema: z.ZodType<PreparedSponsoredCreativeVariant> = z.object({
  interactionType: interactionTypeSchema,
  headline: z.string().min(1),
  body: z.string().min(1),
  interactionSpec: z.object({
    type: interactionTypeSchema,
    prompt: z.string().min(1),
    allowedOutputs: z.array(z.string().min(1)).min(1)
  }).strict(),
  visualSpec: z.record(z.string(), z.unknown()),
  resultSpec: preparedInteractionResultSpecSchema
}).strict();

export const preparedSponsoredCreativeSetSchema: z.ZodType<PreparedSponsoredCreativeSet> = z.object({
  campaignId: z.string().min(1),
  adPoolItemId: z.string().min(1),
  preparedAt: z.string().datetime({ offset: true }),
  sourceHash: z.string().min(12),
  variants: z.array(preparedSponsoredCreativeVariantSchema).min(1)
}).strict();

export function prepareSponsoredCreativeSet(input: {
  campaign: Campaign;
  adPoolItem: AdPoolItem;
  advertiserName: string;
  compiledPolicy: CompiledTargetPolicy;
  preparedAt: string;
}): PreparedSponsoredCreativeSet {
  const primarySignal = inferPrimarySignal({
    adPoolItem: input.adPoolItem,
    compiledPolicy: input.compiledPolicy
  });
  const variants = input.adPoolItem.allowedInteractionTemplates.map((interactionType) =>
    prepareCreativeVariant({
      interactionType,
      primarySignal,
      campaign: input.campaign,
      adPoolItem: input.adPoolItem,
      advertiserName: input.advertiserName
    })
  );

  return preparedSponsoredCreativeSetSchema.parse({
    campaignId: input.campaign.id,
    adPoolItemId: input.adPoolItem.id,
    preparedAt: input.preparedAt,
    sourceHash: stableFingerprint({
      campaignId: input.campaign.id,
      adPoolItemId: input.adPoolItem.id,
      advertiserName: input.advertiserName,
      campaignName: input.campaign.name,
      productServiceSummary: input.adPoolItem.productServiceSummary,
      mustIncludeAttributes: input.adPoolItem.mustIncludeAttributes,
      allowedInteractionTemplates: input.adPoolItem.allowedInteractionTemplates,
      cta: input.adPoolItem.landingDeepLinkAction,
      policyHash: input.compiledPolicy.policyHash
    }),
    variants
  });
}

export function selectPreparedCreativeVariant(input: {
  creativeSet?: PreparedSponsoredCreativeSet;
  interactionType: InteractionType;
}): PreparedSponsoredCreativeVariant | null {
  const parsed = preparedSponsoredCreativeSetSchema.safeParse(input.creativeSet);

  if (!parsed.success) {
    return null;
  }

  return parsed.data.variants.find((variant) =>
    variant.interactionType === input.interactionType
  ) ?? parsed.data.variants[0] ?? null;
}

function prepareCreativeVariant(input: {
  interactionType: InteractionType;
  primarySignal: string;
  campaign: Campaign;
  adPoolItem: AdPoolItem;
  advertiserName: string;
}): PreparedSponsoredCreativeVariant {
  const interactionSpec = buildPreparedInteractionSpec({
    interactionType: input.interactionType,
    primarySignal: input.primarySignal,
    adPoolItem: input.adPoolItem
  });
  const resultSpec = buildPreparedResultSpec({
    interactionSpec,
    adPoolItem: input.adPoolItem
  });
  const headline = buildPreparedHeadline({
    interactionType: input.interactionType,
    campaignName: input.campaign.name,
    primarySignal: input.primarySignal
  });
  const body = [
    buildPreparedBodyLead(input.interactionType, input.adPoolItem.productServiceSummary),
    `Includes ${input.adPoolItem.mustIncludeAttributes.join("; ")}.`
  ].join(" ");

  return preparedSponsoredCreativeVariantSchema.parse({
    interactionType: input.interactionType,
    headline,
    body,
    interactionSpec,
    visualSpec: {
      renderer: "scripted_graphic_v1",
      theme: toGraphicTheme(input.primarySignal),
      layout: layoutForInteraction(input.interactionType),
      accentColor: accentForSignal(input.primarySignal),
      headlineAnchor: input.campaign.name,
      cards: buildPreparedCards(input.adPoolItem, input.interactionType),
      interactionPreview: {
        type: interactionSpec.type,
        prompt: interactionSpec.prompt,
        options: interactionSpec.allowedOutputs
      },
      preparedCreative: {
        source: "ad_submission_precompute",
        advertiserName: input.advertiserName,
        interactionType: input.interactionType,
        resultSpec
      }
    },
    resultSpec
  });
}

function buildPreparedInteractionSpec(input: {
  interactionType: InteractionType;
  primarySignal: string;
  adPoolItem: AdPoolItem;
}): SponsoredInterstitial["interactionSpec"] {
  if (input.interactionType === "slider") {
    return {
      type: "slider",
      prompt: sliderPrompt(input.primarySignal),
      allowedOutputs: ["0", "5", "10", "15", "20"]
    };
  }

  if (input.interactionType === "short_text") {
    return {
      type: "short_text",
      prompt: shortTextPrompt(input.primarySignal),
      allowedOutputs: ["one-line-goal"]
    };
  }

  return {
    type: "choice",
    prompt: choicePrompt(input.primarySignal),
    allowedOutputs: choiceOptions(input.primarySignal, input.adPoolItem)
  };
}

function buildPreparedResultSpec(input: {
  interactionSpec: SponsoredInterstitial["interactionSpec"];
  adPoolItem: AdPoolItem;
}): PreparedInteractionResultSpec {
  if (input.interactionSpec.type === "slider") {
    return {
      type: "slider",
      minLabel: "Light touch",
      maxLabel: "Full plan",
      bands: [
        {
          min: 0,
          max: 6,
          label: "Light preview",
          detail: `Start with ${input.adPoolItem.mustIncludeAttributes[0]}.`
        },
        {
          min: 7,
          max: 14,
          label: "Balanced plan",
          detail: `Compare ${input.adPoolItem.mustIncludeAttributes.slice(0, 2).join(" and ")}.`
        },
        {
          min: 15,
          max: 20,
          label: "Detailed build",
          detail: `Use all approved attributes: ${input.adPoolItem.mustIncludeAttributes.slice(0, 3).join(", ")}.`
        }
      ]
    };
  }

  if (input.interactionSpec.type === "short_text") {
    return {
      type: "short_text",
      placeholder: input.interactionSpec.prompt,
      resultTitle: "Drafted sponsored brief",
      resultTemplate: `We will shape "{value}" around ${input.adPoolItem.mustIncludeAttributes.slice(0, 2).join(" and ")}.`,
      examples: input.adPoolItem.mustIncludeAttributes.slice(0, 3)
    };
  }

  return {
    type: "choice",
    outcomes: input.interactionSpec.allowedOutputs.map((option, index) => ({
      value: option,
      title: `${option} path`,
      detail: `Prepared result ${index + 1}: ${input.adPoolItem.mustIncludeAttributes[index % input.adPoolItem.mustIncludeAttributes.length]}.`,
      highlight: input.adPoolItem.mustIncludeAttributes[index % input.adPoolItem.mustIncludeAttributes.length]
    }))
  };
}

function inferPrimarySignal(input: {
  adPoolItem: AdPoolItem;
  compiledPolicy: CompiledTargetPolicy;
}): string {
  const astSignals = Array.isArray(input.compiledPolicy.ast.requiredContextSignals)
    ? input.compiledPolicy.ast.requiredContextSignals
    : [];
  const firstAstSignal = astSignals.find((signal): signal is string => typeof signal === "string" && signal.trim().length > 0);

  if (firstAstSignal) {
    return firstAstSignal;
  }

  const text = [
    input.adPoolItem.objective,
    input.adPoolItem.productServiceSummary,
    ...input.adPoolItem.mustIncludeAttributes
  ].join(" ").toLowerCase();

  if (text.includes("travel") || text.includes("weekend")) {
    return "travel";
  }

  if (text.includes("workflow") || text.includes("automation")) {
    return "productivity";
  }

  if (text.includes("course") || text.includes("skill") || text.includes("learning")) {
    return "learning";
  }

  return "general";
}

function choicePrompt(primarySignal: string): string {
  if (primarySignal === "travel") {
    return "Pick a trip style";
  }

  return "Choose the result to preview";
}

function choiceOptions(primarySignal: string, adPoolItem: AdPoolItem): string[] {
  const optionsBySignal: Record<string, string[]> = {
    travel: ["Food", "Nature", "Culture"],
    productivity: ["Automate handoffs", "Compare tools", "Save meeting time"],
    learning: ["Career switch", "Promotion track", "Skill refresh"],
    finance_ops: ["Close checklist", "Invoice matching", "Exception review"],
    home_energy: ["Utility bill", "Thermostat", "Solar readiness"],
    creator_tools: ["Launch plan", "Media kit", "Content calendar"]
  };

  if (optionsBySignal[primarySignal]) {
    return optionsBySignal[primarySignal];
  }

  return adPoolItem.mustIncludeAttributes.slice(0, 3).map((attribute) =>
    attribute.length > 26 ? attribute.slice(0, 23).trimEnd() : attribute
  );
}

function sliderPrompt(primarySignal: string): string {
  if (primarySignal === "productivity") {
    return "Estimate how many team hours you want to save each week";
  }

  if (primarySignal === "home_energy") {
    return "Choose how much effort you want to put into this plan";
  }

  return "Choose the level of support you want";
}

function shortTextPrompt(primarySignal: string): string {
  if (primarySignal === "learning") {
    return "Name one skill goal for this quarter";
  }

  return "Name the outcome you want";
}

function buildPreparedHeadline(input: {
  interactionType: InteractionType;
  campaignName: string;
  primarySignal: string;
}): string {
  const suffixByType: Record<InteractionType, string> = {
    choice: "Choose a sponsored path before the answer",
    slider: "Tune the sponsored plan before the answer",
    short_text: "Draft a sponsored brief before the answer"
  };

  return `${input.campaignName}: ${suffixByType[input.interactionType]}`;
}

function buildPreparedBodyLead(interactionType: InteractionType, productServiceSummary: string): string {
  const introByType: Record<InteractionType, string> = {
    choice: "This sponsored message is prepared with selectable result paths.",
    slider: "This sponsored message is prepared with a visual range preview.",
    short_text: "This sponsored message is prepared to turn a short input into a compact brief."
  };

  return `${introByType[interactionType]} ${productServiceSummary}`;
}

function buildPreparedCards(adPoolItem: AdPoolItem, interactionType: InteractionType) {
  return adPoolItem.mustIncludeAttributes.map((attribute, index) => ({
    title: attribute,
    detail: cardDetail(interactionType, index)
  }));
}

function cardDetail(interactionType: InteractionType, index: number): string {
  const detailByType: Record<InteractionType, string[]> = {
    choice: [
      "Connected to the selected result path.",
      "Shown as an approved sponsored attribute.",
      "Kept separate from the service answer."
    ],
    slider: [
      "Mapped to the selected intensity band.",
      "Updates the sponsored preview only.",
      "Used for attention proof, not answer generation."
    ],
    short_text: [
      "Used as a sponsored brief ingredient.",
      "Stays inside the ad interaction state.",
      "Never sent to the service answer model."
    ]
  };

  const details = detailByType[interactionType];
  return details[index % details.length];
}

function layoutForInteraction(interactionType: InteractionType): string {
  if (interactionType === "slider") {
    return "slider-meter";
  }

  if (interactionType === "short_text") {
    return "brief-builder";
  }

  return "choice-outcome";
}

function toGraphicTheme(signal: string): string {
  if (["travel", "productivity", "learning"].includes(signal)) {
    return signal;
  }

  return "general";
}

function accentForSignal(signal: string): string {
  const accentBySignal: Record<string, string> = {
    travel: "#0F766E",
    productivity: "#2563EB",
    learning: "#7C3AED",
    finance_ops: "#0F766E",
    home_energy: "#15803D",
    creator_tools: "#6D28D9",
    general: "#374151"
  };

  return accentBySignal[signal] ?? accentBySignal.general;
}

function stableFingerprint(value: unknown): string {
  const input = stableStringify(value);
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(index);
    hash >>>= 0;
  }

  return `prepared_${hash.toString(16).padStart(8, "0")}_${input.length.toString(16)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${stableStringify(record[key])}`
  ).join(",")}}`;
}
