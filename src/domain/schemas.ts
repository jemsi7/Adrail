import { createHash } from "node:crypto";
import { z } from "zod";

export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const idSchema = z.string().min(1);
export const bpsSchema = z.number().int().min(0).max(10000);

export const reviewStatusSchema = z.enum(["draft", "pending_review", "approved", "rejected"]);
export const campaignStatusSchema = z.enum(["draft", "pending_review", "approved", "paused", "rejected", "archived"]);
export const safetyVerdictSchema = z.enum(["approved", "needs_review", "blocked"]);
export const interactionTypeSchema = z.enum(["choice", "slider", "short_text"]);
export const signalTypeSchema = z.enum(["dwell", "realtime_interaction", "context_retention", "deep_link"]);
export const settlementStatusSchema = z.enum(["pending", "submitted", "settled", "rejected"]);
export const advertiserWalletVerificationStatusSchema = z.enum([
  "unconfigured",
  "format_valid",
  "configured_match",
  "mismatch"
]);
export const escrowLedgerEntryTypeSchema = z.enum([
  "deposit",
  "attention_debit",
  "failed_debit",
  "refund"
]);
export const ledgerStatusSchema = z.enum(["pending", "confirmed", "failed"]);
export const weiAmountSchema = z.string().regex(/^(0|[1-9]\d*)$/);

export const landingDeepLinkActionSchema = z.object({
  label: z.string().min(1),
  actionType: z.enum(["agent_deeplink", "external_link"]),
  target: z.string().min(1)
}).strict();

export const campaignSchema = z.object({
  id: idSchema,
  advertiserId: idSchema,
  name: z.string().min(1),
  objective: z.string().min(1),
  productServiceSummary: z.string().min(1),
  status: campaignStatusSchema,
  reviewStatus: reviewStatusSchema,
  budgetCents: z.number().int().nonnegative(),
  remainingBudgetCents: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
}).strict();

export const naturalLanguageTargetPolicySchema = z.object({
  id: idSchema,
  campaignId: idSchema,
  language: z.literal("en"),
  sourceText: z.string().min(1),
  submittedByAdvertiserId: idSchema,
  createdAt: isoDateTimeSchema
}).strict();

export const compiledTargetPolicySchema = z.object({
  id: idSchema,
  campaignId: idSchema,
  sourcePolicyId: idSchema,
  ast: z.record(z.string(), z.unknown()),
  embeddingQueries: z.array(z.string().min(1)),
  prohibitedSensitiveSignals: z.array(z.string().min(1)),
  compiledSummary: z.string().min(1),
  safetyVerdict: safetyVerdictSchema,
  policyHash: z.string().min(16),
  compilerVersion: z.string().min(1),
  createdAt: isoDateTimeSchema
}).strict();

export const adPoolItemSchema = z.object({
  id: idSchema,
  campaignId: idSchema,
  advertiserId: idSchema,
  objective: z.string().min(1),
  productServiceSummary: z.string().min(1),
  mustIncludeAttributes: z.array(z.string().min(1)).min(1),
  prohibitedClaims: z.array(z.string().min(1)),
  creativeConstraints: z.array(z.string().min(1)),
  allowedInteractionTemplates: z.array(interactionTypeSchema).min(1),
  landingDeepLinkAction: landingDeepLinkActionSchema,
  reviewStatus: reviewStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
}).strict();

export const consentSettingsSchema = z.object({
  adPersonalization: z.boolean(),
  categoryOptOuts: z.array(z.string().min(1)),
  updatedAt: isoDateTimeSchema
}).strict();

export const personalIntelligenceSnapshotSchema = z.object({
  id: idSchema,
  userVaultId: idSchema,
  conversationSummary: z.string().min(1),
  explicitPreferences: z.array(z.string().min(1)),
  taskIntents: z.array(z.string().min(1)),
  rejectedAdCategories: z.array(z.string().min(1)),
  consentSettings: consentSettingsSchema,
  matchingFeatures: z.record(z.string(), z.unknown()),
  createdAt: isoDateTimeSchema
}).strict();

export const eligibilityTokenSchema = z.object({
  id: idSchema,
  snapshotId: idSchema,
  intentTags: z.array(z.string().min(1)),
  preferenceTags: z.array(z.string().min(1)),
  categoryOptOuts: z.array(z.string().min(1)),
  sensitivityFlags: z.array(z.string().min(1)),
  tokenHash: z.string().min(16),
  issuedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema
}).strict();

export const sponsoredInterstitialInteractionSpecSchema = z.object({
  type: interactionTypeSchema,
  prompt: z.string().min(1),
  allowedOutputs: z.array(z.string().min(1)).min(1)
}).strict();

export const sponsoredInterstitialSchema = z.object({
  id: idSchema,
  campaignId: idSchema,
  adPoolItemId: idSchema,
  advertiserName: z.string().min(1),
  label: z.literal("Sponsored"),
  headline: z.string().min(1),
  body: z.string().min(1),
  visualSpec: z.record(z.string(), z.unknown()),
  interactionSpec: sponsoredInterstitialInteractionSpecSchema,
  cta: landingDeepLinkActionSchema,
  disclosure: z.object({
    whyShown: z.string().min(1),
    dataBoundary: z.string().min(1)
  }).strict(),
  sponsoredMetadata: z.object({
    campaignId: idSchema,
    policyHash: z.string().min(16),
    generatedAt: isoDateTimeSchema
  }).strict(),
  createdAt: isoDateTimeSchema
}).strict();

export const sponsoredInterstitialInteractionSchema = z.object({
  id: idSchema,
  interstitialId: idSchema,
  type: interactionTypeSchema,
  input: z.record(z.string(), z.unknown()),
  resultingStateHash: z.string().min(16),
  realtimeInteractionScore: z.number().min(0).max(1),
  isolatedFromAnswer: z.literal(true),
  occurredAt: isoDateTimeSchema
}).strict();

export const contextRetentionEvidenceSchema = z.object({
  id: idSchema,
  campaignId: idSchema,
  attentionEventId: idSchema,
  followUpEventId: idSchema,
  evidenceChunks: z.array(z.object({
    id: idSchema,
    summary: z.string().min(1),
    similarityScore: z.number().min(0).max(1)
  }).strict()),
  score: z.number().min(0).max(1),
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
  classifierVersion: z.string().min(1),
  createdAt: isoDateTimeSchema
}).strict();

export const dynamicSettlementPolicySchema = z.object({
  id: idSchema,
  campaignId: idSchema,
  dwellWeightBps: bpsSchema,
  interactionWeightBps: bpsSchema,
  retentionWeightBps: bpsSchema,
  deepLinkWeightBps: bpsSchema,
  thresholdBps: z.number().int().min(5000).max(9000),
  dwellThresholdSeconds: z.number().positive(),
  version: z.number().int().positive(),
  policyHash: z.string().min(16),
  status: z.enum(["active", "retired"]),
  createdAt: isoDateTimeSchema
}).strict().superRefine((policy, ctx) => {
  const totalWeight =
    policy.dwellWeightBps +
    policy.interactionWeightBps +
    policy.retentionWeightBps +
    policy.deepLinkWeightBps;

  if (totalWeight !== 10000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Settlement policy weights must add up to 10000 bps.",
      path: ["dwellWeightBps"]
    });
  }
});

export const attentionEventSchema = z.object({
  id: idSchema,
  campaignId: idSchema,
  interstitialId: idSchema,
  signalTypes: z.array(signalTypeSchema).min(1),
  dwellSeconds: z.number().nonnegative(),
  realtimeInteractionScore: z.number().min(0).max(1),
  contextRetentionScore: z.number().min(0).max(1),
  deepLinkScore: z.number().min(0).max(1),
  scoreBps: bpsSchema,
  thresholdBps: z.number().int().min(5000).max(9000),
  settlementEligible: z.boolean(),
  pseudonymousUserProof: z.string().min(16),
  occurredAt: isoDateTimeSchema
}).strict();

export const settlementProofSchema = z.object({
  campaignId: idSchema,
  attentionEventId: idSchema,
  settlementPolicyHash: z.string().min(16),
  signalTypes: z.array(signalTypeSchema).min(1),
  scoreBps: bpsSchema,
  thresholdBps: z.number().int().min(5000).max(9000),
  pseudonymousUserProof: z.string().min(16),
  occurredAt: isoDateTimeSchema,
  proofHash: z.string().min(16)
}).strict();

export const settlementEventSchema = z.object({
  id: idSchema,
  campaignId: idSchema,
  attentionEventId: idSchema,
  policyHash: z.string().min(16),
  proofHash: z.string().min(16),
  scoreBps: bpsSchema,
  thresholdBps: z.number().int().min(5000).max(9000),
  status: settlementStatusSchema,
  transactionHash: z.string().min(1).optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
}).strict();

export const contractTransactionSchema = z.object({
  id: idSchema,
  chainId: z.number().int().positive(),
  contractAddress: z.string().min(1),
  type: z.enum(["escrow_deposit", "settlement_claim", "payout"]),
  txHash: z.string().min(1),
  status: z.enum(["pending", "confirmed", "failed"]),
  blockNumber: z.number().int().positive().optional(),
  eventName: z.string().min(1).optional(),
  relatedCampaignId: idSchema.optional(),
  relatedSettlementEventId: idSchema.optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
}).strict();

export const advertiserWalletProfileSchema = z.object({
  advertiserId: idSchema,
  walletAddress: z.string().min(1).optional(),
  chainId: z.number().int().positive(),
  verificationStatus: advertiserWalletVerificationStatusSchema,
  updatedAt: isoDateTimeSchema
}).strict();

export const campaignFundingAccountSchema = z.object({
  campaignId: idSchema,
  advertiserId: idSchema,
  chainId: z.number().int().positive(),
  escrowContractAddress: z.string().min(1),
  walletAddress: z.string().min(1).optional(),
  policyHash: z.string().min(16),
  depositedWei: weiAmountSchema,
  spentWei: weiAmountSchema,
  availableWei: weiAmountSchema,
  pendingDebitWei: weiAmountSchema,
  lastIndexedBlock: z.number().int().positive().optional(),
  updatedAt: isoDateTimeSchema
}).strict();

export const escrowLedgerEntrySchema = z.object({
  id: idSchema,
  campaignId: idSchema,
  type: escrowLedgerEntryTypeSchema,
  amountWei: weiAmountSchema,
  status: ledgerStatusSchema,
  txHash: z.string().min(1).optional(),
  blockNumber: z.number().int().positive().optional(),
  eventName: z.string().min(1).optional(),
  attentionEventId: idSchema.optional(),
  settlementEventId: idSchema.optional(),
  proofHash: z.string().min(16).optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
}).strict();

export const fundingBalanceSummarySchema = z.object({
  depositedWei: weiAmountSchema,
  spentWei: weiAmountSchema,
  availableWei: weiAmountSchema,
  pendingDebitWei: weiAmountSchema,
  entryCount: z.number().int().nonnegative(),
  lastIndexedBlock: z.number().int().positive().optional()
}).strict();

export type Campaign = z.infer<typeof campaignSchema>;
export type NaturalLanguageTargetPolicy = z.infer<typeof naturalLanguageTargetPolicySchema>;
export type CompiledTargetPolicy = z.infer<typeof compiledTargetPolicySchema>;
export type AdPoolItem = z.infer<typeof adPoolItemSchema>;
export type PersonalIntelligenceSnapshot = z.infer<typeof personalIntelligenceSnapshotSchema>;
export type EligibilityToken = z.infer<typeof eligibilityTokenSchema>;
export type SponsoredInterstitial = z.infer<typeof sponsoredInterstitialSchema>;
export type SponsoredInterstitialInteraction = z.infer<typeof sponsoredInterstitialInteractionSchema>;
export type ContextRetentionEvidence = z.infer<typeof contextRetentionEvidenceSchema>;
export type DynamicSettlementPolicy = z.infer<typeof dynamicSettlementPolicySchema>;
export type AttentionEvent = z.infer<typeof attentionEventSchema>;
export type SettlementProof = z.infer<typeof settlementProofSchema>;
export type SettlementEvent = z.infer<typeof settlementEventSchema>;
export type ContractTransaction = z.infer<typeof contractTransactionSchema>;
export type AdvertiserWalletVerificationStatus = z.infer<typeof advertiserWalletVerificationStatusSchema>;
export type EscrowLedgerEntryType = z.infer<typeof escrowLedgerEntryTypeSchema>;
export type LedgerStatus = z.infer<typeof ledgerStatusSchema>;
export type AdvertiserWalletProfile = z.infer<typeof advertiserWalletProfileSchema>;
export type CampaignFundingAccount = z.infer<typeof campaignFundingAccountSchema>;
export type EscrowLedgerEntry = z.infer<typeof escrowLedgerEntrySchema>;
export type FundingBalanceSummary = z.infer<typeof fundingBalanceSummarySchema>;

export function hashStableJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(sortJson(value))).digest("hex");
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortJson(nestedValue)])
    );
  }

  return value;
}
