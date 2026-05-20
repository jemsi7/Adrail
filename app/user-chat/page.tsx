import { buildAllPhase4DemoScenarios } from "../../src/domain/demo-ux";
import { Phase4DemoApp } from "../../src/ui/phase4-demo-app";

export default function UserChatPage() {
  const scenarios = buildAllPhase4DemoScenarios();

  return <Phase4DemoApp scenarios={scenarios} mode="user-chat" />;
}
