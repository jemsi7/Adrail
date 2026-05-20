import { buildAllPhase4DemoScenarios } from "../../src/domain/demo-ux";
import { Phase4DemoApp } from "../../src/ui/phase4-demo-app";

export default function AdvertiserConsolePage() {
  const scenarios = buildAllPhase4DemoScenarios();

  return <Phase4DemoApp scenarios={scenarios} mode="advertiser-console" />;
}
