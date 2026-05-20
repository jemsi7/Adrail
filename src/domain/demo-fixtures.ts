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
import {
  normalizeDemoPresetId,
  sanitizeDemoPresetDrafts,
  type DemoPresetDraft
} from "./demo-presets";
import {
  preparedSponsoredCreativeSetSchema,
  prepareSponsoredCreativeSet,
  type PreparedSponsoredCreativeSet
} from "./prepared-creatives";

export type DefaultDemoAdPresetId =
  | "travel"
  | "productivity"
  | "learning"
  | "finance_ops"
  | "home_energy"
  | "creator_tools";
export type DemoAdTheme = string;

export type { DemoPresetDraft };

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
  const sanitizedCustomPresets = sanitizeDemoPresetDrafts(customPresets);

  return [
    createTravelFixture(now),
    createProductivityFixture(now),
    createLearningFixture(now),
    createFinanceOpsFixture(now),
    createHomeEnergyFixture(now),
    createCreatorToolsFixture(now),
    ...sanitizedCustomPresets.map((preset) => createCustomDemoFixture(preset, now))
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
  fixture?: Pick<DemoAdThemeFixture, "userQuestion" | "currentNeedSummary" | "intentTags">,
  userQuestion?: string
): IntentContext {
  const finalQuestion = userQuestion?.trim() || fixture?.userQuestion || "";

  if (userQuestion && userQuestion.trim()) {
    const words = userQuestion.toLowerCase().match(/[a-z0-9가-힣]+/g) ?? [];
    const stopWords = new Set(["and", "for", "the", "with", "this", "that", "people", "reach", "can", "you", "help", "please"]);
    const derivedTags = [...new Set(words.filter((word) => word.length >= 2 && !stopWords.has(word)))].slice(0, 8);

    const inferredThemes: string[] = [];
    const normalizedQuestion = userQuestion.toLowerCase();
    if (/\b(travel|trip|itinerary|hotel|local experience|weekend|food|nature|culture|budget)\b/.test(normalizedQuestion)) {
      inferredThemes.push("travel");
    }
    if (/\b(productivity|saas|workflow|team|automation|time saved|pilot|collaboration)\b/.test(normalizedQuestion)) {
      inferredThemes.push("productivity");
    }
    if (/\b(course|learning|upskill|professional|certification|training|forge|operations)\b/.test(normalizedQuestion)) {
      inferredThemes.push("learning");
    }
    if (/\b(finance|invoice|invoices|expense|expenses|close|reconciliation|cash flow|accounts payable|month-end)\b/.test(normalizedQuestion)) {
      inferredThemes.push("finance_ops");
    }
    if (/\b(home energy|energy|electricity|solar|utility|heat pump|thermostat|insulation|bill)\b/.test(normalizedQuestion)) {
      inferredThemes.push("home_energy");
    }
    if (/\b(creator|newsletter|content|video|publish|publishing|audience|sponsor|media kit|brand deal)\b/.test(normalizedQuestion)) {
      inferredThemes.push("creator_tools");
    }

    const finalThemes = inferredThemes.length > 0 ? inferredThemes : [theme];
    const intentTags = [...new Set([...derivedTags, ...finalThemes])];

    return {
      userQuestion: finalQuestion,
      currentNeedSummary: `User is asking: "${finalQuestion}"`,
      intentTags,
      occurredAt: now
    };
  }

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

  if (theme === "finance_ops") {
    return {
      userQuestion: "How can our small team make month-end invoice reconciliation less painful?",
      currentNeedSummary: "User is evaluating finance operations tools for month-end close and invoice reconciliation.",
      intentTags: ["finance_ops", "invoices", "reconciliation"],
      occurredAt: now
    };
  }

  if (theme === "home_energy") {
    return {
      userQuestion: "Can you help me lower my home electricity bill without a full renovation?",
      currentNeedSummary: "User is looking for home energy savings, utility bill analysis, and practical efficiency upgrades.",
      intentTags: ["home_energy", "utility", "efficiency"],
      occurredAt: now
    };
  }

  if (theme === "creator_tools") {
    return {
      userQuestion: "What is a good way to plan a newsletter launch and pitch sponsors?",
      currentNeedSummary: "User is exploring creator tools for publishing, audience growth, and sponsorship workflow.",
      intentTags: ["creator_tools", "newsletter", "sponsorship"],
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

function createFinanceOpsFixture(now: string): DemoAdThemeFixture {
  return buildFixture({
    theme: "finance_ops",
    navigationLabel: "Finance ops",
    advertiserName: "LedgerWise",
    userQuestion: "How can our small team make month-end invoice reconciliation less painful?",
    currentNeedSummary: "User is evaluating finance operations tools for month-end close and invoice reconciliation.",
    intentTags: ["finance_ops", "invoices", "reconciliation"],
    followUpQuestion: "Can the close checklist include invoice matching and exception review without exposing vendor data?",
    campaign: {
      id: "campaign_finance_ops_001",
      advertiserId: "advertiser_ledgerwise",
      name: "LedgerWise Close Assist",
      objective: "Start a privacy-safe finance close workflow inside the agent",
      productServiceSummary: "A finance operations assistant for invoice reconciliation, close checklists, and exception review.",
      status: "approved",
      reviewStatus: "approved",
      budgetCents: 540000,
      remainingBudgetCents: 516000,
      createdAt: now,
      updatedAt: now
    },
    policyText: "Reach small business operators and finance teams researching invoice reconciliation, month-end close, accounts payable workflows, expense review, and cash flow operations.",
    adPoolItem: {
      id: "ad_pool_finance_ops_001",
      campaignId: "campaign_finance_ops_001",
      advertiserId: "advertiser_ledgerwise",
      objective: "Help teams preview an invoice reconciliation workflow.",
      productServiceSummary: "LedgerWise drafts month-end close checklists, invoice matching steps, and exception review queues without exposing raw vendor records to advertisers.",
      mustIncludeAttributes: [
        "Invoice matching checklist",
        "Month-end close workflow",
        "Exception review queue"
      ],
      prohibitedClaims: ["guaranteed tax compliance", "replaces a licensed accountant"],
      creativeConstraints: ["Avoid tax advice claims", "Do not imply access to private vendor data"],
      allowedInteractionTemplates: ["choice", "short_text"],
      landingDeepLinkAction: {
        label: "Draft a close checklist",
        actionType: "agent_deeplink",
        target: "agent://finance/close-checklist"
      },
      reviewStatus: "approved",
      createdAt: now,
      updatedAt: now
    },
    settlementPolicy: createSettlementPolicy("settlement_finance_ops_001", "campaign_finance_ops_001", now)
  });
}

function createHomeEnergyFixture(now: string): DemoAdThemeFixture {
  return buildFixture({
    theme: "home_energy",
    navigationLabel: "Home energy",
    advertiserName: "VoltNest",
    userQuestion: "Can you help me lower my home electricity bill without a full renovation?",
    currentNeedSummary: "User is looking for home energy savings, utility bill analysis, and practical efficiency upgrades.",
    intentTags: ["home_energy", "utility", "efficiency"],
    followUpQuestion: "Can the plan compare utility bill analysis with thermostat and insulation upgrades?",
    campaign: {
      id: "campaign_home_energy_001",
      advertiserId: "advertiser_voltnest",
      name: "VoltNest Home Energy",
      objective: "Start an agent-assisted home energy savings plan",
      productServiceSummary: "Home energy analysis and upgrade planning for utility savings.",
      status: "approved",
      reviewStatus: "approved",
      budgetCents: 460000,
      remainingBudgetCents: 438000,
      createdAt: now,
      updatedAt: now
    },
    policyText: "Reach homeowners and renters comparing home energy savings, electricity bills, solar readiness, thermostat settings, insulation upgrades, and practical efficiency projects.",
    adPoolItem: {
      id: "ad_pool_home_energy_001",
      campaignId: "campaign_home_energy_001",
      advertiserId: "advertiser_voltnest",
      objective: "Invite users to build an energy savings plan.",
      productServiceSummary: "VoltNest turns utility bill patterns into a practical home energy checklist for thermostat, insulation, solar-readiness, and appliance timing decisions.",
      mustIncludeAttributes: [
        "Utility bill pattern review",
        "Thermostat and insulation checklist",
        "Solar-readiness estimate"
      ],
      prohibitedClaims: ["guaranteed bill reduction", "certified energy audit"],
      creativeConstraints: ["Make savings estimates conditional", "Do not imply formal certification"],
      allowedInteractionTemplates: ["slider", "choice"],
      landingDeepLinkAction: {
        label: "Build an energy savings plan",
        actionType: "agent_deeplink",
        target: "agent://home-energy/savings-plan"
      },
      reviewStatus: "approved",
      createdAt: now,
      updatedAt: now
    },
    settlementPolicy: createSettlementPolicy("settlement_home_energy_001", "campaign_home_energy_001", now)
  });
}

function createCreatorToolsFixture(now: string): DemoAdThemeFixture {
  return buildFixture({
    theme: "creator_tools",
    navigationLabel: "Creator tools",
    advertiserName: "CanvasKit",
    userQuestion: "What is a good way to plan a newsletter launch and pitch sponsors?",
    currentNeedSummary: "User is exploring creator tools for publishing, audience growth, and sponsorship workflow.",
    intentTags: ["creator_tools", "newsletter", "sponsorship"],
    followUpQuestion: "Can the launch plan include a content calendar and sponsor media kit?",
    campaign: {
      id: "campaign_creator_tools_001",
      advertiserId: "advertiser_canvaskit",
      name: "CanvasKit Creator Studio",
      objective: "Start an agent-guided creator launch workflow",
      productServiceSummary: "Creator planning tools for newsletter launches, sponsorship pitches, and content calendars.",
      status: "approved",
      reviewStatus: "approved",
      budgetCents: 390000,
      remainingBudgetCents: 371000,
      createdAt: now,
      updatedAt: now
    },
    policyText: "Reach independent creators, newsletter writers, podcasters, and small media teams planning content calendars, audience growth, sponsor pitches, media kits, and publishing workflows.",
    adPoolItem: {
      id: "ad_pool_creator_tools_001",
      campaignId: "campaign_creator_tools_001",
      advertiserId: "advertiser_canvaskit",
      objective: "Help creators draft a launch plan and sponsor-ready workflow.",
      productServiceSummary: "CanvasKit organizes creator launch planning with content calendar templates, sponsor media kit drafts, and publishing workflow checklists.",
      mustIncludeAttributes: [
        "Content calendar templates",
        "Sponsor media kit draft",
        "Publishing workflow checklist"
      ],
      prohibitedClaims: ["guaranteed audience growth", "guaranteed brand deals"],
      creativeConstraints: ["Avoid guaranteed monetization claims", "Do not imply sponsor acceptance"],
      allowedInteractionTemplates: ["choice", "short_text"],
      landingDeepLinkAction: {
        label: "Draft a creator launch plan",
        actionType: "agent_deeplink",
        target: "agent://creator/launch-plan"
      },
      reviewStatus: "approved",
      createdAt: now,
      updatedAt: now
    },
    settlementPolicy: createSettlementPolicy("settlement_creator_tools_001", "campaign_creator_tools_001", now)
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
    settlementPolicy: createSettlementPolicy(`settlement_${presetId}_custom`, campaignId, now),
    preparedCreativeSet: preset.preparedCreativeSet
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
  preparedCreativeSet?: PreparedSponsoredCreativeSet;
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
  const parsedPreparedCreativeSet = preparedSponsoredCreativeSetSchema.safeParse(input.preparedCreativeSet);
  const preparedCreativeSet = parsedPreparedCreativeSet.success &&
    parsedPreparedCreativeSet.data.campaignId === campaign.id &&
    parsedPreparedCreativeSet.data.adPoolItemId === adPoolItem.id
    ? parsedPreparedCreativeSet.data
    : prepareSponsoredCreativeSet({
    campaign,
    adPoolItem,
    advertiserName: input.advertiserName,
    compiledPolicy,
    preparedAt: campaign.createdAt
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
    preparedCreativeSet,
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
  return normalizeDemoPresetId(value);
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
