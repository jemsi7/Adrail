import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const advertisers = sqliteTable("advertisers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  advertiserId: text("advertiser_id").notNull().references(() => advertisers.id),
  name: text("name").notNull(),
  objective: text("objective").notNull(),
  productServiceSummary: text("product_service_summary").notNull(),
  status: text("status").notNull(),
  reviewStatus: text("review_status").notNull(),
  budgetCents: integer("budget_cents").notNull(),
  remainingBudgetCents: integer("remaining_budget_cents").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const naturalLanguageTargetPolicies = sqliteTable("natural_language_target_policies", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  language: text("language").notNull(),
  sourceText: text("source_text").notNull(),
  submittedByAdvertiserId: text("submitted_by_advertiser_id").notNull().references(() => advertisers.id),
  createdAt: text("created_at").notNull()
});

export const compiledTargetPolicies = sqliteTable("compiled_target_policies", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  sourcePolicyId: text("source_policy_id").notNull().references(() => naturalLanguageTargetPolicies.id),
  astJson: text("ast_json").notNull(),
  embeddingQueriesJson: text("embedding_queries_json").notNull(),
  prohibitedSensitiveSignalsJson: text("prohibited_sensitive_signals_json").notNull(),
  compiledSummary: text("compiled_summary").notNull(),
  safetyVerdict: text("safety_verdict").notNull(),
  policyHash: text("policy_hash").notNull(),
  compilerVersion: text("compiler_version").notNull(),
  createdAt: text("created_at").notNull()
});

export const adPoolItems = sqliteTable("ad_pool_items", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  advertiserId: text("advertiser_id").notNull().references(() => advertisers.id),
  objective: text("objective").notNull(),
  productServiceSummary: text("product_service_summary").notNull(),
  mustIncludeAttributesJson: text("must_include_attributes_json").notNull(),
  prohibitedClaimsJson: text("prohibited_claims_json").notNull(),
  creativeConstraintsJson: text("creative_constraints_json").notNull(),
  allowedInteractionTemplatesJson: text("allowed_interaction_templates_json").notNull(),
  landingDeepLinkActionJson: text("landing_deep_link_action_json").notNull(),
  reviewStatus: text("review_status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const personalIntelligenceSnapshots = sqliteTable("personal_intelligence_snapshots", {
  id: text("id").primaryKey(),
  userVaultId: text("user_vault_id").notNull(),
  conversationSummary: text("conversation_summary").notNull(),
  explicitPreferencesJson: text("explicit_preferences_json").notNull(),
  taskIntentsJson: text("task_intents_json").notNull(),
  rejectedAdCategoriesJson: text("rejected_ad_categories_json").notNull(),
  consentSettingsJson: text("consent_settings_json").notNull(),
  matchingFeaturesJson: text("matching_features_json").notNull(),
  createdAt: text("created_at").notNull()
});

export const eligibilityTokens = sqliteTable("eligibility_tokens", {
  id: text("id").primaryKey(),
  snapshotId: text("snapshot_id").notNull().references(() => personalIntelligenceSnapshots.id),
  intentTagsJson: text("intent_tags_json").notNull(),
  preferenceTagsJson: text("preference_tags_json").notNull(),
  categoryOptOutsJson: text("category_opt_outs_json").notNull(),
  sensitivityFlagsJson: text("sensitivity_flags_json").notNull(),
  tokenHash: text("token_hash").notNull(),
  issuedAt: text("issued_at").notNull(),
  expiresAt: text("expires_at").notNull()
});

export const sponsoredInterstitials = sqliteTable("sponsored_interstitials", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  adPoolItemId: text("ad_pool_item_id").notNull().references(() => adPoolItems.id),
  advertiserName: text("advertiser_name").notNull(),
  label: text("label").notNull(),
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  visualSpecJson: text("visual_spec_json").notNull(),
  interactionSpecJson: text("interaction_spec_json").notNull(),
  ctaJson: text("cta_json").notNull(),
  disclosureJson: text("disclosure_json").notNull(),
  sponsoredMetadataJson: text("sponsored_metadata_json").notNull(),
  createdAt: text("created_at").notNull()
});

export const sponsoredInterstitialInteractions = sqliteTable("sponsored_interstitial_interactions", {
  id: text("id").primaryKey(),
  interstitialId: text("interstitial_id").notNull().references(() => sponsoredInterstitials.id),
  type: text("type").notNull(),
  inputJson: text("input_json").notNull(),
  resultingStateHash: text("resulting_state_hash").notNull(),
  realtimeInteractionScore: real("realtime_interaction_score").notNull(),
  isolatedFromAnswer: integer("isolated_from_answer", { mode: "boolean" }).notNull(),
  occurredAt: text("occurred_at").notNull()
});

export const contextRetentionEvidence = sqliteTable("context_retention_evidence", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  attentionEventId: text("attention_event_id").notNull(),
  followUpEventId: text("follow_up_event_id").notNull(),
  evidenceChunksJson: text("evidence_chunks_json").notNull(),
  score: real("score").notNull(),
  rationale: text("rationale").notNull(),
  confidence: real("confidence").notNull(),
  classifierVersion: text("classifier_version").notNull(),
  createdAt: text("created_at").notNull()
});

export const dynamicSettlementPolicies = sqliteTable("dynamic_settlement_policies", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  dwellWeightBps: integer("dwell_weight_bps").notNull(),
  interactionWeightBps: integer("interaction_weight_bps").notNull(),
  retentionWeightBps: integer("retention_weight_bps").notNull(),
  deepLinkWeightBps: integer("deep_link_weight_bps").notNull(),
  thresholdBps: integer("threshold_bps").notNull(),
  dwellThresholdSeconds: real("dwell_threshold_seconds").notNull(),
  version: integer("version").notNull(),
  policyHash: text("policy_hash").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull()
});

export const attentionEvents = sqliteTable("attention_events", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  interstitialId: text("interstitial_id").notNull().references(() => sponsoredInterstitials.id),
  signalTypesJson: text("signal_types_json").notNull(),
  dwellSeconds: real("dwell_seconds").notNull(),
  realtimeInteractionScore: real("realtime_interaction_score").notNull(),
  contextRetentionScore: real("context_retention_score").notNull(),
  deepLinkScore: real("deep_link_score").notNull(),
  scoreBps: integer("score_bps").notNull(),
  thresholdBps: integer("threshold_bps").notNull(),
  settlementEligible: integer("settlement_eligible", { mode: "boolean" }).notNull(),
  pseudonymousUserProof: text("pseudonymous_user_proof").notNull(),
  occurredAt: text("occurred_at").notNull()
});

export const settlementProofs = sqliteTable("settlement_proofs", {
  proofHash: text("proof_hash").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  attentionEventId: text("attention_event_id").notNull().references(() => attentionEvents.id),
  settlementPolicyHash: text("settlement_policy_hash").notNull(),
  signalTypesJson: text("signal_types_json").notNull(),
  scoreBps: integer("score_bps").notNull(),
  thresholdBps: integer("threshold_bps").notNull(),
  pseudonymousUserProof: text("pseudonymous_user_proof").notNull(),
  occurredAt: text("occurred_at").notNull()
});

export const settlementEvents = sqliteTable("settlement_events", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  attentionEventId: text("attention_event_id").notNull().references(() => attentionEvents.id),
  policyHash: text("policy_hash").notNull(),
  proofHash: text("proof_hash").notNull().references(() => settlementProofs.proofHash),
  scoreBps: integer("score_bps").notNull(),
  thresholdBps: integer("threshold_bps").notNull(),
  status: text("status").notNull(),
  transactionHash: text("transaction_hash"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const contractTransactions = sqliteTable("contract_transactions", {
  id: text("id").primaryKey(),
  chainId: integer("chain_id").notNull(),
  contractAddress: text("contract_address").notNull(),
  type: text("type").notNull(),
  txHash: text("tx_hash").notNull(),
  status: text("status").notNull(),
  blockNumber: integer("block_number"),
  eventName: text("event_name"),
  relatedCampaignId: text("related_campaign_id").references(() => campaigns.id),
  relatedSettlementEventId: text("related_settlement_event_id").references(() => settlementEvents.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const advertiserWallets = sqliteTable("advertiser_wallets", {
  id: text("id").primaryKey(),
  advertiserId: text("advertiser_id").notNull().references(() => advertisers.id),
  walletAddress: text("wallet_address").notNull(),
  chainId: integer("chain_id").notNull(),
  verificationStatus: text("verification_status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const campaignFundingAccounts = sqliteTable("campaign_funding_accounts", {
  campaignId: text("campaign_id").primaryKey().references(() => campaigns.id),
  advertiserId: text("advertiser_id").notNull().references(() => advertisers.id),
  chainId: integer("chain_id").notNull(),
  escrowContractAddress: text("escrow_contract_address").notNull(),
  walletAddress: text("wallet_address"),
  policyHash: text("policy_hash").notNull(),
  depositedWei: text("deposited_wei").notNull(),
  spentWei: text("spent_wei").notNull(),
  availableWei: text("available_wei").notNull(),
  pendingDebitWei: text("pending_debit_wei").notNull(),
  lastIndexedBlock: integer("last_indexed_block"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const escrowLedgerEntries = sqliteTable("escrow_ledger_entries", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  type: text("type").notNull(),
  amountWei: text("amount_wei").notNull(),
  status: text("status").notNull(),
  txHash: text("tx_hash"),
  blockNumber: integer("block_number"),
  eventName: text("event_name"),
  attentionEventId: text("attention_event_id").references(() => attentionEvents.id),
  settlementEventId: text("settlement_event_id").references(() => settlementEvents.id),
  proofHash: text("proof_hash").references(() => settlementProofs.proofHash),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});
