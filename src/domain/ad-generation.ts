import { containsForbiddenAdvertiserData } from "./boundaries";
import { type AdOpportunity } from "./matching";
import {
  type AdPoolItem,
  type CompiledTargetPolicy,
  type SponsoredInterstitial,
  hashStableJson,
  sponsoredInterstitialSchema
} from "./schemas";
import {
  selectPreparedCreativeVariant,
  type PreparedSponsoredCreativeVariant
} from "./prepared-creatives";

export type ScriptedGraphicSpec = {
  renderer: "scripted_graphic_v1";
  theme: "travel" | "productivity" | "learning" | "general";
  layout: "three-card-itinerary" | "metric-comparison" | "learning-path" | "attribute-stack";
  accentColor: string;
  headlineAnchor: string;
  cards: Array<{
    title: string;
    detail: string;
  }>;
  interactionPreview: {
    type: SponsoredInterstitial["interactionSpec"]["type"];
    prompt: string;
    options: string[];
  };
};

export type PolicyGuardResult = {
  approved: boolean;
  violations: string[];
};

export type ClaimSetValidation = {
  valid: boolean;
  missingMustIncludeAttributes: string[];
  prohibitedClaimHits: string[];
};

export function generateInteractiveSponsoredInterstitial(input: {
  opportunity: AdOpportunity;
  interstitialId: string;
  generatedAt: string;
}): SponsoredInterstitial {
  const adPoolItem = input.opportunity.adPoolItem;
  const preparedCreative = selectPreparedCreativeVariant({
    creativeSet: input.opportunity.preparedCreativeSet,
    interactionType: input.opportunity.selectedInteractionTemplate
  });
  const fallbackInteractionSpec = createMicroInteractionTemplate(input.opportunity);
  const interactionSpec = preparedCreative?.interactionSpec ?? fallbackInteractionSpec;
  const visualSpec = preparedCreative?.visualSpec ??
    createScriptedGraphicSpec(input.opportunity, interactionSpec);
  const primarySignal = input.opportunity.matchedSignals[0] ?? "general";
  const headline = preparedCreative?.headline ?? buildHeadline(input.opportunity, primarySignal);
  const body = preparedCreative?.body ?? [
    `${adPoolItem.productServiceSummary}`,
    `Includes ${adPoolItem.mustIncludeAttributes.join("; ")}.`
  ].join(" ");

  const interstitial = sponsoredInterstitialSchema.parse({
    id: input.interstitialId,
    campaignId: input.opportunity.campaign.id,
    adPoolItemId: adPoolItem.id,
    advertiserName: input.opportunity.advertiserName,
    label: "Sponsored",
    headline,
    body,
    visualSpec: withPreparedResultSpec(visualSpec, preparedCreative),
    interactionSpec,
    cta: adPoolItem.landingDeepLinkAction,
    disclosure: {
      whyShown: buildWhyShown(input.opportunity),
      dataBoundary: "The advertiser does not receive your raw conversation, profile, or direct identifier."
    },
    sponsoredMetadata: {
      campaignId: input.opportunity.campaign.id,
      policyHash: input.opportunity.compiledPolicy.policyHash,
      generatedAt: input.generatedAt
    },
    createdAt: input.generatedAt
  });

  const guardResult = guardSponsoredInterstitial({
    interstitial,
    adPoolItem,
    compiledPolicy: input.opportunity.compiledPolicy
  });

  if (!guardResult.approved) {
    throw new Error(`Sponsored interstitial blocked by policy guard: ${guardResult.violations.join(", ")}`);
  }

  return interstitial;
}

function withPreparedResultSpec(
  visualSpec: Record<string, unknown>,
  preparedCreative: PreparedSponsoredCreativeVariant | null
): Record<string, unknown> {
  if (!preparedCreative) {
    return visualSpec;
  }

  return {
    ...visualSpec,
    preparedCreative: {
      ...(typeof visualSpec.preparedCreative === "object" && visualSpec.preparedCreative
        ? visualSpec.preparedCreative as Record<string, unknown>
        : {}),
      interactionType: preparedCreative.interactionType,
      resultSpec: preparedCreative.resultSpec
    }
  };
}

export function createMicroInteractionTemplate(
  opportunity: AdOpportunity
): SponsoredInterstitial["interactionSpec"] {
  const templateType = opportunity.selectedInteractionTemplate;
  const primarySignal = opportunity.matchedSignals[0] ?? "general";

  if (templateType === "slider") {
    return {
      type: "slider",
      prompt: primarySignal === "productivity"
        ? "Estimate how many team hours you want to save each week"
        : "Choose the level of support you want",
      allowedOutputs: ["0", "5", "10", "15", "20"]
    };
  }

  if (templateType === "short_text") {
    return {
      type: "short_text",
      prompt: primarySignal === "learning"
        ? "Name one skill goal for this quarter"
        : "Name the outcome you want",
      allowedOutputs: ["one-line-goal"]
    };
  }

  const optionsBySignal: Record<string, string[]> = {
    travel: ["Food", "Nature", "Culture"],
    productivity: ["Automate handoffs", "Compare tools", "Save meeting time"],
    learning: ["Career switch", "Promotion track", "Skill refresh"],
    finance_ops: ["Close checklist", "Invoice matching", "Exception review"],
    home_energy: ["Utility bill", "Thermostat", "Solar readiness"],
    creator_tools: ["Launch plan", "Media kit", "Content calendar"],
    general: ["Compare", "Personalize", "Continue"]
  };

  return {
    type: "choice",
    prompt: primarySignal === "travel" ? "Pick a trip style" : "Choose what to personalize",
    allowedOutputs: optionsBySignal[primarySignal] ?? optionsBySignal.general
  };
}

export function createScriptedGraphicSpec(
  opportunity: AdOpportunity,
  interactionSpec: SponsoredInterstitial["interactionSpec"]
): ScriptedGraphicSpec {
  const theme = toGraphicTheme(opportunity.matchedSignals[0]);
  const layoutByTheme: Record<ScriptedGraphicSpec["theme"], ScriptedGraphicSpec["layout"]> = {
    travel: "three-card-itinerary",
    productivity: "metric-comparison",
    learning: "learning-path",
    general: "attribute-stack"
  };
  const accentByTheme: Record<ScriptedGraphicSpec["theme"], string> = {
    travel: "#0F766E",
    productivity: "#2563EB",
    learning: "#7C3AED",
    general: "#374151"
  };

  return {
    renderer: "scripted_graphic_v1",
    theme,
    layout: layoutByTheme[theme],
    accentColor: accentByTheme[theme],
    headlineAnchor: opportunity.campaign.name,
    cards: opportunity.adPoolItem.mustIncludeAttributes.map((attribute, index) => ({
      title: attribute,
      detail: buildCardDetail(theme, index)
    })),
    interactionPreview: {
      type: interactionSpec.type,
      prompt: interactionSpec.prompt,
      options: interactionSpec.allowedOutputs
    }
  };
}

export function validateApprovedClaimSet(input: {
  interstitial: SponsoredInterstitial;
  adPoolItem: AdPoolItem;
}): ClaimSetValidation {
  const serializedInterstitial = JSON.stringify({
    headline: input.interstitial.headline,
    body: input.interstitial.body,
    visualSpec: input.interstitial.visualSpec,
    cta: input.interstitial.cta
  }).toLowerCase();
  const missingMustIncludeAttributes = input.adPoolItem.mustIncludeAttributes.filter((attribute) =>
    !serializedInterstitial.includes(attribute.toLowerCase())
  );
  const prohibitedClaimHits = input.adPoolItem.prohibitedClaims.filter((claim) =>
    serializedInterstitial.includes(claim.toLowerCase())
  );

  return {
    valid: missingMustIncludeAttributes.length === 0 && prohibitedClaimHits.length === 0,
    missingMustIncludeAttributes,
    prohibitedClaimHits
  };
}

export function guardSponsoredInterstitial(input: {
  interstitial: SponsoredInterstitial;
  adPoolItem: AdPoolItem;
  compiledPolicy: CompiledTargetPolicy;
}): PolicyGuardResult {
  const interstitial = sponsoredInterstitialSchema.parse(input.interstitial);
  const violations: string[] = [];
  const claimValidation = validateApprovedClaimSet({
    interstitial,
    adPoolItem: input.adPoolItem
  });

  if (input.adPoolItem.reviewStatus !== "approved") {
    violations.push("ad pool item is not approved");
  }

  if (input.compiledPolicy.safetyVerdict !== "approved") {
    violations.push("compiled policy is not approved");
  }

  if (interstitial.label !== "Sponsored") {
    violations.push("sponsored label is missing");
  }

  if (interstitial.campaignId !== input.adPoolItem.campaignId) {
    violations.push("interstitial campaign does not match ad pool item");
  }

  if (interstitial.sponsoredMetadata.policyHash !== input.compiledPolicy.policyHash) {
    violations.push("interstitial policy hash does not match compiled policy");
  }

  if (containsForbiddenAdvertiserData(interstitial)) {
    violations.push("interstitial contains advertiser-forbidden personal data key");
  }

  if (!claimValidation.valid) {
    if (claimValidation.missingMustIncludeAttributes.length > 0) {
      violations.push(`missing must-include attributes: ${claimValidation.missingMustIncludeAttributes.join(", ")}`);
    }

    if (claimValidation.prohibitedClaimHits.length > 0) {
      violations.push(`prohibited claims present: ${claimValidation.prohibitedClaimHits.join(", ")}`);
    }
  }

  return {
    approved: violations.length === 0,
    violations
  };
}

export function buildInterstitialStateHash(interstitial: SponsoredInterstitial): string {
  return hashStableJson({
    id: interstitial.id,
    campaignId: interstitial.campaignId,
    headline: interstitial.headline,
    body: interstitial.body,
    visualSpec: interstitial.visualSpec,
    interactionSpec: interstitial.interactionSpec,
    cta: interstitial.cta,
    sponsoredMetadata: interstitial.sponsoredMetadata
  });
}

function buildHeadline(opportunity: AdOpportunity, primarySignal: string): string {
  const headlineBySignal: Record<string, string> = {
    travel: "Shape this trip idea into a budget-aware local plan",
    productivity: "Preview the workflow savings behind this task",
    learning: "Turn this goal into a focused upskilling path",
    finance_ops: "Turn this finance workflow into a close-ready checklist",
    home_energy: "Map this energy question into practical savings steps",
    creator_tools: "Shape this creator plan into a sponsor-ready launch",
    general: "Explore a sponsored option matched to this request"
  };

  return `${opportunity.campaign.name}: ${headlineBySignal[primarySignal] ?? headlineBySignal.general}`;
}

function buildWhyShown(opportunity: AdOpportunity): string {
  const signals = opportunity.matchedSignals.length > 0
    ? opportunity.matchedSignals.join(", ")
    : "retrieval-safe context";

  return `Shown because the platform matched this campaign to ${signals} in your current request. ${opportunity.whyMatched}`;
}

function toGraphicTheme(signal: string | undefined): ScriptedGraphicSpec["theme"] {
  if (signal === "travel" || signal === "productivity" || signal === "learning") {
    return signal;
  }

  return "general";
}

function buildCardDetail(theme: ScriptedGraphicSpec["theme"], index: number): string {
  const details: Record<ScriptedGraphicSpec["theme"], string[]> = {
    travel: [
      "Used as a planning anchor for the suggested route.",
      "Updates as the trip style changes.",
      "Kept separate from the service answer."
    ],
    productivity: [
      "Shown as a workflow lever, not a factual service answer.",
      "Can be compared against time-saved preferences.",
      "Used only inside the sponsored interaction."
    ],
    learning: [
      "Mapped to a skill path preview.",
      "Adjusted from the learner's stated goal.",
      "Kept within the advertiser-approved claim set."
    ],
    general: [
      "Included from the approved campaign brief.",
      "Rendered inside the sponsored frame.",
      "Does not modify the service answer."
    ]
  };

  return details[theme][index % details[theme].length];
}
