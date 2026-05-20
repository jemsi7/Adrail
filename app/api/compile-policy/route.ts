import { NextResponse } from "next/server";
import {
  DEFAULT_OPENROUTER_TEXT_MODEL,
  compilePolicyWithOpenRouter
} from "../../../src/ai/live-llm";
import {
  getOpenRouterApiKeyFromRequest,
  resolveOpenRouterConfig
} from "../../../src/ai/openrouter";
import { compileNaturalLanguageTargetPolicy } from "../../../src/domain/policy";

export async function POST(request: Request) {
  const body = await request.json() as {
    campaignId?: string;
    sourcePolicyId?: string;
    sourceText?: string;
    createdAt?: string;
  };
  const sourceText = String(body.sourceText ?? "").trim();

  if (!sourceText) {
    return NextResponse.json(
      { error: "sourceText is required" },
      { status: 400 }
    );
  }

  const compileInput = {
    id: `compiled_preview_${body.campaignId ?? "campaign"}_${Date.now()}`,
    campaignId: body.campaignId ?? "campaign_preview",
    sourcePolicyId: body.sourcePolicyId ?? "source_policy_preview",
    sourceText,
    createdAt: body.createdAt ?? new Date().toISOString()
  };
  const config = resolveOpenRouterConfig({
    apiKey: getOpenRouterApiKeyFromRequest(request),
    baseUrl: process.env.OPENROUTER_BASE_URL,
    appTitle: "Agentic Ad Firewall Demo"
  });
  let providerMode: "openrouter_live" | "deterministic_fixture" = "deterministic_fixture";
  let fallbackReason: string | undefined;
  let compiled = compileNaturalLanguageTargetPolicy(compileInput);

  if (config) {
    try {
      compiled = await compilePolicyWithOpenRouter({
        ...compileInput,
        config,
        model: process.env.TARGET_POLICY_COMPILER_MODEL &&
          process.env.TARGET_POLICY_COMPILER_MODEL !== "replace_me"
          ? process.env.TARGET_POLICY_COMPILER_MODEL
          : DEFAULT_OPENROUTER_TEXT_MODEL
      });
      providerMode = "openrouter_live";
    } catch (error) {
      fallbackReason = error instanceof Error ? error.message : "OpenRouter compile failed.";
    }
  }

  return NextResponse.json({
    compiledSummary: compiled.compiledSummary,
    safetyVerdict: compiled.safetyVerdict,
    prohibitedSensitiveSignals: compiled.prohibitedSensitiveSignals,
    policyHash: compiled.policyHash,
    compilerVersion: compiled.compilerVersion,
    requiredContextSignals: compiled.ast.requiredContextSignals,
    intentKeywords: compiled.ast.intentKeywords,
    providerMode,
    fallbackReason
  });
}
