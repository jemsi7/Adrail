import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DEFAULT_OPENROUTER_TEXT_MODEL,
  streamAnswerWithOpenRouter
} from "../../../src/ai/live-llm";
import {
  getOpenRouterApiKeyFromEnv,
  resolveOpenRouterConfig
} from "../../../src/ai/openrouter";
import { buildPhase4DemoScenario } from "../../../src/domain/demo-ux";
import { demoPresetDraftSchema, sanitizeDemoPresetDrafts } from "../../../src/domain/demo-presets";

const requestSchema = z.object({
  theme: z.string().min(1),
  customPresets: z.array(demoPresetDraftSchema).default([]),
  userQuestion: z.string().min(1).optional()
}).strict();

type AnswerStreamPayload =
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; providerMode: "openrouter_live" | "deterministic_fixture" }
  | { type: "error"; message: string; providerMode: "openrouter_live" | "deterministic_fixture" };

const encoder = new TextEncoder();

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid live answer payload.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  let scenario: ReturnType<typeof buildPhase4DemoScenario>;
  const customPresets = sanitizeDemoPresetDrafts(parsed.data.customPresets);

  try {
    scenario = buildPhase4DemoScenario({
      theme: parsed.data.theme,
      customPresets
    });
    scenario = withSubmittedUserQuestion(scenario, parsed.data.userQuestion);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to build live answer scenario from the provided campaign preset.",
        providerMode: "deterministic_fixture",
        fallbackReason: error instanceof Error ? error.message : "Scenario generation failed."
      },
      { status: 422 }
    );
  }

  const config = resolveOpenRouterConfig({
    apiKey: getOpenRouterApiKeyFromEnv(),
    baseUrl: process.env.OPENROUTER_BASE_URL,
    appTitle: "Adrail Demo"
  });
  const model = process.env.ANSWER_MODEL &&
    process.env.ANSWER_MODEL !== "replace_me"
    ? process.env.ANSWER_MODEL
    : DEFAULT_OPENROUTER_TEXT_MODEL;

  return new Response(new ReadableStream({
    async start(controller) {
      if (!config) {
        await streamDeterministicFixtureAnswer(controller, scenario.userChat.serviceAnswer);
        controller.close();
        return;
      }

      try {
        let finalAnswer = "";

        for await (const event of streamAnswerWithOpenRouter({
          config,
          model,
          userQuestion: scenario.userChat.userQuestion,
          retrievalSafeSummary: scenario.userChat.retrievalSafeSummary
        })) {
          if (event.type === "delta") {
            controller.enqueue(encodeSse({ type: "delta", text: event.text }));
          } else {
            finalAnswer = event.answer;
          }
        }

        controller.enqueue(encodeSse({
          type: "done",
          answer: finalAnswer,
          providerMode: "openrouter_live"
        }));
      } catch (error) {
        controller.enqueue(encodeSse({
          type: "error",
          message: error instanceof Error ? error.message : "OpenRouter live answer stream failed.",
          providerMode: "openrouter_live"
        }));
      } finally {
        controller.close();
      }
    }
  }), {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}

async function streamDeterministicFixtureAnswer(
  controller: ReadableStreamDefaultController<Uint8Array>,
  answer: string
) {
  for (const chunk of answer.match(/\S+\s*/g) ?? [answer]) {
    controller.enqueue(encodeSse({ type: "delta", text: chunk }));
  }

  controller.enqueue(encodeSse({
    type: "done",
    answer,
    providerMode: "deterministic_fixture"
  }));
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

function encodeSse(payload: AnswerStreamPayload): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}
