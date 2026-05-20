import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAllPhase4DemoScenarios, type Phase4DemoScenario } from "../../../src/domain/demo-ux";
import {
  demoPresetDraftSchema,
  normalizeDemoPresetId,
  sanitizeDemoPresetDrafts,
  type DemoPresetDraft
} from "../../../src/domain/demo-presets";

const requestSchema = z.object({
  customPresets: z.array(demoPresetDraftSchema).default([])
}).strict();

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid custom demo preset payload.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const customPresets = sanitizeDemoPresetDrafts(parsed.data.customPresets);
    const scenarios = buildAllPhase4DemoScenarios(undefined, customPresets);

    return NextResponse.json({
      scenarios,
      customPresets: attachPreparedCreativesToCustomPresets(customPresets, scenarios)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to build demo scenarios from the provided campaign presets.",
        detail: getScenarioBuildErrorDetail(error)
      },
      { status: 422 }
    );
  }
}

function attachPreparedCreativesToCustomPresets(
  customPresets: DemoPresetDraft[],
  scenarios: Phase4DemoScenario[]
): DemoPresetDraft[] {
  return customPresets.map((preset) => {
    const theme = normalizeDemoPresetId(preset.id);
    const scenario = scenarios.find((candidate) => candidate.theme === theme);

    if (!scenario?.fixture.preparedCreativeSet) {
      return preset;
    }

    return {
      ...preset,
      preparedCreativeSet: scenario.fixture.preparedCreativeSet
    };
  });
}

function getScenarioBuildErrorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : "Scenario generation failed.";

  if (message.includes("Expected eligible Phase 4 ad opportunity")) {
    return "The campaign preset was accepted, but its target policy and demo user question did not produce an eligible sponsored scenario. Use a non-sensitive English target policy with terms that overlap the offer and question.";
  }

  return message;
}
