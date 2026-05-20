"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DemoAdTheme, DemoPresetDraft, Phase4DemoScenario } from "../domain/demo-ux";

type PanelKey = "advertiser" | "review" | "settlement" | "script";
type AdState = "visible" | "cta" | "dismissed" | "not_relevant";
type ReviewStatus = "approved" | "rejected";
type DemoMode = "user-chat" | "advertiser-console";
type ProviderMode = "openrouter_live" | "deterministic_fixture";
type CompileStatus = "idle" | "pending" | "ready" | "stale" | "failed";
type AsyncStatus = "idle" | "pending" | "failed";
type CompilePreview = Phase4DemoScenario["advertiserConsole"]["compiledPolicy"] & {
  requiredContextSignals?: string[];
  intentKeywords?: string[];
  providerMode?: ProviderMode;
  fallbackReason?: string;
};

type CustomPresetFormState = {
  id: string;
  navigationLabel: string;
  advertiserName: string;
  campaignName: string;
  objective: string;
  productServiceSummary: string;
  naturalLanguageTargetPolicy: string;
  mustIncludeAttributes: string;
  prohibitedClaims: string;
  allowedInteractionTemplate: "choice" | "slider" | "short_text";
  ctaLabel: string;
  ctaTarget: string;
  userQuestion: string;
};

const CUSTOM_PRESETS_STORAGE_KEY = "agentic-ad-firewall-custom-presets-v1";
const OPENROUTER_KEY_STORAGE_KEY = "agentic-ad-firewall-openrouter-key-v1";
const DEFAULT_CUSTOM_FORM: CustomPresetFormState = {
  id: "custom_ai_security",
  navigationLabel: "AI Security",
  advertiserName: "GuardLayer",
  campaignName: "GuardLayer Agent Review",
  objective: "Start an agent-assisted AI security review",
  productServiceSummary: "AI security review workspace for prompt, tool, and data-flow risk checks.",
  naturalLanguageTargetPolicy: "Reach teams evaluating AI security reviews, prompt risk, tool permissions, and agent deployment readiness.",
  mustIncludeAttributes: "Prompt and tool-risk checklist\nData-flow review\nAgent deployment readiness score",
  prohibitedClaims: "guaranteed compliance\nprevents every breach",
  allowedInteractionTemplate: "choice",
  ctaLabel: "Start an AI security review",
  ctaTarget: "agent://security/review",
  userQuestion: "Can you help me check whether our internal AI agent is safe to deploy?"
};

export function Phase4DemoApp({
  scenarios: initialScenarios,
  mode
}: {
  scenarios: Phase4DemoScenario[];
  mode: DemoMode;
}) {
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [theme, setTheme] = useState<DemoAdTheme>(scenarios[0]?.theme ?? "travel");
  const [activePanel, setActivePanel] = useState<PanelKey>("advertiser");
  const [adState, setAdState] = useState<AdState>("visible");
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [interactionValue, setInteractionValue] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [providerNotice, setProviderNotice] = useState<{
    mode: ProviderMode;
    message: string;
  }>({ mode: "deterministic_fixture", message: "Fixture mode" });
  const [liveRefreshStatus, setLiveRefreshStatus] = useState<AsyncStatus>("idle");
  const [customPresets, setCustomPresets] = useState<DemoPresetDraft[]>([]);
  const [customForm, setCustomForm] = useState<CustomPresetFormState>(DEFAULT_CUSTOM_FORM);
  const [policyTextByTheme, setPolicyTextByTheme] = useState<Record<string, string>>({});
  const [compilePreviewByTheme, setCompilePreviewByTheme] = useState<Record<string, CompilePreview>>({});
  const [compileStatus, setCompileStatus] = useState<CompileStatus>("ready");
  const [compileError, setCompileError] = useState("");
  const [reviewStatusByTheme, setReviewStatusByTheme] = useState<Record<string, ReviewStatus>>({});
  const scenario = useMemo(
    () => scenarios.find((candidate) => candidate.theme === theme) ?? scenarios[0],
    [scenarios, theme]
  );

  useEffect(() => {
    const storedKey = window.sessionStorage.getItem(OPENROUTER_KEY_STORAGE_KEY);
    const storedPresets = window.localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);

    if (storedKey) {
      setOpenRouterKey(storedKey);
    }

    if (storedPresets) {
      try {
        const parsed = JSON.parse(storedPresets) as DemoPresetDraft[];
        setCustomPresets(parsed);
        void refreshScenarios(parsed);
      } catch {
        window.localStorage.removeItem(CUSTOM_PRESETS_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    setAdState("visible");
    setDisclosureOpen(false);
    setInteractionValue(scenario.adExperience.interactionValue);
    setCompileStatus("ready");
    setCompileError("");
    setLiveRefreshStatus("idle");
  }, [scenario.theme, scenario.adExperience.interactionValue]);

  const policyText =
    policyTextByTheme[scenario.theme] ??
    scenario.advertiserConsole.naturalLanguageTargetPolicySource;
  const compilePreview =
    compilePreviewByTheme[scenario.theme] ??
    scenario.advertiserConsole.compiledPolicy;
  const reviewStatus = reviewStatusByTheme[scenario.theme] ?? scenario.platformReview.reviewStatus;

  async function compilePolicy() {
    setCompileStatus("pending");
    setCompileError("");

    try {
      const response = await fetch("/api/compile-policy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(openRouterKey ? { "x-openrouter-api-key": openRouterKey } : {})
        },
        body: JSON.stringify({
          campaignId: scenario.fixture.campaign.id,
          sourcePolicyId: scenario.fixture.naturalLanguageTargetPolicy.id,
          sourceText: policyText,
          createdAt: scenario.fixture.campaign.createdAt
        })
      });

      if (!response.ok) {
        throw new Error("Policy compile failed.");
      }

      const payload = await response.json() as CompilePreview;
      setProviderNotice({
        mode: payload.providerMode ?? "deterministic_fixture",
        message: payload.fallbackReason ??
          (payload.providerMode === "openrouter_live" ? "OpenRouter live policy compile" : "Fixture policy compile")
      });
      setCompilePreviewByTheme((current) => ({
        ...current,
        [scenario.theme]: payload
      }));
      setCompileStatus("ready");
    } catch (error) {
      setCompileStatus("failed");
      setCompileError(error instanceof Error ? error.message : "Policy compile failed.");
    }
  }

  async function refreshScenarios(nextCustomPresets: DemoPresetDraft[]) {
    const response = await fetch("/api/demo-scenarios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ customPresets: nextCustomPresets })
    });

    if (!response.ok) {
      throw new Error("Failed to refresh demo scenarios.");
    }

    const payload = await response.json() as { scenarios: Phase4DemoScenario[] };
    setScenarios(payload.scenarios);
    setTheme((currentTheme) =>
      payload.scenarios.some((candidate) => candidate.theme === currentTheme)
        ? currentTheme
        : payload.scenarios[0]?.theme ?? "travel"
    );
  }

  async function addCustomPreset() {
    const preset = formStateToPreset(customForm);
    const nextPresets = [
      ...customPresets.filter((candidate) => candidate.id !== preset.id),
      preset
    ];

    setCustomPresets(nextPresets);
    window.localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(nextPresets));
    await refreshScenarios(nextPresets);
    setTheme(preset.id);
    setProviderNotice({ mode: "deterministic_fixture", message: "Custom preset ready" });
  }

  function saveOpenRouterKey(value: string) {
    setOpenRouterKey(value);

    if (value.trim()) {
      window.sessionStorage.setItem(OPENROUTER_KEY_STORAGE_KEY, value.trim());
      setProviderNotice({ mode: "openrouter_live", message: "OpenRouter key saved for this browser session" });
    } else {
      window.sessionStorage.removeItem(OPENROUTER_KEY_STORAGE_KEY);
      setProviderNotice({ mode: "deterministic_fixture", message: "Fixture mode" });
    }
  }

  async function runLiveScenario() {
    setLiveRefreshStatus("pending");
    setProviderNotice({ mode: "deterministic_fixture", message: "Refreshing scenario" });

    try {
      const response = await fetch("/api/live-scenario", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(openRouterKey ? { "x-openrouter-api-key": openRouterKey } : {})
        },
        body: JSON.stringify({
          theme: scenario.theme,
          customPresets
        })
      });

      if (!response.ok) {
        setLiveRefreshStatus("failed");
        setProviderNotice({ mode: "deterministic_fixture", message: "Live refresh failed" });
        return;
      }

      const payload = await response.json() as {
        scenario: Phase4DemoScenario;
        providerMode: ProviderMode;
        fallbackReason?: string;
      };

      setScenarios((current) =>
        current.map((candidate) =>
          candidate.theme === payload.scenario.theme ? payload.scenario : candidate
        )
      );
      setProviderNotice({
        mode: payload.providerMode,
        message: payload.fallbackReason ??
          (payload.providerMode === "openrouter_live" ? "OpenRouter live answer and ad copy" : "Fixture scenario")
      });
      setLiveRefreshStatus("idle");
    } catch {
      setLiveRefreshStatus("failed");
      setProviderNotice({ mode: "deterministic_fixture", message: "Live refresh failed" });
    }
  }

  return (
    <main className={`app-shell app-shell--${mode}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Agentic Ad Firewall</p>
          <h1>{mode === "user-chat" ? "User Chat" : "Advertiser Console"}</h1>
        </div>
        <nav className="screen-tabs" aria-label="Demo screens">
          <Link
            aria-current={mode === "user-chat" ? "page" : undefined}
            className={mode === "user-chat" ? "is-active" : ""}
            href="/user-chat"
          >
            User Chat
          </Link>
          <Link
            aria-current={mode === "advertiser-console" ? "page" : undefined}
            className={mode === "advertiser-console" ? "is-active" : ""}
            href="/advertiser-console"
          >
            Advertiser Console
          </Link>
        </nav>
        <nav className="theme-tabs" aria-label="Demo themes">
          {scenarios.map((candidate) => (
            <button
              key={candidate.theme}
              type="button"
              aria-pressed={candidate.theme === scenario.theme}
              className={candidate.theme === scenario.theme ? "is-active" : ""}
              onClick={() => setTheme(candidate.theme)}
            >
              {candidate.navigationLabel}
            </button>
          ))}
        </nav>
        <OpenRouterKeyControl
          value={openRouterKey}
          providerNotice={providerNotice}
          onSave={saveOpenRouterKey}
        />
      </header>

      {mode === "user-chat" ? (
        <UserChatPanel
          scenario={scenario}
          adState={adState}
          interactionValue={interactionValue}
          providerNotice={providerNotice}
          liveRefreshStatus={liveRefreshStatus}
          onInteractionValue={setInteractionValue}
          onCta={() => setAdState("cta")}
          onDismiss={() => setAdState("dismissed")}
          onNotRelevant={() => setAdState("not_relevant")}
          onDisclosure={() => setDisclosureOpen(true)}
          onResetAd={() => setAdState("visible")}
          onRunLive={runLiveScenario}
        />
      ) : (
        <section className="console-screen" aria-label="Advertiser console screen">
          <aside className="console-panel" aria-label="Demo consoles">
            <nav className="console-tabs" aria-label="Console panels">
              {([
                ["advertiser", "Advertiser"],
                ["review", "Review"],
                ["settlement", "Settlement"],
                ["script", "Script"]
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={activePanel === key ? "is-active" : ""}
                  aria-pressed={activePanel === key}
                  onClick={() => setActivePanel(key)}
                >
                  {label}
                </button>
              ))}
            </nav>

            {activePanel === "advertiser" ? (
              <AdvertiserConsole
                scenario={scenario}
                scenarios={scenarios}
                policyText={policyText}
                compilePreview={compilePreview}
                compileStatus={compileStatus}
                compileError={compileError}
                customForm={customForm}
                onTheme={setTheme}
                onPolicyText={(value) => {
                  setPolicyTextByTheme((current) => ({ ...current, [scenario.theme]: value }));
                  setCompileStatus("stale");
                  setCompileError("");
                }}
                onCompile={compilePolicy}
                onCustomForm={setCustomForm}
                onAddCustomPreset={addCustomPreset}
              />
            ) : null}

            {activePanel === "review" ? (
              <PlatformReviewConsole
                scenario={scenario}
                reviewStatus={reviewStatus}
                compilePreview={compilePreview}
                onReviewStatus={(status) =>
                  setReviewStatusByTheme((current) => ({ ...current, [scenario.theme]: status }))
                }
              />
            ) : null}

            {activePanel === "settlement" ? (
              <SettlementDashboard scenario={scenario} reviewStatus={reviewStatus} />
            ) : null}

            {activePanel === "script" ? (
              <DemoScript scenario={scenario} />
            ) : null}
          </aside>
        </section>
      )}

      <PrivacyDisclosureDrawer
        scenario={scenario}
        open={disclosureOpen}
        onClose={() => setDisclosureOpen(false)}
        onHide={() => {
          setAdState("dismissed");
          setDisclosureOpen(false);
        }}
        onOptOut={() => {
          setAdState("not_relevant");
          setDisclosureOpen(false);
        }}
      />
    </main>
  );
}

function OpenRouterKeyControl({
  value,
  providerNotice,
  onSave
}: {
  value: string;
  providerNotice: { mode: ProviderMode; message: string };
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <section className="key-control" aria-label="OpenRouter key">
      <label htmlFor="openrouter-key">OpenRouter key</label>
      <div>
        <input
          id="openrouter-key"
          type="password"
          value={draft}
          placeholder="sk-or-..."
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
        <button type="button" onClick={() => onSave(draft)}>
          Save
        </button>
      </div>
      <span className={`provider-mode provider-mode--${providerNotice.mode}`}>
        {providerNotice.message}
      </span>
    </section>
  );
}

function UserChatPanel({
  scenario,
  adState,
  interactionValue,
  providerNotice,
  liveRefreshStatus,
  onInteractionValue,
  onCta,
  onDismiss,
  onNotRelevant,
  onDisclosure,
  onResetAd,
  onRunLive
}: {
  scenario: Phase4DemoScenario;
  adState: AdState;
  interactionValue: string;
  providerNotice: { mode: ProviderMode; message: string };
  liveRefreshStatus: AsyncStatus;
  onInteractionValue: (value: string) => void;
  onCta: () => void;
  onDismiss: () => void;
  onNotRelevant: () => void;
  onDisclosure: () => void;
  onResetAd: () => void;
  onRunLive: () => void;
}) {
  const flowState = adState === "visible" ? "Sponsored active" : "Answer released";

  return (
    <section className="chat-panel" aria-label="User chat demo">
      <header className="panel-header">
        <div>
          <p className="eyebrow">User Chat</p>
          <h2>Pre-answer ad boundary</h2>
        </div>
        <div className="panel-actions">
          <span className="status-pill status-pill--neutral">{flowState}</span>
          <span className="status-pill">{providerNotice.mode === "openrouter_live" ? "live llm" : "fixture"}</span>
          <button
            className="small-button"
            type="button"
            disabled={liveRefreshStatus === "pending"}
            onClick={onRunLive}
          >
            {liveRefreshStatus === "pending" ? "Refreshing" : "Refresh LLM"}
          </button>
        </div>
      </header>

      <div className="chat-thread">
        <FlowSteps activeStep={adState === "visible" ? "sponsored" : "answer"} adState={adState} />
        <article className="message user-message">
          <span>User</span>
          <p>{scenario.userChat.userQuestion}</p>
        </article>

        {adState === "visible" ? (
          <SponsoredFrame
            scenario={scenario}
            interactionValue={interactionValue}
            onInteractionValue={onInteractionValue}
            onCta={onCta}
            onDismiss={onDismiss}
            onNotRelevant={onNotRelevant}
            onDisclosure={onDisclosure}
          />
        ) : (
          <ResolvedAnswer
            scenario={scenario}
            adState={adState}
            onDisclosure={onDisclosure}
            onResetAd={onResetAd}
          />
        )}
      </div>
    </section>
  );
}

function FlowSteps({
  activeStep,
  adState
}: {
  activeStep: "sponsored" | "answer";
  adState: AdState;
}) {
  const proofCopy: Record<AdState, string> = {
    visible: "Waiting",
    cta: "Proof ready",
    dismissed: "No claim",
    not_relevant: "Muted"
  };

  return (
    <ol className="flow-steps" aria-label="Answer flow status">
      <li className={activeStep === "sponsored" ? "is-active" : "is-complete"}>
        <span>1</span>
        <strong>Sponsored</strong>
        <small>{activeStep === "sponsored" ? "Active" : "Closed"}</small>
      </li>
      <li className={activeStep === "answer" ? "is-active" : ""}>
        <span>2</span>
        <strong>Answer</strong>
        <small>{activeStep === "answer" ? "Released" : "Waiting"}</small>
      </li>
      <li className={adState === "cta" ? "is-complete" : adState !== "visible" ? "is-muted" : ""}>
        <span>3</span>
        <strong>Settlement</strong>
        <small>{proofCopy[adState]}</small>
      </li>
    </ol>
  );
}

function SponsoredFrame({
  scenario,
  interactionValue,
  onInteractionValue,
  onCta,
  onDismiss,
  onNotRelevant,
  onDisclosure
}: {
  scenario: Phase4DemoScenario;
  interactionValue: string;
  onInteractionValue: (value: string) => void;
  onCta: () => void;
  onDismiss: () => void;
  onNotRelevant: () => void;
  onDisclosure: () => void;
}) {
  const interstitial = scenario.adExperience.interstitial;
  const interactionLabel = formatInteractionValue(interstitial, interactionValue);
  const headline = interactionValue
    ? `${interstitial.headline} (${interactionLabel})`
    : interstitial.headline;

  return (
    <section
      className="sponsored-frame"
      role="region"
      aria-label="Sponsored interstitial"
      data-sponsored="true"
    >
      <header className="sponsored-header">
        <div>
          <span className="sponsored-label">{interstitial.label}</span>
          <span className="advertiser-name">{interstitial.advertiserName}</span>
          <span className="status-pill status-pill--neutral">Answer paused</span>
        </div>
        <button className="small-button" type="button" onClick={onDisclosure}>
          Why this ad
        </button>
      </header>

      <h2>{headline}</h2>
      <p className="ad-body">{interstitial.body}</p>

      <ScriptedGraphic visualSpec={interstitial.visualSpec} interactionValue={interactionValue} />

      <div className="interaction-block">
        <label htmlFor="ad-interaction">{interstitial.interactionSpec.prompt}</label>
        <InteractionControl
          interstitial={interstitial}
          value={interactionValue}
          onChange={onInteractionValue}
        />
        <p className="interaction-feedback" aria-live="polite">
          Sponsored state updated for {interactionLabel}.
        </p>
      </div>

      <div className="action-row">
        <button className="primary-button" type="button" onClick={onCta}>
          {interstitial.cta.label}
        </button>
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
        <button type="button" onClick={onNotRelevant}>
          Not relevant
        </button>
      </div>
    </section>
  );
}

function InteractionControl({
  interstitial,
  value,
  onChange
}: {
  interstitial: Phase4DemoScenario["adExperience"]["interstitial"];
  value: string;
  onChange: (value: string) => void;
}) {
  if (interstitial.interactionSpec.type === "slider") {
    const max = interstitial.interactionSpec.allowedOutputs.at(-1) ?? "20";

    return (
      <div className="slider-control">
        <input
          id="ad-interaction"
          type="range"
          min="0"
          max={max}
          step="1"
          value={value}
          aria-describedby="ad-interaction-output"
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <output id="ad-interaction-output">{value} hours/week</output>
      </div>
    );
  }

  if (interstitial.interactionSpec.type === "short_text") {
    return (
      <input
        id="ad-interaction"
        type="text"
        placeholder="e.g. SOC2 review"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }

  return (
    <div className="choice-grid" id="ad-interaction">
      {interstitial.interactionSpec.allowedOutputs.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          className={value === option ? "is-selected" : ""}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function ScriptedGraphic({
  visualSpec,
  interactionValue
}: {
  visualSpec: unknown;
  interactionValue: string;
}) {
  const spec = normalizeVisualSpec(visualSpec);
  const cards = personalizeCards(spec.cards, interactionValue);

  return (
    <section className="scripted-graphic" data-theme={spec.theme}>
      <div className="graphic-heading">
        <span style={{ backgroundColor: spec.accentColor }} />
        <h3>{spec.headlineAnchor}</h3>
      </div>
      <div className="graphic-cards">
        {cards.map((card, index) => (
          <article key={card.title} className={index === 0 && interactionValue ? "is-personalized" : ""}>
            <strong>{card.title}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>
      <p className="interaction-preview">
        {spec.interactionPreview.prompt}: {interactionValue || spec.interactionPreview.options[0]}
      </p>
      {interactionValue ? (
        <p className="interaction-impact">Generated ad state now prioritizes {interactionValue}.</p>
      ) : null}
    </section>
  );
}

function ResolvedAnswer({
  scenario,
  adState,
  onDisclosure,
  onResetAd
}: {
  scenario: Phase4DemoScenario;
  adState: AdState;
  onDisclosure: () => void;
  onResetAd: () => void;
}) {
  const outcome = getAdOutcome(scenario, adState);

  return (
    <>
      <article className="message system-message">
        <span>Service Answer</span>
        <p>{scenario.userChat.serviceAnswer}</p>
      </article>
      <article className="message followup-message">
        <span>Follow-up</span>
        <p>{scenario.userChat.followUpQuestion}</p>
      </article>
      <div className={`attention-strip attention-strip--${outcome.tone}`}>
        <div>
          <strong>{outcome.title}</strong>
          <p>{outcome.detail}</p>
        </div>
        <span>{outcome.scoreLabel}</span>
        <code>{outcome.hashLabel}</code>
      </div>
      <div className="answer-actions">
        <button className="small-button" type="button" onClick={onDisclosure}>
          View ad disclosure
        </button>
        <button className="small-button" type="button" onClick={onResetAd}>
          Undo close
        </button>
      </div>
    </>
  );
}

function AdvertiserConsole({
  scenario,
  scenarios,
  policyText,
  compilePreview,
  compileStatus,
  compileError,
  customForm,
  onTheme,
  onPolicyText,
  onCompile,
  onCustomForm,
  onAddCustomPreset
}: {
  scenario: Phase4DemoScenario;
  scenarios: Phase4DemoScenario[];
  policyText: string;
  compilePreview: CompilePreview;
  compileStatus: CompileStatus;
  compileError: string;
  customForm: CustomPresetFormState;
  onTheme: (theme: DemoAdTheme) => void;
  onPolicyText: (value: string) => void;
  onCompile: () => void;
  onCustomForm: (value: CustomPresetFormState) => void;
  onAddCustomPreset: () => void;
}) {
  return (
    <section className="console-section" aria-label="Advertiser console">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Advertiser Console</p>
          <h2>{scenario.advertiserConsole.campaignName}</h2>
        </div>
        <span className="status-pill">{scenario.advertiserConsole.campaignStatus}</span>
      </header>

      <dl className="workflow-strip">
        <div>
          <dt>Policy</dt>
          <dd>{getCompileStatusCopy(compileStatus).label}</dd>
        </div>
        <div>
          <dt>Safety</dt>
          <dd>{formatSafetyVerdict(compilePreview.safetyVerdict)}</dd>
        </div>
        <div>
          <dt>Settlement</dt>
          <dd>{formatBps(scenario.advertiserConsole.settlementPolicySummary.thresholdBps)} threshold</dd>
        </div>
      </dl>

      <div className="seed-list">
        {scenarios.map((candidate) => (
          <button
            key={candidate.theme}
            type="button"
            aria-pressed={candidate.theme === scenario.theme}
            className={candidate.theme === scenario.theme ? "is-active" : ""}
            onClick={() => onTheme(candidate.theme)}
          >
            <span>{candidate.navigationLabel}</span>
            <strong>{candidate.advertiserConsole.advertiserName}</strong>
          </button>
        ))}
      </div>

      <label className="field-label" htmlFor="policy-source">
        Natural-language target policy
      </label>
      <textarea
        id="policy-source"
        value={policyText}
        onChange={(event) => onPolicyText(event.currentTarget.value)}
        rows={5}
      />
      <div className="action-row compact">
        <button
          className="primary-button"
          type="button"
          disabled={compileStatus === "pending"}
          onClick={onCompile}
        >
          {compileStatus === "pending" ? "Compiling" : "Compile policy"}
        </button>
        <span className={`compile-status compile-status--${compileStatus}`}>
          {getCompileStatusCopy(compileStatus).label}
        </span>
      </div>
      <p className={`inline-help ${compileStatus === "failed" ? "inline-help--error" : ""}`} aria-live="polite">
        {compileStatus === "failed"
          ? compileError || "Policy compile failed. Check the policy text and try again."
          : getCompileStatusCopy(compileStatus).detail}
      </p>

      <section className="preview-block">
        <p className="eyebrow">Compiled Policy Preview</p>
        <p>{compilePreview.compiledSummary}</p>
        <dl className="metric-grid">
          <div>
            <dt>Safety</dt>
            <dd>{formatSafetyVerdict(compilePreview.safetyVerdict)}</dd>
          </div>
          <div>
            <dt>Policy hash</dt>
            <dd><code>{shortHash(compilePreview.policyHash)}</code></dd>
          </div>
          <div>
            <dt>Threshold</dt>
            <dd>{formatBps(scenario.advertiserConsole.settlementPolicySummary.thresholdBps)}</dd>
          </div>
          <div>
            <dt>Spend</dt>
            <dd>{formatCents(scenario.advertiserConsole.aggregateMetrics.spendCents)}</dd>
          </div>
        </dl>
      </section>

      <CustomPresetBuilder
        value={customForm}
        onChange={onCustomForm}
        onAdd={onAddCustomPreset}
      />
    </section>
  );
}

function CustomPresetBuilder({
  value,
  onChange,
  onAdd
}: {
  value: CustomPresetFormState;
  onChange: (value: CustomPresetFormState) => void;
  onAdd: () => void;
}) {
  const canAddPreset = [
    value.id,
    value.navigationLabel,
    value.advertiserName,
    value.campaignName,
    value.objective,
    value.naturalLanguageTargetPolicy,
    value.mustIncludeAttributes,
    value.ctaLabel,
    value.userQuestion
  ].every((item) => item.trim().length > 0);

  function update(key: keyof CustomPresetFormState, nextValue: string) {
    onChange({
      ...value,
      [key]: nextValue
    });
  }

  return (
    <section className="preset-builder">
      <header>
        <p className="eyebrow">Demo Preset Builder</p>
        <h3>Add a fourth campaign</h3>
      </header>
      <div className="form-grid">
        <label>
          Preset id
          <input value={value.id} onChange={(event) => update("id", event.currentTarget.value)} />
        </label>
        <label>
          Tab label
          <input value={value.navigationLabel} onChange={(event) => update("navigationLabel", event.currentTarget.value)} />
        </label>
        <label>
          Advertiser
          <input value={value.advertiserName} onChange={(event) => update("advertiserName", event.currentTarget.value)} />
        </label>
        <label>
          Campaign
          <input value={value.campaignName} onChange={(event) => update("campaignName", event.currentTarget.value)} />
        </label>
      </div>
      <label className="field-label">
        Objective
        <input value={value.objective} onChange={(event) => update("objective", event.currentTarget.value)} />
      </label>
      <label className="field-label">
        Product summary
        <textarea
          value={value.productServiceSummary}
          rows={3}
          onChange={(event) => update("productServiceSummary", event.currentTarget.value)}
        />
      </label>
      <label className="field-label">
        Natural-language target policy
        <textarea
          value={value.naturalLanguageTargetPolicy}
          rows={3}
          onChange={(event) => update("naturalLanguageTargetPolicy", event.currentTarget.value)}
        />
      </label>
      <div className="form-grid">
        <label>
          Must-include attributes
          <textarea
            value={value.mustIncludeAttributes}
            rows={4}
            onChange={(event) => update("mustIncludeAttributes", event.currentTarget.value)}
          />
        </label>
        <label>
          Prohibited claims
          <textarea
            value={value.prohibitedClaims}
            rows={4}
            onChange={(event) => update("prohibitedClaims", event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="form-grid">
        <label>
          Interaction
          <select
            value={value.allowedInteractionTemplate}
            onChange={(event) => update("allowedInteractionTemplate", event.currentTarget.value)}
          >
            <option value="choice">Choice</option>
            <option value="slider">Slider</option>
            <option value="short_text">Short text</option>
          </select>
        </label>
        <label>
          CTA label
          <input value={value.ctaLabel} onChange={(event) => update("ctaLabel", event.currentTarget.value)} />
        </label>
        <label>
          CTA target
          <input value={value.ctaTarget} onChange={(event) => update("ctaTarget", event.currentTarget.value)} />
        </label>
      </div>
      <label className="field-label">
        Demo user question
        <input value={value.userQuestion} onChange={(event) => update("userQuestion", event.currentTarget.value)} />
      </label>
      <div className="action-row">
        <button className="primary-button" type="button" disabled={!canAddPreset} onClick={onAdd}>
          Add preset
        </button>
        {!canAddPreset ? <span className="inline-help inline-help--error">Fill required preset fields first.</span> : null}
      </div>
    </section>
  );
}

function PlatformReviewConsole({
  scenario,
  reviewStatus,
  compilePreview,
  onReviewStatus
}: {
  scenario: Phase4DemoScenario;
  reviewStatus: ReviewStatus;
  compilePreview: CompilePreview;
  onReviewStatus: (status: ReviewStatus) => void;
}) {
  const signals = compilePreview.requiredContextSignals ??
    scenario.platformReview.requiredContextSignals;
  const keywords = compilePreview.intentKeywords ??
    scenario.platformReview.intentKeywords;

  return (
    <section className="console-section" aria-label="Platform review console">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Platform Review</p>
          <h2>Policy and claim review</h2>
        </div>
        <span className={`status-pill status-pill--${reviewStatus}`}>{reviewStatus}</span>
      </header>

      {reviewStatus === "rejected" ? (
        <div className="notice notice--danger" role="status">
          Rejected campaigns cannot serve new sponsored frames or create settlement claims until approved again.
        </div>
      ) : (
        <div className="notice" role="status">
          Approved campaign can serve the sponsored frame and submit attention proofs.
        </div>
      )}

      <dl className="review-grid">
        <div>
          <dt>Context signals</dt>
          <dd>{signals.length > 0 ? signals.join(", ") : "None"}</dd>
        </div>
        <div>
          <dt>Intent keywords</dt>
          <dd>{keywords.slice(0, 6).join(", ")}</dd>
        </div>
        <div>
          <dt>Privacy boundary</dt>
          <dd>{formatPrivacyBoundary(scenario.platformReview.privacyBoundary)}</dd>
        </div>
        <div>
          <dt>Sensitive targeting</dt>
          <dd>{formatSafetyVerdict(compilePreview.safetyVerdict)}</dd>
        </div>
      </dl>

      <section className="claim-block">
        <h3>Approved claim set</h3>
        <ul>
          {scenario.platformReview.mustIncludeAttributes.map((attribute) => (
            <li key={attribute}>{attribute}</li>
          ))}
        </ul>
      </section>

      <section className="claim-block muted">
        <h3>Prohibited claims</h3>
        <ul>
          {scenario.platformReview.prohibitedClaims.map((claim) => (
            <li key={claim}>{claim}</li>
          ))}
        </ul>
      </section>

      <div className="action-row">
        <button
          className="primary-button"
          type="button"
          aria-pressed={reviewStatus === "approved"}
          onClick={() => onReviewStatus("approved")}
        >
          Approve
        </button>
        <button
          type="button"
          aria-pressed={reviewStatus === "rejected"}
          onClick={() => onReviewStatus("rejected")}
        >
          Reject
        </button>
      </div>
    </section>
  );
}

function SettlementDashboard({
  scenario,
  reviewStatus
}: {
  scenario: Phase4DemoScenario;
  reviewStatus: ReviewStatus;
}) {
  const dashboard = scenario.settlementDashboard;
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const isBlocked = reviewStatus === "rejected";

  async function copyTransactionHash() {
    try {
      await navigator.clipboard.writeText(dashboard.transactionHash);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <section className="console-section" aria-label="Settlement dashboard">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Settlement Dashboard</p>
          <h2>{isBlocked ? "blocked by review" : formatSettlementStatus(dashboard.settlementEvent.status)}</h2>
        </div>
        <span className={`status-pill ${isBlocked ? "status-pill--rejected" : ""}`}>
          {isBlocked ? "blocked" : "testnet"}
        </span>
      </header>

      <div className={isBlocked ? "notice notice--danger" : "notice"} role="status">
        {isBlocked
          ? "No settlement claim should be submitted while this campaign is rejected."
          : "Attention score passed the campaign threshold and produced a testnet-style settlement proof."}
      </div>

      <dl className="metric-grid metric-grid--wide">
        <div>
          <dt>Attention score</dt>
          <dd>{formatBps(dashboard.attentionEvent.scoreBps)}</dd>
        </div>
        <div>
          <dt>Threshold</dt>
          <dd>{formatBps(dashboard.attentionEvent.thresholdBps)}</dd>
        </div>
        <div>
          <dt>Transaction hash</dt>
          <dd className="hash-row">
            <code>{isBlocked ? "No transaction" : shortHash(dashboard.transactionHash)}</code>
            <button className="small-button" type="button" disabled={isBlocked} onClick={copyTransactionHash}>
              Copy
            </button>
          </dd>
        </div>
        <div>
          <dt>Contract event</dt>
          <dd>{isBlocked ? "Not submitted" : dashboard.contractEventStatus}</dd>
        </div>
      </dl>
      <p className={`inline-help ${copyStatus === "failed" ? "inline-help--error" : ""}`} aria-live="polite">
        {copyStatus === "copied"
          ? "Transaction hash copied."
          : copyStatus === "failed"
            ? "Copy failed. Expand the full hash below."
            : isBlocked
              ? "Approve the campaign before submitting a settlement transaction."
              : "Use the hash to verify the settlement proof during the demo."}
      </p>

      <section className="contribution-list">
        <h3>Attention signals</h3>
        {dashboard.contributionRows.map((row) => (
          <div key={row.signalType} className="contribution-row">
            <span>{row.signalType.replaceAll("_", " ")}</span>
            <meter min={0} max={10000} value={row.contributionBps} />
            <strong>{formatBps(row.contributionBps)}</strong>
          </div>
        ))}
      </section>

      <section className="preview-block">
        <p className="eyebrow">Context Retention Evidence</p>
        <p>{dashboard.contextRetentionEvidence.rationale}</p>
        <dl className="proof-grid">
          <div>
            <dt>Policy hash</dt>
            <dd><code>{shortHash(dashboard.settlementProof.settlementPolicyHash)}</code></dd>
          </div>
          <div>
            <dt>Proof hash</dt>
            <dd><code>{shortHash(dashboard.settlementProof.proofHash)}</code></dd>
          </div>
        </dl>
        {!isBlocked ? (
          <details className="hash-details">
            <summary>Full transaction hash</summary>
            <code>{dashboard.transactionHash}</code>
          </details>
        ) : null}
      </section>
    </section>
  );
}

function DemoScript({
  scenario
}: {
  scenario: Phase4DemoScenario;
}) {
  return (
    <section className="console-section" aria-label="Demo script">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Demo Script</p>
          <h2>One-minute judge path</h2>
        </div>
      </header>

      <ol className="script-list">
        {scenario.demoScript.map((step) => (
          <li key={step.timestamp}>
            <time>{step.timestamp}</time>
            <div>
              <strong>{step.title}</strong>
              <p>{step.line}</p>
              <span>{step.proofPoint}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PrivacyDisclosureDrawer({
  scenario,
  open,
  onClose,
  onHide,
  onOptOut
}: {
  scenario: Phase4DemoScenario;
  open: boolean;
  onClose: () => void;
  onHide: () => void;
  onOptOut: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="drawer-layer is-open"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
        }
      }}
    >
      <button className="drawer-scrim" type="button" onClick={onClose} aria-label="Close disclosure" />
      <aside className="privacy-drawer" role="dialog" aria-modal="true" aria-label="Ad disclosure">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Ad Disclosure</p>
            <h2>{scenario.adExperience.interstitial.advertiserName}</h2>
          </div>
          <button ref={closeButtonRef} className="small-button" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <ul>
          {scenario.adExperience.disclosureLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="action-row">
          <button className="primary-button" type="button" onClick={onOptOut}>
            Category opt-out
          </button>
          <button type="button" onClick={onHide}>
            Hide this ad
          </button>
        </div>
      </aside>
    </div>
  );
}

function normalizeVisualSpec(visualSpec: unknown) {
  const candidate = visualSpec && typeof visualSpec === "object"
    ? visualSpec as {
      theme?: string;
      accentColor?: string;
      headlineAnchor?: string;
      cards?: Array<{ title?: string; detail?: string }>;
      interactionPreview?: { prompt?: string; options?: string[] };
    }
    : {};

  return {
    theme: candidate.theme ?? "general",
    accentColor: candidate.accentColor ?? "#334155",
    headlineAnchor: candidate.headlineAnchor ?? "Sponsored option",
    cards: Array.isArray(candidate.cards) && candidate.cards.length > 0
      ? candidate.cards.map((card) => ({
        title: String(card.title ?? "Approved attribute"),
        detail: String(card.detail ?? "Included from the campaign brief.")
      }))
      : [{ title: "Approved attribute", detail: "Included from the campaign brief." }],
    interactionPreview: {
      prompt: candidate.interactionPreview?.prompt ?? "Choose what to personalize",
      options: candidate.interactionPreview?.options ?? ["Compare", "Continue"]
    }
  };
}

function personalizeCards(cards: Array<{ title: string; detail: string }>, interactionValue: string) {
  if (!interactionValue) {
    return cards;
  }

  return cards.map((card, index) => ({
    ...card,
    detail: index === 0
      ? `Prioritized for ${interactionValue}; ${card.detail}`
      : card.detail
  }));
}

function getAdOutcome(scenario: Phase4DemoScenario, adState: AdState) {
  if (adState === "cta") {
    return {
      title: "CTA verified as an agent deep-link",
      detail: "The user chose the sponsored CTA, so attention proof can be submitted.",
      scoreLabel: `${formatBps(scenario.settlementDashboard.attentionEvent.scoreBps)} attention score`,
      hashLabel: shortHash(scenario.settlementDashboard.transactionHash),
      tone: "success"
    };
  }

  if (adState === "not_relevant") {
    return {
      title: "Category marked as not relevant",
      detail: "The answer is released, but this category is muted and no settlement claim is submitted.",
      scoreLabel: "No claim",
      hashLabel: "category muted",
      tone: "muted"
    };
  }

  return {
    title: "Sponsored frame dismissed",
    detail: "The answer is released without a CTA signal, so the demo keeps settlement unsubmitted.",
    scoreLabel: "No claim",
    hashLabel: "dismissed",
    tone: "neutral"
  };
}

function getCompileStatusCopy(status: CompileStatus) {
  const copy: Record<CompileStatus, { label: string; detail: string }> = {
    idle: {
      label: "Not compiled",
      detail: "Compile the policy before review."
    },
    pending: {
      label: "Compiling",
      detail: "The platform is checking safety and producing an auditable policy preview."
    },
    ready: {
      label: "Preview ready",
      detail: "The compiled preview matches the current policy text."
    },
    stale: {
      label: "Preview stale",
      detail: "Policy text changed. Recompile before approval or settlement review."
    },
    failed: {
      label: "Compile failed",
      detail: "Check the policy text and try again."
    }
  };

  return copy[status];
}

function formatSafetyVerdict(value: string): string {
  const copy: Record<string, string> = {
    approved: "Approved",
    blocked: "Blocked",
    needs_review: "Needs review"
  };

  return copy[value] ?? value;
}

function formatPrivacyBoundary(value: string): string {
  const copy: Record<string, string> = {
    platform_private_matching: "Matched privately by the platform"
  };

  return copy[value] ?? value.replaceAll("_", " ");
}

function formatSettlementStatus(value: string): string {
  const copy: Record<string, string> = {
    settled: "Settlement complete",
    pending: "Settlement pending",
    rejected: "Settlement rejected"
  };

  return copy[value] ?? value.replaceAll("_", " ");
}

function formatInteractionValue(
  interstitial: Phase4DemoScenario["adExperience"]["interstitial"],
  value: string
): string {
  if (!value) {
    return interstitial.interactionSpec.allowedOutputs[0] ?? "current choice";
  }

  return interstitial.interactionSpec.type === "slider" ? `${value} hours/week` : value;
}

function formatBps(value: number): string {
  return `${(value / 100).toFixed(0)}%`;
}

function formatCents(value: number): string {
  return `$${(value / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function shortHash(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formStateToPreset(value: CustomPresetFormState): DemoPresetDraft {
  return {
    id: value.id.trim(),
    navigationLabel: value.navigationLabel.trim(),
    advertiserName: value.advertiserName.trim(),
    campaignName: value.campaignName.trim(),
    objective: value.objective.trim(),
    productServiceSummary: value.productServiceSummary.trim(),
    naturalLanguageTargetPolicy: value.naturalLanguageTargetPolicy.trim(),
    mustIncludeAttributes: splitLines(value.mustIncludeAttributes),
    prohibitedClaims: splitLines(value.prohibitedClaims),
    allowedInteractionTemplates: [value.allowedInteractionTemplate],
    ctaLabel: value.ctaLabel.trim(),
    ctaTarget: value.ctaTarget.trim(),
    userQuestion: value.userQuestion.trim(),
    currentNeedSummary: `User is considering ${value.productServiceSummary.trim()}.`,
    intentTags: splitWords(value.naturalLanguageTargetPolicy).slice(0, 8)
  };
}

function splitLines(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitWords(value: string): string[] {
  const stopWords = new Set(["and", "for", "the", "with", "reach", "teams", "people", "users"]);

  return [...new Set(value.toLowerCase().match(/[a-z][a-z0-9-]+/g) ?? [])]
    .filter((word) => word.length >= 4 && !stopWords.has(word));
}
