import { describe, expect, it } from "vitest";
import {
  generateInteractiveSponsoredInterstitial,
  guardSponsoredInterstitial
} from "../src/domain/ad-generation";
import {
  createDemoAdThemeFixtures,
  createEligibilityTokenFixture,
  createIntentContextFixture
} from "../src/domain/demo-fixtures";
import {
  selectAdOpportunity,
  withinFrequencyCap
} from "../src/domain/matching";
import {
  TARGET_POLICY_COMPILER_VERSION,
  compileNaturalLanguageTargetPolicy,
  detectSensitiveTargeting,
  generateEmbeddingQueries
} from "../src/domain/policy";
import { type SponsoredInterstitial } from "../src/domain/schemas";
import { renderSponsoredInterstitialHtml } from "../src/ui/sponsored-interstitial-renderer";

const now = "2026-05-20T06:30:00.000Z";

describe("Phase 2 natural-language policy compiler", () => {
  it("compiles approved policies into auditable AST, embedding queries, and policy hash", () => {
    const compiledPolicy = compileNaturalLanguageTargetPolicy({
      id: "compiled_policy_productivity_test",
      campaignId: "campaign_productivity_test",
      sourcePolicyId: "source_policy_productivity_test",
      sourceText: "Reach teams comparing productivity SaaS and workflow automation tools.",
      createdAt: now
    });

    expect(compiledPolicy.safetyVerdict).toBe("approved");
    expect(compiledPolicy.compilerVersion).toBe(TARGET_POLICY_COMPILER_VERSION);
    expect(compiledPolicy.ast).toMatchObject({
      kind: "natural_language_policy_v2",
      privacyBoundary: "platform_private_matching",
      requiredContextSignals: ["productivity"]
    });
    expect(compiledPolicy.embeddingQueries.length).toBeGreaterThan(1);
    expect(compiledPolicy.policyHash).toHaveLength(64);
  });

  it("keeps sensitive targeting blocked and prevents embedding query generation", () => {
    const detection = detectSensitiveTargeting(
      "Reach people with depression who are considering professional courses."
    );
    const compiledPolicy = compileNaturalLanguageTargetPolicy({
      id: "compiled_policy_sensitive_test",
      campaignId: "campaign_sensitive_test",
      sourcePolicyId: "source_policy_sensitive_test",
      sourceText: "Reach people with depression who are considering professional courses.",
      createdAt: now
    });

    expect(detection.verdict).toBe("blocked");
    expect(compiledPolicy.safetyVerdict).toBe("blocked");
    expect(compiledPolicy.embeddingQueries).toEqual([]);
    expect(generateEmbeddingQueries("weekend travel and local experiences")).toContain(
      "weekend travel itinerary local experiences food nature culture budget"
    );
  });
});

describe("Phase 2 ad matching", () => {
  it("selects an eligible travel campaign from retrieval-safe context", () => {
    const fixtures = createDemoAdThemeFixtures(now);
    const intentContext = createIntentContextFixture("travel", now);
    const eligibilityToken = createEligibilityTokenFixture({
      id: "eligibility_travel_test",
      snapshotId: "snapshot_travel_test",
      intentTags: ["travel", "weekend"],
      preferenceTags: ["budget", "food"],
      now
    });

    const decision = selectAdOpportunity({
      intentContext,
      retrievalSafeSummary: intentContext.currentNeedSummary,
      eligibilityToken,
      candidates: fixtures,
      now
    });

    expect(decision.shouldRender).toBe(true);
    expect(decision.reason).toBe("eligible_campaign_selected");
    expect(decision.opportunity?.campaign.id).toBe("campaign_travel_001");
    expect(decision.opportunity?.selectedInteractionTemplate).toBe("choice");
    expect(decision.opportunity?.matchedSignals).toContain("travel");
  });

  it("returns no eligible campaign when opt-out or frequency cap blocks the match", () => {
    const fixtures = createDemoAdThemeFixtures(now);
    const intentContext = createIntentContextFixture("travel", now);
    const optedOutToken = createEligibilityTokenFixture({
      id: "eligibility_travel_optout_test",
      snapshotId: "snapshot_travel_optout_test",
      intentTags: ["travel"],
      categoryOptOuts: ["travel"],
      now
    });
    const optedOutDecision = selectAdOpportunity({
      intentContext,
      retrievalSafeSummary: intentContext.currentNeedSummary,
      eligibilityToken: optedOutToken,
      candidates: fixtures,
      now
    });

    expect(optedOutDecision.shouldRender).toBe(false);
    expect(optedOutDecision.rejectedCandidates).toContainEqual({
      campaignId: "campaign_travel_001",
      reason: "category_opt_out"
    });
    expect(withinFrequencyCap("campaign_travel_001", {
      recentImpressions: [
        { campaignId: "campaign_travel_001", occurredAt: "2026-05-20T05:00:00.000Z" },
        { campaignId: "campaign_travel_001", occurredAt: "2026-05-20T05:30:00.000Z" }
      ],
      maxImpressionsPerCampaign: 2,
      windowHours: 24
    }, now)).toBe(false);
  });
});

describe("Phase 2 interactive ad generation and rendering", () => {
  it("generates a guarded Sponsored interstitial and scripted graphic renderer output", () => {
    const fixtures = createDemoAdThemeFixtures(now);
    const travelFixture = fixtures.find((fixture) => fixture.theme === "travel");
    const intentContext = createIntentContextFixture("travel", now);
    const eligibilityToken = createEligibilityTokenFixture({
      id: "eligibility_generation_test",
      snapshotId: "snapshot_generation_test",
      intentTags: ["travel", "weekend"],
      preferenceTags: ["culture"],
      now
    });
    const decision = selectAdOpportunity({
      intentContext,
      retrievalSafeSummary: intentContext.currentNeedSummary,
      eligibilityToken,
      candidates: fixtures,
      now
    });

    expect(travelFixture).toBeDefined();
    expect(decision.opportunity).toBeDefined();

    const interstitial = generateInteractiveSponsoredInterstitial({
      opportunity: decision.opportunity!,
      interstitialId: "interstitial_travel_test",
      generatedAt: now
    });
    const guardResult = guardSponsoredInterstitial({
      interstitial,
      adPoolItem: travelFixture!.adPoolItem,
      compiledPolicy: travelFixture!.compiledPolicy
    });
    const html = renderSponsoredInterstitialHtml(interstitial);

    expect(guardResult.approved).toBe(true);
    expect(interstitial.label).toBe("Sponsored");
    expect(interstitial.body).toContain("Budget-aware local experiences");
    expect(interstitial.disclosure.dataBoundary).toContain("does not receive your raw conversation");
    expect(html).toContain('data-sponsored="true"');
    expect(html).toContain('data-renderer="scripted_graphic_v1"');
    expect(html).toContain("Dismiss");
    expect(html).toContain("Not relevant");
  });

  it("blocks generated copy outside the approved claim set", () => {
    const fixtures = createDemoAdThemeFixtures(now);
    const travelFixture = fixtures.find((fixture) => fixture.theme === "travel")!;
    const intentContext = createIntentContextFixture("travel", now);
    const eligibilityToken = createEligibilityTokenFixture({
      id: "eligibility_bad_claim_test",
      snapshotId: "snapshot_bad_claim_test",
      intentTags: ["travel"],
      now
    });
    const decision = selectAdOpportunity({
      intentContext,
      retrievalSafeSummary: intentContext.currentNeedSummary,
      eligibilityToken,
      candidates: fixtures,
      now
    });
    const interstitial = generateInteractiveSponsoredInterstitial({
      opportunity: decision.opportunity!,
      interstitialId: "interstitial_bad_claim_test",
      generatedAt: now
    });
    const mutatedInterstitial: SponsoredInterstitial = {
      ...interstitial,
      body: `${interstitial.body} guaranteed cheapest fares`
    };
    const guardResult = guardSponsoredInterstitial({
      interstitial: mutatedInterstitial,
      adPoolItem: travelFixture.adPoolItem,
      compiledPolicy: travelFixture.compiledPolicy
    });

    expect(guardResult.approved).toBe(false);
    expect(guardResult.violations.join(" ")).toContain("prohibited claims present");
  });

  it("supports all three demo ad theme fixtures", () => {
    const fixtures = createDemoAdThemeFixtures(now);
    const seenThemes = fixtures.map((fixture) => fixture.theme);

    expect(seenThemes).toEqual(["travel", "productivity", "learning"]);

    for (const fixture of fixtures) {
      const intentContext = createIntentContextFixture(fixture.theme, now);
      const eligibilityToken = createEligibilityTokenFixture({
        id: `eligibility_${fixture.theme}_test`,
        snapshotId: `snapshot_${fixture.theme}_test`,
        intentTags: [fixture.theme],
        now
      });
      const decision = selectAdOpportunity({
        intentContext,
        retrievalSafeSummary: intentContext.currentNeedSummary,
        eligibilityToken,
        candidates: fixtures,
        now
      });

      expect(decision.shouldRender).toBe(true);
      expect(decision.opportunity?.campaign.id).toBe(fixture.campaign.id);

      const interstitial = generateInteractiveSponsoredInterstitial({
        opportunity: decision.opportunity!,
        interstitialId: `interstitial_${fixture.theme}_test`,
        generatedAt: now
      });

      expect(interstitial.label).toBe("Sponsored");
      expect(renderSponsoredInterstitialHtml(interstitial)).toContain(fixture.advertiserName);
    }
  });
});
