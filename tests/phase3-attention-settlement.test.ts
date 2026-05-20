import { describe, expect, it } from "vitest";
import { applySponsoredInteraction } from "../src/domain/boundaries";
import {
  CONTEXT_RETENTION_CLASSIFIER_VERSION,
  adjudicateContextRetention,
  calculateAttentionScore,
  createAttentionEvent,
  createPseudonymousUserProof,
  retrieveContextRetentionEvidence,
  scoreRealtimeInteraction,
  trackDwell,
  validateDynamicSettlementPolicy,
  verifyDeepLink
} from "../src/domain/attention";
import { generateInteractiveSponsoredInterstitial } from "../src/domain/ad-generation";
import {
  createDemoAdThemeFixtures,
  createEligibilityTokenFixture,
  createIntentContextFixture,
  type DemoAdTheme,
  type DemoAdThemeFixture
} from "../src/domain/demo-fixtures";
import { selectAdOpportunity } from "../src/domain/matching";
import {
  type AttentionEvent,
  type ContextRetentionEvidence,
  type SponsoredInterstitial
} from "../src/domain/schemas";
import {
  ATTENTION_ESCROW_ABI,
  indexSettlementContractEvent,
  parseSettlementContractEvent,
  submitSettlementTransaction,
  triggerSettlement
} from "../src/domain/settlement";
import { renderSettlementDashboardHtml } from "../src/ui/settlement-dashboard-renderer";

const now = "2026-05-20T06:30:00.000Z";
const indexedAt = "2026-05-20T06:30:12.000Z";
const chainId = 84532;
const contractAddress = "0x1111111111111111111111111111111111111111";

describe("Phase 3 attention scoring", () => {
  it("tracks dwell and prevents settlement when score is below threshold", () => {
    const { fixture, interstitial } = buildInterstitialForTheme("travel");
    const dwell = trackDwell({
      startedAt: "2026-05-20T06:30:00.000Z",
      endedAt: "2026-05-20T06:30:01.000Z",
      dwellThresholdSeconds: fixture.settlementPolicy!.dwellThresholdSeconds
    });
    const pseudonymousUserProof = createPseudonymousUserProof({
      campaignId: fixture.campaign.id,
      userVaultId: "user_vault_123",
      eligibilityTokenHash: "eligibility_hash_123",
      privacySalt: "phase3-test-salt"
    });
    const attentionEvent = createAttentionEvent({
      id: "attention_below_threshold_test",
      campaignId: fixture.campaign.id,
      interstitialId: interstitial.id,
      dwellSeconds: dwell.dwellSeconds,
      realtimeInteractionScore: 0,
      contextRetentionScore: 0,
      deepLinkScore: 0,
      settlementPolicy: fixture.settlementPolicy!,
      pseudonymousUserProof,
      occurredAt: now
    });
    const score = calculateAttentionScore({
      dwellSeconds: dwell.dwellSeconds,
      realtimeInteractionScore: 0,
      contextRetentionScore: 0,
      deepLinkScore: 0,
      settlementPolicy: fixture.settlementPolicy!
    });
    const trigger = triggerSettlement({
      attentionEvent,
      settlementPolicy: fixture.settlementPolicy!,
      settlementEventId: "settlement_below_threshold_test",
      now
    });

    expect(dwell).toEqual({ dwellSeconds: 1, thresholdMet: false });
    expect(score.scoreBps).toBe(1000);
    expect(attentionEvent.settlementEligible).toBe(false);
    expect(trigger).toMatchObject({
      triggered: false,
      reason: "attention_not_eligible"
    });
    expect(pseudonymousUserProof).toHaveLength(64);
    expect(pseudonymousUserProof).not.toContain("user_vault_123");
  });

  it("validates campaign-level dynamic settlement policies", () => {
    const { fixture } = buildInterstitialForTheme("productivity");

    expect(validateDynamicSettlementPolicy(fixture.settlementPolicy!)).toMatchObject({
      campaignId: fixture.campaign.id,
      thresholdBps: 6500,
      status: "active"
    });
    expect(() =>
      validateDynamicSettlementPolicy({
        ...fixture.settlementPolicy!,
        dwellWeightBps: 2600
      })
    ).toThrow(/weights must add up/i);
  });
});

describe("Phase 3 context retention and deep-link verification", () => {
  it("retrieves RAG-style evidence and adjudicates context retention without raw transcript", () => {
    const { fixture } = buildInterstitialForTheme("productivity");
    const retrieval = retrieveContextRetentionEvidence({
      campaignId: fixture.campaign.id,
      attentionEventId: "attention_retention_test",
      followUpEventId: "followup_retention_test",
      followUpQuestion: "Can FlowPilot compare workflow automation with a security review checklist?",
      retrievalSafeSummary: "User is still comparing workflow automation tools.",
      adClaimSummaries: [fixture.adPoolItem.productServiceSummary],
      adAttributes: fixture.adPoolItem.mustIncludeAttributes
    });
    const evidence = adjudicateContextRetention({
      retrieval,
      followUpQuestion: "Can FlowPilot compare workflow automation with a security review checklist?",
      createdAt: now
    });

    expect(retrieval.evidenceChunks[0]?.summary).toBe("Security review checklist");
    expect(evidence.score).toBe(1);
    expect(evidence.classifierVersion).toBe(CONTEXT_RETENTION_CLASSIFIER_VERSION);
    expect(JSON.stringify(evidence)).not.toContain("rawTranscript");
  });

  it("scores isolated realtime interaction and verifies agent deep-link CTA", () => {
    const { interstitial } = buildInterstitialForTheme("learning");
    const { interactionEvent } = applySponsoredInteraction({
      interstitial,
      interactionId: "interaction_learning_phase3_test",
      interactionInput: { value: "Product operations" },
      occurredAt: now
    });
    const deepLink = verifyDeepLink({
      interstitial,
      event: {
        sourceInterstitialId: interstitial.id,
        actionType: interstitial.cta.actionType,
        target: interstitial.cta.target
      }
    });

    expect(scoreRealtimeInteraction(interactionEvent)).toBe(1);
    expect(deepLink).toEqual({
      verified: true,
      score: 1,
      reason: "agent_deeplink_verified"
    });
    expect(() =>
      scoreRealtimeInteraction({
        realtimeInteractionScore: 1,
        isolatedFromAnswer: false
      })
    ).toThrow(/isolated/i);
  });
});

describe("Phase 3 settlement transaction and event indexing", () => {
  it("submits an eligible settlement proof and indexes the contract event for dashboard display", () => {
    const { fixture, interstitial, evidence } = buildEligibleAttentionFlow("travel");
    const attentionEvent = buildAttentionEvent({
      fixture,
      interstitial,
      evidence,
      id: "attention_settlement_test"
    });
    const trigger = triggerSettlement({
      attentionEvent,
      settlementPolicy: fixture.settlementPolicy!,
      settlementEventId: "settlement_event_test",
      now
    });

    if (!trigger.triggered) {
      throw new Error(`Expected settlement trigger, received ${trigger.reason}`);
    }

    const submitted = submitSettlementTransaction({
      settlementEvent: trigger.settlementEvent,
      proof: trigger.proof,
      chainId,
      contractAddress,
      submittedAt: now
    });
    const receipt = {
      txHash: submitted.transaction.txHash,
      chainId,
      contractAddress,
      status: "confirmed" as const,
      blockNumber: 123456,
      logs: [
        {
          eventName: "SettlementClaimed",
          args: {
            campaignId: trigger.proof.campaignId,
            attentionEventId: trigger.proof.attentionEventId,
            proofHash: `0x${trigger.proof.proofHash}`,
            scoreBps: trigger.proof.scoreBps,
            thresholdBps: trigger.proof.thresholdBps
          }
        }
      ]
    };
    const parsedEvent = parseSettlementContractEvent(receipt);
    const indexed = indexSettlementContractEvent({
      receipt,
      settlementEvent: submitted.settlementEvent,
      transaction: submitted.transaction,
      indexedAt
    });
    const dashboardHtml = renderSettlementDashboardHtml({
      attentionEvent,
      contextRetentionEvidence: evidence,
      settlementEvent: indexed.settlementEvent,
      transaction: indexed.transaction
    });

    expect(attentionEvent.scoreBps).toBe(10000);
    expect(ATTENTION_ESCROW_ABI.join("\n")).toContain("claimSettlement");
    expect(ATTENTION_ESCROW_ABI.join("\n")).toContain("SettlementClaimed");
    expect(trigger.proof.proofHash).toHaveLength(64);
    expect(submitted.transaction.txHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(parsedEvent.proofHash).toBe(trigger.proof.proofHash);
    expect(indexed.settlementEvent.status).toBe("settled");
    expect(indexed.transaction.status).toBe("confirmed");
    expect(indexed.transaction.eventName).toBe("SettlementClaimed");
    expect(dashboardHtml).toContain("Settlement Dashboard");
    expect(dashboardHtml).toContain('data-settlement-status="settled"');
    expect(dashboardHtml).toContain(submitted.transaction.txHash);
  });

  it("prevents duplicate settlement for the same attention proof", () => {
    const { fixture, interstitial, evidence } = buildEligibleAttentionFlow("learning");
    const attentionEvent = buildAttentionEvent({
      fixture,
      interstitial,
      evidence,
      id: "attention_duplicate_test"
    });
    const firstTrigger = triggerSettlement({
      attentionEvent,
      settlementPolicy: fixture.settlementPolicy!,
      settlementEventId: "settlement_duplicate_first",
      now
    });

    if (!firstTrigger.triggered) {
      throw new Error(`Expected first settlement trigger, received ${firstTrigger.reason}`);
    }

    const duplicateTrigger = triggerSettlement({
      attentionEvent,
      settlementPolicy: fixture.settlementPolicy!,
      existingSettlementEvents: [firstTrigger.settlementEvent],
      settlementEventId: "settlement_duplicate_second",
      now
    });

    expect(duplicateTrigger).toMatchObject({
      triggered: false,
      reason: "duplicate_settlement"
    });
  });
});

function buildEligibleAttentionFlow(theme: DemoAdTheme): {
  fixture: DemoAdThemeFixture;
  interstitial: SponsoredInterstitial;
  evidence: ContextRetentionEvidence;
} {
  const { fixture, interstitial } = buildInterstitialForTheme(theme);
  const retrieval = retrieveContextRetentionEvidence({
    campaignId: fixture.campaign.id,
    attentionEventId: `attention_${theme}_eligible`,
    followUpEventId: `followup_${theme}_eligible`,
    followUpQuestion: buildFollowUpQuestion(theme),
    retrievalSafeSummary: createIntentContextFixture(theme, now).currentNeedSummary,
    adClaimSummaries: [fixture.adPoolItem.productServiceSummary],
    adAttributes: fixture.adPoolItem.mustIncludeAttributes
  });
  const evidence = adjudicateContextRetention({
    retrieval,
    followUpQuestion: buildFollowUpQuestion(theme),
    createdAt: now
  });

  return {
    fixture,
    interstitial,
    evidence
  };
}

function buildAttentionEvent(input: {
  fixture: DemoAdThemeFixture;
  interstitial: SponsoredInterstitial;
  evidence: ContextRetentionEvidence;
  id: string;
}): AttentionEvent {
  return createAttentionEvent({
    id: input.id,
    campaignId: input.fixture.campaign.id,
    interstitialId: input.interstitial.id,
    dwellSeconds: 3,
    realtimeInteractionScore: 1,
    contextRetentionScore: input.evidence.score,
    deepLinkScore: 1,
    settlementPolicy: input.fixture.settlementPolicy!,
    pseudonymousUserProof: createPseudonymousUserProof({
      campaignId: input.fixture.campaign.id,
      eligibilityTokenHash: "eligibility_hash_phase3",
      privacySalt: "phase3-test-salt"
    }),
    occurredAt: now
  });
}

function buildInterstitialForTheme(theme: DemoAdTheme): {
  fixture: DemoAdThemeFixture;
  interstitial: SponsoredInterstitial;
} {
  const fixtures = createDemoAdThemeFixtures(now);
  const fixture = fixtures.find((candidate) => candidate.theme === theme);

  if (!fixture) {
    throw new Error(`Missing fixture for theme ${theme}`);
  }

  const intentContext = createIntentContextFixture(theme, now);
  const eligibilityToken = createEligibilityTokenFixture({
    id: `eligibility_${theme}_phase3_test`,
    snapshotId: `snapshot_${theme}_phase3_test`,
    intentTags: [theme],
    now
  });
  const decision = selectAdOpportunity({
    intentContext,
    retrievalSafeSummary: intentContext.currentNeedSummary,
    eligibilityToken,
    candidates: fixtures,
    now
  });

  if (!decision.opportunity) {
    throw new Error(`Expected ad opportunity for theme ${theme}`);
  }

  return {
    fixture,
    interstitial: generateInteractiveSponsoredInterstitial({
      opportunity: decision.opportunity,
      interstitialId: `interstitial_${theme}_phase3_test`,
      generatedAt: now
    })
  };
}

function buildFollowUpQuestion(theme: DemoAdTheme): string {
  if (theme === "travel") {
    return "Can Atlas Local keep the weekend itinerary budget-aware with food and nature options?";
  }

  if (theme === "productivity") {
    return "Can FlowPilot compare workflow automation templates with the security review checklist?";
  }

  return "Can SkillForge turn this into a role-based course path with hands-on projects?";
}
