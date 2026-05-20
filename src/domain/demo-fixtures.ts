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

export type DemoAdTheme = "travel" | "productivity" | "learning";

export type DemoAdThemeFixture = CampaignAdCandidate & {
  theme: DemoAdTheme;
  naturalLanguageTargetPolicy: NaturalLanguageTargetPolicy;
};

const DEFAULT_NOW = "2026-05-20T06:30:00.000Z";

export function createDemoAdThemeFixtures(now = DEFAULT_NOW): DemoAdThemeFixture[] {
  return [
    createTravelFixture(now),
    createProductivityFixture(now),
    createLearningFixture(now)
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

export function createIntentContextFixture(theme: DemoAdTheme, now = DEFAULT_NOW): IntentContext {
  const byTheme: Record<DemoAdTheme, IntentContext> = {
    travel: {
      userQuestion: "Can you help me plan a relaxed weekend trip with food and nature nearby?",
      currentNeedSummary: "User is planning a budget-aware local weekend travel experience.",
      intentTags: ["travel", "weekend", "local experience"],
      occurredAt: now
    },
    productivity: {
      userQuestion: "How can my team save time on repeated workflow handoffs?",
      currentNeedSummary: "User is comparing workflow automation and productivity tools.",
      intentTags: ["productivity", "workflow", "automation"],
      occurredAt: now
    },
    learning: {
      userQuestion: "What should I learn to move into a product operations role?",
      currentNeedSummary: "User is exploring online learning and professional upskilling.",
      intentTags: ["learning", "upskill", "professional"],
      occurredAt: now
    }
  };

  return byTheme[theme];
}

function createTravelFixture(now: string): DemoAdThemeFixture {
  return buildFixture({
    theme: "travel",
    advertiserName: "Atlas Local",
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
    advertiserName: "FlowPilot",
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
    advertiserName: "SkillForge",
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

function buildFixture(input: {
  theme: DemoAdTheme;
  advertiserName: string;
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
    advertiserName: input.advertiserName,
    campaign,
    naturalLanguageTargetPolicy,
    compiledPolicy,
    adPoolItem,
    settlementPolicy: input.settlementPolicy
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
