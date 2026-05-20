import { z } from "zod";
import {
  preparedSponsoredCreativeSetSchema,
  type PreparedSponsoredCreativeSet
} from "./prepared-creatives";

export const demoInteractionTemplateSchema = z.enum(["choice", "slider", "short_text"]);

export type DemoInteractionTemplate = z.infer<typeof demoInteractionTemplateSchema>;

export type DemoPresetDraft = {
  id: string;
  navigationLabel: string;
  advertiserName: string;
  campaignName: string;
  objective: string;
  productServiceSummary: string;
  naturalLanguageTargetPolicy: string;
  mustIncludeAttributes: string[];
  prohibitedClaims: string[];
  creativeConstraints?: string[];
  allowedInteractionTemplates: DemoInteractionTemplate[];
  ctaLabel: string;
  ctaTarget: string;
  userQuestion?: string;
  currentNeedSummary?: string;
  intentTags?: string[];
  followUpQuestion?: string;
  preparedCreativeSet?: PreparedSponsoredCreativeSet;
};

export const RESERVED_DEMO_PRESET_IDS = [
  "travel",
  "productivity",
  "learning",
  "finance_ops",
  "home_energy",
  "creator_tools"
] as const;
export const RESERVED_DEMO_PRESET_CAMPAIGN_NAMES = [
  "Atlas Local Weekends",
  "FlowPilot Teams",
  "SkillForge Career Paths",
  "LedgerWise Close Assist",
  "VoltNest Home Energy",
  "CanvasKit Creator Studio"
] as const;

const RESERVED_DEMO_PRESET_ID_SET = new Set<string>(RESERVED_DEMO_PRESET_IDS);
const RESERVED_DEMO_PRESET_CAMPAIGN_NAME_SET = new Set<string>(
  RESERVED_DEMO_PRESET_CAMPAIGN_NAMES.map((campaignName) =>
    normalizeDemoPresetCampaignName(campaignName)
  )
);

export const demoPresetDraftSchema: z.ZodType<DemoPresetDraft> = z.object({
  id: z.string().min(1).refine((id) => !isReservedDemoPresetId(id), {
    message: "Custom preset id is reserved by a system preset."
  }),
  navigationLabel: z.string().min(1),
  advertiserName: z.string().min(1),
  campaignName: z.string().min(1).refine((campaignName) =>
    !isReservedDemoPresetCampaignName(campaignName), {
      message: "Custom preset campaign name is already used by a system preset."
    }
  ),
  objective: z.string().min(1),
  productServiceSummary: z.string().min(1),
  naturalLanguageTargetPolicy: z.string().min(1),
  mustIncludeAttributes: z.array(z.string().min(1)).min(1),
  prohibitedClaims: z.array(z.string().min(1)),
  creativeConstraints: z.array(z.string().min(1)).optional(),
  allowedInteractionTemplates: z.array(demoInteractionTemplateSchema).min(1),
  ctaLabel: z.string().min(1),
  ctaTarget: z.string().min(1),
  userQuestion: z.string().min(1).optional(),
  currentNeedSummary: z.string().min(1).optional(),
  intentTags: z.array(z.string().min(1)).optional(),
  followUpQuestion: z.string().min(1).optional(),
  preparedCreativeSet: preparedSponsoredCreativeSetSchema.optional()
}).strict();

export function normalizeDemoPresetId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  return normalized || "custom_preset";
}

export function isReservedDemoPresetId(value: string): boolean {
  return RESERVED_DEMO_PRESET_ID_SET.has(normalizeDemoPresetId(value));
}

export function normalizeDemoPresetCampaignName(value: string): string {
  const words = value.toLowerCase().match(/[a-z0-9]+/g) ?? [];

  return words
    .map((word) => {
      if (word.length > 4 && word.endsWith("ies")) {
        return `${word.slice(0, -3)}y`;
      }

      if (
        word.length > 4 &&
        word.endsWith("s") &&
        !word.endsWith("ss") &&
        !word.endsWith("us") &&
        !word.endsWith("as")
      ) {
        return word.slice(0, -1);
      }

      return word;
    })
    .join("_");
}

export function isReservedDemoPresetCampaignName(value: string): boolean {
  return RESERVED_DEMO_PRESET_CAMPAIGN_NAME_SET.has(
    normalizeDemoPresetCampaignName(value)
  );
}

export function hasSameDemoPresetCampaignName(
  left: Pick<DemoPresetDraft, "campaignName">,
  right: Pick<DemoPresetDraft, "campaignName">
): boolean {
  const leftName = normalizeDemoPresetCampaignName(left.campaignName);
  const rightName = normalizeDemoPresetCampaignName(right.campaignName);

  return Boolean(leftName) && leftName === rightName;
}

export function sanitizeDemoPresetDrafts(value: unknown): DemoPresetDraft[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped: DemoPresetDraft[] = [];

  for (const item of value) {
    const preset = coerceDemoPresetDraft(item);

    if (
      preset &&
      !isReservedDemoPresetId(preset.id) &&
      !isReservedDemoPresetCampaignName(preset.campaignName)
    ) {
      const existingIndex = deduped.findIndex((candidate) =>
        candidate.id === preset.id || hasSameDemoPresetCampaignName(candidate, preset)
      );

      if (existingIndex >= 0) {
        deduped.splice(existingIndex, 1);
      }

      deduped.push(preset);
    }
  }

  return deduped;
}

export function coerceDemoPresetDraft(value: unknown): DemoPresetDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readRequiredString(record.id);
  const navigationLabel = readRequiredString(record.navigationLabel);
  const advertiserName = readRequiredString(record.advertiserName);
  const campaignName = readRequiredString(record.campaignName);
  const objective = readRequiredString(record.objective);
  const productServiceSummary = readRequiredString(record.productServiceSummary);
  const naturalLanguageTargetPolicy = readRequiredString(record.naturalLanguageTargetPolicy);
  const mustIncludeAttributes = readStringList(record.mustIncludeAttributes);
  const allowedInteractionTemplates = readInteractionTemplates(
    record.allowedInteractionTemplates ?? record.allowedInteractionTemplate
  );
  const ctaLabel = readRequiredString(record.ctaLabel);
  const ctaTarget = readRequiredString(record.ctaTarget);

  if (
    !id ||
    !navigationLabel ||
    !advertiserName ||
    !campaignName ||
    !objective ||
    !productServiceSummary ||
    !naturalLanguageTargetPolicy ||
    mustIncludeAttributes.length === 0 ||
    allowedInteractionTemplates.length === 0 ||
    !ctaLabel ||
    !ctaTarget
  ) {
    return null;
  }

  const normalizedId = normalizeDemoPresetId(id);
  if (isReservedDemoPresetId(normalizedId) || isReservedDemoPresetCampaignName(campaignName)) {
    return null;
  }

  const maybePreset: DemoPresetDraft = {
    id: normalizedId,
    navigationLabel,
    advertiserName,
    campaignName,
    objective,
    productServiceSummary,
    naturalLanguageTargetPolicy,
    mustIncludeAttributes,
    prohibitedClaims: readStringList(record.prohibitedClaims),
    allowedInteractionTemplates,
    ctaLabel,
    ctaTarget
  };
  const creativeConstraints = readStringList(record.creativeConstraints);
  const userQuestion = readRequiredString(record.userQuestion);
  const currentNeedSummary = readRequiredString(record.currentNeedSummary);
  const intentTags = readStringList(record.intentTags);
  const followUpQuestion = readRequiredString(record.followUpQuestion);
  const preparedCreativeSet = preparedSponsoredCreativeSetSchema.safeParse(record.preparedCreativeSet);

  if (creativeConstraints.length > 0) {
    maybePreset.creativeConstraints = creativeConstraints;
  }

  if (userQuestion) {
    maybePreset.userQuestion = userQuestion;
  }

  if (currentNeedSummary) {
    maybePreset.currentNeedSummary = currentNeedSummary;
  }

  if (intentTags.length > 0) {
    maybePreset.intentTags = intentTags;
  }

  if (followUpQuestion) {
    maybePreset.followUpQuestion = followUpQuestion;
  }

  if (preparedCreativeSet.success) {
    maybePreset.preparedCreativeSet = preparedCreativeSet.data;
  }

  const parsed = demoPresetDraftSchema.safeParse(maybePreset);
  return parsed.success ? parsed.data : null;
}

function readRequiredString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => readRequiredString(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function readInteractionTemplates(value: unknown): DemoInteractionTemplate[] {
  const values = Array.isArray(value) ? value : [value];
  const parsed = values
    .map((item) => demoInteractionTemplateSchema.safeParse(item))
    .filter((item): item is z.ZodSafeParseSuccess<DemoInteractionTemplate> => item.success)
    .map((item) => item.data);

  return [...new Set(parsed)];
}
