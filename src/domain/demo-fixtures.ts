import { compileNaturalLanguageTargetPolicy } from "./policy";
import {
  type AdPoolItem,
  type Campaign,
  type DynamicSettlementPolicy,
  type EligibilityToken,
  type NaturalLanguageTargetPolicy,
  adPoolItemSchema,
  campaignSchema,
  dynamicSettlementPolicySchema,
  hashStableJson,
  naturalLanguageTargetPolicySchema
} from "./schemas";
import { type CampaignAdCandidate, type IntentContext } from "./matching";

export type DefaultDemoAdPresetId = "travel" | "productivity" | "learning";
export type DemoAdTheme = string;

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
  allowedInteractionTemplates: Array<"choice" | "slider" | "short_text">;
  ctaLabel: string;
  ctaTarget: string;
  userQuestion?: string;
  currentNeedSummary?: string;
  intentTags?: string[];
  followUpQuestion?: string;
};

export type DemoAdThemeFixture = CampaignAdCandidate & {
  theme: DemoAdTheme;
  navigationLabel: string;
  naturalLanguageTargetPolicy: NaturalLanguageTargetPolicy;
  userQuestion: string;
  currentNeedSummary: string;
  intentTags: string[];
  followUpQuestion?: string;
};

const DEFAULT_NOW = "2026-05-20T06:30:00.000Z";

export function createDemoAdThemeFixtures(
  now = DEFAULT_NOW,
  customPresets: DemoPresetDraft[] = []
): DemoAdThemeFixture[] {
  return [
    createTravelFixture(now),
    createProductivityFixture(now),
    createLearningFixture(now),
    ...customPresets.map((preset) => createCustomDemoFixture(preset, now))
  ];
}

export function createEligibilityTokenFixture(input: {
  id: string;
  snapshotId: string;
  intentTags: string[];
  preferenceTags?: string[];
  categoryOptOuts?: string[];
  now?: string;
}): EligibilityToken {
  const now = input.now ?? DEFAULT_NOW;

  return {
    id: input.id,
    snapshotId: input.snapshotId,
    intentTags: input.intentTags,
    preferenceTags: input.preferenceTags ?? [],
    categoryOptOuts: input.categoryOptOuts ?? [],
    sensitivityFlags: [],
    tokenHash: hashStableJson({
      id: input.id,
      snapshotId: input.snapshotId,
      intentTags: input.intentTags,
      preferenceTags: input.preferenceTags ?? [],
      categoryOptOuts: input.categoryOptOuts ?? []
    }),
    issuedAt: now,
    expiresAt: "2026-05-21T06:30:00.000Z"
  };
}

export function createIntentContextFixture(
  theme: DemoAdTheme,
  now = DEFAULT_NOW,
  fixture?: Pick<DemoAdThemeFixture, "userQuestion" | "currentNeedSummary" | "intentTags">
): IntentContext {
  if (fixture) {
    return {
      userQuestion: fixture.userQuestion,
      currentNeedSummary: fixture.currentNeedSummary,
      intentTags: fixture.intentTags,
      occurredAt: now
    };
  }

  if (theme === "travel") {
    return {
      userQuestion: "Can you help me plan a relaxed weekend trip with food and nature nearby?",
      currentNeedSummary: "User is planning a budget-aware local weekend travel experience.",
      intentTags: ["travel", "weekend", "local experience"],
      occurredAt: now
    };
  }

  if (theme === "productivity") {
    return {
      userQuestion: "How can my team save time on repeated workflow handoffs?",
      currentNeedSummary: "User is comparing workflow automation and productivity tools.",
      intentTags: ["productivity", "workflow", "automation"],
      occurredAt: now
    };
  }

  if (theme === "learning") {
    return {
      userQuestion: "What should I learn to move into a product operations role?",
      currentNeedSummary: "User is exploring online learning and professional upskilling.",
      intentTags: ["learning", "upskill", "professional"],
      occurredAt: now
    };
  }

  return {
    userQuestion: `Can you help me compare options related to ${theme}?`,
    currentNeedSummary: `User is exploring ${theme} options and wants a useful recommendation.`,
    intentTags: [theme],
    occurredAt: now
  };
}

function createTravelFixture(now: string): DemoAdThemeFixture {
  return buildFixture({
    theme: "travel",
    navigationLabel: "Travel",
    advertiserName: "Atlas Local",
    userQuestion: "Can you help me plan a relaxed weekend trip with food and nature nearby?",
    currentNeedSummary: "User is planning a budget-aware local weekend travel experience.",
    intentTags: ["travel", "weekend", "local experience"],
    followUpQuestion: "Can the weekend itinerary stay budget-aware with food and nature options?",
    campaign: {
      id: "campaign_travel_001",
      advertiserId: "advertiser_atlas",
      name: "Atlas Local Weekends",
      objective: "Drive agent deeplink itinerary planning",
      productServiceSummary: "Curated local weekend experiences for flexible budgets.",
      status: "approved",
      reviewStatus: "approved",
      budgetCents: 500000,
      remainingBudgetCents: 475000,
      createdAt: now,
      updatedAt: now
    },
    policyText: "Reach people currently planning weekend travel, local experiences, itinerary ideas, food, culture, or nature trips.",
    adPoolItem: {
      id: "ad_pool_travel_001",
      campaignId: "campaign_travel_001",
      advertiserId: "advertiser_atlas",
      objective: "Invite users to build an agent-assisted local itinerary.",
      productServiceSummary: "Atlas Local creates flexible local weekend plans around budget, food, nature, and culture preferences.",
      mustIncludeAttributes: [
        "Budget-aware local experiences",
        "Food, nature, and culture options",
        "Agent-built weekend itinerary"
      ],
      prohibitedClaims: ["guaranteed cheapest fares", "medical wellness cure"],
      creativeConstraints: ["Always disclose Sponsored", "Do not imply the service answer is paid"],
      allowedInteractionTemplates: ["choice"],
      landingDeepLinkAction: {
        label: "Build an itinerary with my budget",
        actionType: "agent_deeplink",
        target: "agent://travel/itinerary-budget"
      },
      reviewStatus: "approved",
      createdAt: now,
      updatedAt: now
    },
    settlementPolicy: createSettlementPolicy("settlement_travel_001", "campaign_travel_001", now)
  });
}

function createProductivityFixture(now: string): DemoAdThemeFixture {
  return buildFixture({
    theme: "productivity",
    navigationLabel: "Productivity",
    advertiserName: "FlowPilot",
    userQuestion: "How can my team save time on repeated workflow handoffs?",
    currentNeedSummary: "User is comparing workflow automation and productivity tools.",
    intentTags: ["productivity", "workflow", "automation"],
    followUpQuestion: "Can this compare workflow automation templates with a security review checklist?",
    campaign: {
      id: "campaign_productivity_001",
      advertiserId: "advertiser_flowpilot",
      name: "FlowPilot Teams",
      objective: "Start workflow automation comparisons inside the agent",
      productServiceSummary: "A SaaS workflow assistant for repeated team handoffs.",
      status: "approved",
      reviewStatus: "approved",
      budgetCents: 650000,
      remainingBudgetCents: 610000,
      createdAt: now,
      updatedAt: now
    },
    policyText: "Reach teams comparing productivity SaaS, workflow automation, collaboration tools, and ways to save time on repeated handoffs.",
    adPoolItem: {
      id: "ad_pool_productivity_001",
      campaignId: "campaign_productivity_001",
      advertiserId: "advertiser_flowpilot",
      objective: "Help teams compare workflow automation options.",
      productServiceSummary: "FlowPilot previews automation patterns for recurring approvals, handoffs, and team status updates.",
      mustIncludeAttributes: [
        "Workflow automation templates",
        "Team time-savings estimate",
        "Security review checklist"
      ],
      prohibitedClaims: ["guaranteed 10x productivity", "replaces all employees"],
      creativeConstraints: ["Use comparison language", "Do not promise guaranteed ROI"],
      allowedInteractionTemplates: ["slider", "choice"],
      landingDeepLinkAction: {
        label: "Compare workflow options",
        actionType: "agent_deeplink",
        target: "agent://productivity/workflow-compare"
      },
      reviewStatus: "approved",
      createdAt: now,
      updatedAt: now
    },
    settlementPolicy: createSettlementPolicy("settlement_productivity_001", "campaign_productivity_001", now)
  });
}

function createLearningFixture(now: string): DemoAdThemeFixture {
  return buildFixture({
    theme: "learning",
    navigationLabel: "Learning",
    advertiserName: "SkillForge",
    userQuestion: "What should I learn to move into a product operations role?",
    currentNeedSummary: "User is exploring online learning and professional upskilling.",
    intentTags: ["learning", "upskill", "professional"],
    followUpQuestion: "Can this become a role-based course path with hands-on projects?",
    campaign: {
      id: "campaign_learning_001",
      advertiserId: "advertiser_skillforge",
      name: "SkillForge Career Paths",
      objective: "Start an agent-guided professional upskilling plan",
      productServiceSummary: "Online project-based courses for professional skill growth.",
      status: "approved",
      reviewStatus: "approved",
      budgetCents: 420000,
      remainingBudgetCents: 405000,
      createdAt: now,
      updatedAt: now
    },
    policyText: "Reach people researching online learning, professional upskilling, courses, certifications, training, and role-based career growth.",
    adPoolItem: {
      id: "ad_pool_learning_001",
      campaignId: "campaign_learning_001",
      advertiserId: "advertiser_skillforge",
      objective: "Invite users to draft a role-based learning path.",
      productServiceSummary: "SkillForge turns a career goal into project-based course sequences and weekly progress checkpoints.",
      mustIncludeAttributes: [
        "Role-based course paths",
        "Hands-on project sequence",
        "Certificate-ready progress plan"
      ],
      prohibitedClaims: ["guaranteed job placement", "official university credit"],
      creativeConstraints: ["Do not promise employment", "Make certification language conditional"],
      allowedInteractionTemplates: ["short_text", "choice"],
      landingDeepLinkAction: {
        label: "Draft my learning path",
        actionType: "agent_deeplink",
        target: "agent://learning/path-builder"
      },
      reviewStatus: "approved",
      createdAt: now,
      updatedAt: now
    },
    settlementPolicy: createSettlementPolicy("settlement_learning_001", "campaign_learning_001", now)
  });
}

export function createCustomDemoFixture(
  preset: DemoPresetDraft,
  now = DEFAULT_NOW
): DemoAdThemeFixture {
  const presetId = toPresetId(preset.id);
  const advertiserId = `advertiser_${presetId}`;
  const campaignId = `campaign_${presetId}_custom`;
  const adPoolItemId = `ad_pool_${presetId}_custom`;

  return buildFixture({
    theme: presetId,
    navigationLabel: preset.navigationLabel.trim() || titleCase(presetId),
    advertiserName: preset.advertiserName.trim(),
    userQuestion: preset.userQuestion?.trim() ||
      `Can you help me compare options for ${preset.productServiceSummary.trim()}?`,
    currentNeedSummary: preset.currentNeedSummary?.trim() ||
      `User is considering ${preset.productServiceSummary.trim()} and wants a privacy-safe recommendation.`,
    intentTags: preset.intentTags && preset.intentTags.length > 0
      ? preset.intentTags.map((tag) => tag.trim()).filter(Boolean)
      : inferIntentTags(preset),
    followUpQuestion: preset.followUpQuestion?.trim() ||
      `Can this option preserve the most important attributes: ${preset.mustIncludeAttributes.slice(0, 2).join(" and ")}?`,
    campaign: {
      id: campaignId,
      advertiserId,
      name: preset.campaignName.trim(),
      objective: preset.objective.trim(),
      productServiceSummary: preset.productServiceSummary.trim(),
      status: "approved",
      reviewStatus: "approved",
      budgetCents: 350000,
      remainingBudgetCents: 325000,
      createdAt: now,
      updatedAt: now
    },
    policyText: preset.naturalLanguageTargetPolicy.trim(),
    adPoolItem: {
      id: adPoolItemId,
      campaignId,
      advertiserId,
      objective: preset.objective.trim(),
      productServiceSummary: preset.productServiceSummary.trim(),
      mustIncludeAttributes: preset.mustIncludeAttributes.map((attribute) => attribute.trim()).filter(Boolean),
      prohibitedClaims: preset.prohibitedClaims.map((claim) => claim.trim()).filter(Boolean),
      creativeConstraints: preset.creativeConstraints?.map((constraint) => constraint.trim()).filter(Boolean) ?? [
        "Always disclose Sponsored",
        "Stay within the approved claim set"
      ],
      allowedInteractionTemplates: preset.allowedInteractionTemplates.length > 0
        ? preset.allowedInteractionTemplates
        : ["choice"],
      landingDeepLinkAction: {
        label: preset.ctaLabel.trim(),
        actionType: "agent_deeplink",
        target: preset.ctaTarget.trim()
      },
      reviewStatus: "approved",
      createdAt: now,
      updatedAt: now
    },
    settlementPolicy: createSettlementPolicy(`settlement_${presetId}_custom`, campaignId, now)
  });
}

function buildFixture(input: {
  theme: DemoAdTheme;
  navigationLabel: string;
  advertiserName: string;
  userQuestion: string;
  currentNeedSummary: string;
  intentTags: string[];
  followUpQuestion?: string;
  campaign: Campaign;
  policyText: string;
  adPoolItem: AdPoolItem;
  settlementPolicy: DynamicSettlementPolicy;
}): DemoAdThemeFixture {
  const campaign = campaignSchema.parse(input.campaign);
  const adPoolItem = adPoolItemSchema.parse(input.adPoolItem);
  const naturalLanguageTargetPolicy = naturalLanguageTargetPolicySchema.parse({
    id: `source_policy_${input.theme}_001`,
    campaignId: campaign.id,
    language: "en",
    sourceText: input.policyText,
    submittedByAdvertiserId: campaign.advertiserId,
    createdAt: campaign.createdAt
  });
  const compiledPolicy = compileNaturalLanguageTargetPolicy({
    id: `compiled_policy_${input.theme}_001`,
    campaignId: campaign.id,
    sourcePolicyId: naturalLanguageTargetPolicy.id,
    sourceText: naturalLanguageTargetPolicy.sourceText,
    createdAt: campaign.createdAt
  });

  return {
    theme: input.theme,
    navigationLabel: input.navigationLabel,
    advertiserName: input.advertiserName,
    campaign,
    naturalLanguageTargetPolicy,
    compiledPolicy,
    adPoolItem,
    settlementPolicy: input.settlementPolicy,
    userQuestion: input.userQuestion,
    currentNeedSummary: input.currentNeedSummary,
    intentTags: input.intentTags,
    followUpQuestion: input.followUpQuestion
  };
}

function createSettlementPolicy(
  id: string,
  campaignId: string,
  now: string
): DynamicSettlementPolicy {
  const policyBase = {
    campaignId,
    dwellWeightBps: 2500,
    interactionWeightBps: 2000,
    retentionWeightBps: 3000,
    deepLinkWeightBps: 2500,
    thresholdBps: 6500,
    dwellThresholdSeconds: 2.5,
    version: 1
  };

  return dynamicSettlementPolicySchema.parse({
    id,
    ...policyBase,
    policyHash: hashStableJson(policyBase),
    status: "active",
    createdAt: now
  });
}

function toPresetId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  return normalized || `custom_${hashStableJson(value).slice(0, 8)}`;
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function inferIntentTags(preset: DemoPresetDraft): string[] {
  const text = [
    preset.id,
    preset.navigationLabel,
    preset.objective,
    preset.productServiceSummary,
    preset.naturalLanguageTargetPolicy,
    ...preset.mustIncludeAttributes
  ].join(" ");
  const words = text.toLowerCase().match(/[a-z][a-z0-9-]+/g) ?? [];
  const stopWords = new Set(["and", "for", "the", "with", "this", "that", "people", "reach"]);

  return [...new Set(words.filter((word) => word.length >= 4 && !stopWords.has(word)))].slice(0, 8);
}
