import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DEFAULT_OPENROUTER_TEXT_MODEL,
  enhanceScenarioWithOpenRouter
} from "../../../src/ai/live-llm";
import {
  getOpenRouterApiKeyFromRequest,
  resolveOpenRouterConfig
} from "../../../src/ai/openrouter";
import { buildPhase4DemoScenario } from "../../../src/domain/demo-ux";

const interactionTemplateSchema = z.enum(["choice", "slider", "short_text"]);

const demoPresetDraftSchema = z.object({
  id: z.string().min(1),
  navigationLabel: z.string().min(1),
  advertiserName: z.string().min(1),
  campaignName: z.string().min(1),
  objective: z.string().min(1),
  productServiceSummary: z.string().min(1),
  naturalLanguageTargetPolicy: z.string().min(1),
  mustIncludeAttributes: z.array(z.string().min(1)).min(1),
  prohibitedClaims: z.array(z.string().min(1)),
  creativeConstraints: z.array(z.string().min(1)).optional(),
  allowedInteractionTemplates: z.array(interactionTemplateSchema).min(1),
  ctaLabel: z.string().min(1),
  ctaTarget: z.string().min(1),
  userQuestion: z.string().min(1).optional(),
  currentNeedSummary: z.string().min(1).optional(),
  intentTags: z.array(z.string().min(1)).optional(),
  followUpQuestion: z.string().min(1).optional()
}).strict();

const requestSchema = z.object({
  theme: z.string().min(1),
  customPresets: z.array(demoPresetDraftSchema).default([])
}).strict();

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid live scenario payload.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const scenario = buildPhase4DemoScenario({
    theme: parsed.data.theme,
    customPresets: parsed.data.customPresets
  });
  const config = resolveOpenRouterConfig({
    apiKey: getOpenRouterApiKeyFromRequest(request),
    baseUrl: process.env.OPENROUTER_BASE_URL,
    appTitle: "Agentic Ad Firewall Demo"
  });

  if (!config) {
    return NextResponse.json({
      scenario,
      providerMode: "deterministic_fixture",
      fallbackReason: "No OpenRouter API key was provided."
    });
  }

  try {
    const liveScenario = await enhanceScenarioWithOpenRouter({
      scenario,
      config,
      model: process.env.INTERACTIVE_AD_MODEL &&
        process.env.INTERACTIVE_AD_MODEL !== "replace_me"
        ? process.env.INTERACTIVE_AD_MODEL
        : DEFAULT_OPENROUTER_TEXT_MODEL
    });

    return NextResponse.json({
      scenario: liveScenario,
      providerMode: "openrouter_live"
    });
  } catch (error) {
    return NextResponse.json({
      scenario,
      providerMode: "deterministic_fixture",
      fallbackReason: error instanceof Error ? error.message : "OpenRouter live scenario failed."
    });
  }
}
