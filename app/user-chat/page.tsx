import { buildAllPhase4DemoScenarios } from "../../src/domain/demo-ux";
import { Phase4DemoApp } from "../../src/ui/phase4-demo-app";
import { DEFAULT_OPENROUTER_TEXT_MODEL } from "../../src/ai/live-llm";
import {
  getOpenRouterApiKeyFromEnv,
  resolveOpenRouterConfig
} from "../../src/ai/openrouter";

export default async function UserChatPage() {
  const scenarios = buildAllPhase4DemoScenarios();
  const interactiveAdModel = process.env.INTERACTIVE_AD_MODEL &&
    process.env.INTERACTIVE_AD_MODEL !== "replace_me"
    ? process.env.INTERACTIVE_AD_MODEL
    : DEFAULT_OPENROUTER_TEXT_MODEL;
  const config = resolveOpenRouterConfig({
    apiKey: getOpenRouterApiKeyFromEnv(),
    baseUrl: process.env.OPENROUTER_BASE_URL,
    appTitle: "Adrail Demo"
  });

  if (!config) {
    return (
      <Phase4DemoApp
        scenarios={scenarios}
        mode="user-chat"
        composerModelName="deterministic fixture"
      />
    );
  }

  return (
    <Phase4DemoApp
      scenarios={scenarios}
      mode="user-chat"
      openRouterLiveConfigured
      composerModelName={interactiveAdModel}
      initialCleanChatReady
    />
  );
}
