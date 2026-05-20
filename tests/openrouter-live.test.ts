import { describe, expect, it } from "vitest";
import { compilePolicyWithOpenRouter } from "../src/ai/live-llm";
import {
  callOpenRouterEmbedding,
  createJsonSchemaResponseFormat,
  resolveOpenRouterConfig
} from "../src/ai/openrouter";

describe("OpenRouter structured-output adapter", () => {
  it("compiles structured policy output and preserves deterministic sensitive-targeting guard", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              compiledSummary: "Approved live policy for workflow automation buyers.",
              safetyVerdict: "approved",
              prohibitedSensitiveSignals: [],
              requiredContextSignals: ["productivity"],
              intentKeywords: ["workflow", "automation", "security"],
              embeddingQueries: ["workflow automation security review"]
            })
          }
        }
      ]
    }), { status: 200 });
    const config = resolveOpenRouterConfig({
      apiKey: "sk-or-test",
      fetchImpl
    });

    expect(config).not.toBeNull();

    const compiled = await compilePolicyWithOpenRouter({
      config: config!,
      id: "compiled_live_test",
      campaignId: "campaign_live_test",
      sourcePolicyId: "source_policy_live_test",
      sourceText: "Reach teams evaluating workflow automation and security review readiness.",
      createdAt: "2026-05-20T06:30:00.000Z"
    });

    expect(compiled.safetyVerdict).toBe("approved");
    expect(compiled.compilerVersion).toContain("openrouter-structured-output-v1");
    expect(compiled.ast.requiredContextSignals).toContain("productivity");
    expect(compiled.policyHash).toHaveLength(64);
  });

  it("blocks live output when deterministic sensitive targeting detects a prohibited signal", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              compiledSummary: "Approved by the model.",
              safetyVerdict: "approved",
              prohibitedSensitiveSignals: [],
              requiredContextSignals: ["learning"],
              intentKeywords: ["course"],
              embeddingQueries: ["professional course"]
            })
          }
        }
      ]
    }), { status: 200 });
    const config = resolveOpenRouterConfig({
      apiKey: "sk-or-test",
      fetchImpl
    })!;
    const compiled = await compilePolicyWithOpenRouter({
      config,
      id: "compiled_live_sensitive_test",
      campaignId: "campaign_live_sensitive_test",
      sourcePolicyId: "source_policy_live_sensitive_test",
      sourceText: "Reach people with depression who are considering professional courses.",
      createdAt: "2026-05-20T06:30:00.000Z"
    });

    expect(compiled.safetyVerdict).toBe("blocked");
    expect(compiled.prohibitedSensitiveSignals).toContain("health_condition");
    expect(compiled.embeddingQueries).toEqual([]);
  });

  it("calls the embeddings endpoint through the same OpenRouter config", async () => {
    const fetchImpl = async (url: string | URL | Request) => {
      expect(String(url)).toContain("/embeddings");
      return new Response(JSON.stringify({
        data: [
          { embedding: [0.1, 0.2, 0.3] }
        ]
      }), { status: 200 });
    };
    const config = resolveOpenRouterConfig({
      apiKey: "sk-or-test",
      fetchImpl
    })!;
    const embeddings = await callOpenRouterEmbedding({
      config,
      model: "openai/text-embedding-3-small",
      input: "workflow automation security review"
    });

    expect(createJsonSchemaResponseFormat({
      name: "x",
      schema: { type: "object" }
    }).type).toBe("json_schema");
    expect(embeddings).toEqual([[0.1, 0.2, 0.3]]);
  });
});
