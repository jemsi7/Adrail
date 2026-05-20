import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DEFAULT_OPENROUTER_EMBEDDING_MODEL,
  DEFAULT_OPENROUTER_TEXT_MODEL,
  enhanceScenarioAdWithOpenRouter
} from "../../../src/ai/live-llm";
import {
  type CampaignMatchingMode,
  selectAdThemeWithOpenRouterEmbeddings,
  selectAdThemeWithOpenRouterProfessionalMatching
} from "../../../src/ai/live-ad-matching";
import {
  getOpenRouterApiKeyFromEnv,
  resolveOpenRouterConfig
} from "../../../src/ai/openrouter";
import {
  buildPhase4DemoScenario,
  buildPhase4DemoScenarioFromAdDecision
} from "../../../src/domain/demo-ux";
import { demoPresetDraftSchema, sanitizeDemoPresetDrafts } from "../../../src/domain/demo-presets";

const requestSchema = z.object({
  theme: z.string().min(1),
  customPresets: z.array(demoPresetDraftSchema).default([]),
  userQuestion: z.string().min(1).optional(),
  readyThemes: z.array(z.string()).optional(),
  matchingModesByTheme: z.record(z.string(), z.enum(["fast", "professional"])).optional()
}).strict();
type LiveAdSelection =
  | Awaited<ReturnType<typeof selectAdThemeWithOpenRouterEmbeddings>>
  | Awaited<ReturnType<typeof selectAdThemeWithOpenRouterProfessionalMatching>>;

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid live scenario payload.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const customPresets = sanitizeDemoPresetDrafts(parsed.data.customPresets);
  const config = resolveOpenRouterConfig({
    apiKey: getOpenRouterApiKeyFromEnv(),
    baseUrl: process.env.OPENROUTER_BASE_URL,
    appTitle: "Adrail Demo"
  });

  if (!config) {
    let scenario: ReturnType<typeof buildPhase4DemoScenario>;

    try {
      scenario = buildPhase4DemoScenario({
        theme: parsed.data.theme,
        customPresets,
        userQuestion: parsed.data.userQuestion,
        readyThemes: parsed.data.readyThemes
      });
      scenario = withSubmittedUserQuestion(scenario, parsed.data.userQuestion);
    } catch (error) {
      return NextResponse.json(
        {
          error: "Unable to build live demo scenario from the provided campaign preset.",
          providerMode: "deterministic_fixture",
          fallbackReason: getScenarioBuildErrorDetail(error)
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      scenario,
      providerMode: "deterministic_fixture",
      fallbackReason: "No OpenRouter API key was provided."
    });
  }

  try {
    const readyThemes = parsed.data.readyThemes && parsed.data.readyThemes.length > 0
      ? parsed.data.readyThemes
      : [parsed.data.theme];
    const matchingModesByTheme = parsed.data.matchingModesByTheme ?? {};
    const usesProfessionalMatching = readyThemes.some((theme) =>
      matchingModesByTheme[theme] === "professional"
    );
    const selection: LiveAdSelection = usesProfessionalMatching
      ? await selectAdThemeWithOpenRouterProfessionalMatching({
          config,
          model: process.env.AD_MEDIATOR_MODEL && process.env.AD_MEDIATOR_MODEL !== "replace_me"
            ? process.env.AD_MEDIATOR_MODEL
            : DEFAULT_OPENROUTER_TEXT_MODEL,
          theme: parsed.data.theme,
          customPresets,
          userQuestion: parsed.data.userQuestion,
          readyThemes,
          matchingModesByTheme: matchingModesByTheme as Record<string, CampaignMatchingMode>
        })
      : await selectAdThemeWithOpenRouterEmbeddings({
          config,
          model: process.env.EMBEDDING_MODEL && process.env.EMBEDDING_MODEL !== "replace_me"
            ? process.env.EMBEDDING_MODEL
            : DEFAULT_OPENROUTER_EMBEDDING_MODEL,
          theme: parsed.data.theme,
          customPresets,
          userQuestion: parsed.data.userQuestion,
          readyThemes
        });

    const scenario = buildPhase4DemoScenarioFromAdDecision({
      theme: selection.selectedTheme,
      decision: selection.decision,
      customPresets,
      userQuestion: parsed.data.userQuestion,
      readyThemes
    });
    const liveScenario = await enhanceScenarioAdWithOpenRouter({
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
      error: "OpenRouter live scenario failed.",
      providerMode: "openrouter_live",
      fallbackReason: error instanceof Error ? error.message : "OpenRouter live scenario failed."
    }, { status: 502 });
  }
}

function getScenarioBuildErrorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : "Scenario generation failed.";

  if (message.includes("Expected eligible Phase 4 ad opportunity")) {
    return "The campaign preset was accepted, but its target policy and demo user question did not produce an eligible sponsored scenario. Use a non-sensitive English target policy with terms that overlap the offer and question.";
  }

  return message;
}

function withSubmittedUserQuestion(
  scenario: ReturnType<typeof buildPhase4DemoScenario>,
  userQuestion?: string
): ReturnType<typeof buildPhase4DemoScenario> {
  const normalizedQuestion = userQuestion?.trim();

  if (!normalizedQuestion) {
    return scenario;
  }

  return {
    ...scenario,
    userChat: {
      ...scenario.userChat,
      userQuestion: normalizedQuestion
    }
  };
}
