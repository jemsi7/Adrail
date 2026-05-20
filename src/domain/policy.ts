import {
  type CompiledTargetPolicy,
  compiledTargetPolicySchema,
  hashStableJson
} from "./schemas";

type SensitiveRule = {
  signal: string;
  patterns: RegExp[];
  reason: string;
};

const SENSITIVE_RULES: SensitiveRule[] = [
  {
    signal: "health_condition",
    patterns: [/\b(diabetes|cancer|pregnan(?:t|cy)|depression|mental health|medical condition|chronic illness)\b/i],
    reason: "Health conditions cannot be used for ad targeting."
  },
  {
    signal: "religion",
    patterns: [/\b(religion|muslim|christian|jewish|hindu|buddhist|church|mosque|synagogue|temple)\b/i],
    reason: "Religious identity cannot be used for ad targeting."
  },
  {
    signal: "race_or_ethnicity",
    patterns: [/\b(race|ethnicity|ethnic|black people|asian people|latino|hispanic|native american)\b/i],
    reason: "Race or ethnicity cannot be used for ad targeting."
  },
  {
    signal: "political_affiliation",
    patterns: [/\b(political affiliation|party affiliation|democrat|republican|conservative voters|liberal voters)\b/i],
    reason: "Political affiliation cannot be used for ad targeting."
  },
  {
    signal: "sexual_orientation",
    patterns: [/\b(sexual orientation|lgbtq|gay|lesbian|bisexual|transgender)\b/i],
    reason: "Sexual orientation or gender identity cannot be used for ad targeting."
  },
  {
    signal: "minor_age",
    patterns: [/\b(minors|under 18|children under|teenagers under|kids under)\b/i],
    reason: "Minor status cannot be used for this targeting policy."
  },
  {
    signal: "financial_hardship",
    patterns: [/\b(bankrupt|debt relief|payday loan|financial hardship|low income people)\b/i],
    reason: "Financial hardship cannot be used as an exploitative targeting signal."
  }
];

export type SensitiveTargetingDetection = {
  verdict: "approved" | "blocked";
  prohibitedSensitiveSignals: string[];
  reasons: string[];
};

export type CompileNaturalLanguageTargetPolicyInput = {
  id: string;
  campaignId: string;
  sourcePolicyId: string;
  sourceText: string;
  createdAt: string;
};

export function detectSensitiveTargeting(policyText: string): SensitiveTargetingDetection {
  const matchedRules = SENSITIVE_RULES.filter((rule) =>
    rule.patterns.some((pattern) => pattern.test(policyText))
  );

  return {
    verdict: matchedRules.length === 0 ? "approved" : "blocked",
    prohibitedSensitiveSignals: [...new Set(matchedRules.map((rule) => rule.signal))],
    reasons: matchedRules.map((rule) => rule.reason)
  };
}

export function compileNaturalLanguageTargetPolicy(
  input: CompileNaturalLanguageTargetPolicyInput
): CompiledTargetPolicy {
  const sourceText = input.sourceText.trim();
  const detection = detectSensitiveTargeting(sourceText);
  const ast = {
    kind: "natural_language_policy_v1",
    sourceText,
    requiredContextSignals: extractContextSignals(sourceText),
    blockedSensitiveSignals: detection.prohibitedSensitiveSignals
  };
  const embeddingQueries =
    detection.verdict === "approved" ? buildEmbeddingQueries(sourceText) : [];
  const compiledSummary =
    detection.verdict === "approved"
      ? `Approved policy compiled from advertiser brief: ${sourceText}`
      : `Blocked policy due to prohibited sensitive targeting: ${detection.prohibitedSensitiveSignals.join(", ")}`;
  const policyHash = hashStableJson({
    campaignId: input.campaignId,
    sourcePolicyId: input.sourcePolicyId,
    ast,
    embeddingQueries,
    compilerVersion: "phase1-deterministic-v1"
  });

  return compiledTargetPolicySchema.parse({
    id: input.id,
    campaignId: input.campaignId,
    sourcePolicyId: input.sourcePolicyId,
    ast,
    embeddingQueries,
    prohibitedSensitiveSignals: detection.prohibitedSensitiveSignals,
    compiledSummary,
    safetyVerdict: detection.verdict,
    policyHash,
    compilerVersion: "phase1-deterministic-v1",
    createdAt: input.createdAt
  });
}

function extractContextSignals(sourceText: string): string[] {
  const normalized = sourceText.toLowerCase();
  const signals = [
    ["travel", /\b(travel|trip|itinerary|hotel|local experience|weekend)\b/],
    ["productivity", /\b(productivity|saas|workflow|team|automation|time saved)\b/],
    ["learning", /\b(course|learning|upskill|professional|certification|training)\b/]
  ] as const;

  return signals
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([signal]) => signal);
}

function buildEmbeddingQueries(sourceText: string): string[] {
  const normalized = sourceText.replace(/\s+/g, " ").trim();
  return [normalized];
}
