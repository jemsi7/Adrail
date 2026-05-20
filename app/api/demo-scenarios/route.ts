import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAllPhase4DemoScenarios } from "../../../src/domain/demo-ux";

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

  return NextResponse.json({
    scenarios: buildAllPhase4DemoScenarios(undefined, parsed.data.customPresets)
  });
}
