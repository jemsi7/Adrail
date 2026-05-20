"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { DemoAdTheme, Phase4DemoScenario } from "../domain/demo-ux";
import type { AdvertiserFundingDashboard } from "../domain/advertiser-funding";
import {
  hasSameDemoPresetCampaignName,
  isReservedDemoPresetId,
  isReservedDemoPresetCampaignName,
  normalizeDemoPresetId,
  sanitizeDemoPresetDrafts,
  type DemoPresetDraft
} from "../domain/demo-presets";
import type { EscrowLedgerEntry } from "../domain/schemas";
import { LIVE_ANSWER_ERROR_MESSAGE } from "./live-answer-error";
import {
  createRuntimePerformanceMeasurement,
  isRuntimePerformanceMeasurement,
  updateRuntimePerformanceWithFollowUp,
  type RuntimePerformanceMeasurement
} from "./runtime-performance";

type AdvertiserConsoleStep = "overview" | "create" | "targeting" | "creative";
type ConsoleStep = AdvertiserConsoleStep | "review" | "performance" | "settlement";
type AdState = "visible" | "cta" | "dismissed" | "not_relevant";
type ReviewStatus = "approved" | "rejected";
type DemoMode = "user-chat" | "advertiser-console";
type ProviderMode = "openrouter_live" | "deterministic_fixture";
export type MatchingMode = "fast" | "professional";
type CompileStatus = "idle" | "pending" | "ready" | "stale" | "failed";
type AsyncStatus = "idle" | "pending" | "failed";
type AnswerStreamStatus = "idle" | "pending" | "complete" | "failed";
type FundingStatus = "idle" | "pending" | "confirmed" | "failed";
type CompilePreview = Phase4DemoScenario["advertiserConsole"]["compiledPolicy"] & {
  requiredContextSignals?: string[];
  intentKeywords?: string[];
  providerMode?: ProviderMode;
  fallbackReason?: string;
};

type AnswerStreamState = {
  status: AnswerStreamStatus;
  text: string;
};

type AnswerStreamPayload =
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; providerMode: ProviderMode }
  | { type: "error"; message: string; providerMode: ProviderMode };
type FundingDashboardFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type CustomPresetFormState = {
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

export type CustomPresetBuilderStep = "basics" | "offer" | "creative" | "delivery";

const CUSTOM_PRESETS_STORAGE_KEY = "adrail-custom-presets-v1";
const ACTIVE_PRESET_STORAGE_KEY = "adrail-active-preset-v1";
const ACTIVE_CAMPAIGN_THEMES_STORAGE_KEY = "adrail-active-campaign-themes-v1";
const MATCHING_MODES_STORAGE_KEY = "adrail-matching-modes-v1";
const MEASURED_PERFORMANCE_STORAGE_KEY = "adrail-measured-performance-v1";
const EMPTY_ANSWER_STREAM: AnswerStreamState = {
  status: "idle",
  text: ""
};

export const PROTOCOL_CAMP_CUSTOM_FORM: CustomPresetFormState = {
  id: "PC-1a",
  navigationLabel: "1a-1a",
  advertiserName: "Shard Lab",
  campaignName: "Protocol Camp",
  objective: "to promote Shard Lab's new bootcamp Protocol Camp",
  productServiceSummary: [
    "Protocol Camp is a 12-week intensive Web3 builder bootcamp launched in February 2022 by Hashed and Hanwha Life to lower entry barriers into the blockchain industry and build a peer community.",
    "The program welcomes developers and designers and product managers and business planners and founders. It is not only for technical talent.",
    "The current Southeast Asia and APAC format selects a small cohort of roughly 20 participants for bi-weekly advising and continuous feedback and team formation across Bangkok plus Chiang Mai plus Singapore.",
    "Participants may apply solo or as a team. AI-assisted coding teams can have 1-2 people and traditional coding teams can have up to 3 people."
  ].join("\n"),
  naturalLanguageTargetPolicy: [
    "Reach high-potential builders across Southeast Asia and Korea and broader APAC who are actively exploring Web3 infrastructure and blockchain products and AI-assisted coding.",
    "Technical Builders segment includes blockchain developers and smart contract developers and protocol engineers and full-stack Web3 developers and AI-assisted coding practitioners and low-level infrastructure builders.",
    "Product & Design Professionals segment includes product managers with blockchain interest and UX/UI designers transitioning to Web3 and protocol architects.",
    "Entrepreneurial Track segment includes startup founders with blockchain product ideas and business planners and strategists and aspiring Web3 entrepreneurs.",
    "Career Transitioners segment includes Web2 engineers pivoting to Web3 and junior builders from traditional tech backgrounds and career changers seeking hands-on blockchain learning.",
    "Prioritize junior to medium builders and aspiring builders with proven execution ability and protocol literacy and high-velocity iteration capacity.",
    "Strong context signals include Web3 bootcamp and protocol infrastructure and smart contracts and blockchain architecture and cryptographic systems and product-market fit and founder ideas and Bangkok and Singapore and Chiang Mai and Southeast Asia and Korea and APAC."
  ].join("\n"),
  mustIncludeAttributes: [
    "Not a hackathon: 12-week intensive with time to validate ideas and test real-world scenarios and build something meaningful",
    "Venture-backed infrastructure: backed by Hashed and Hanwha Life with Asia expansion through SCBX partnership",
    "Proven alumni track record: 69 graduates across 6 Korea cohorts and 21 blockchain products incubated",
    "Credible career outcomes: alumni at Solana Foundation and TON Foundation and Hashed Open Research and Modhaus and AWS and BCG",
    "Selective and rigorous: approximately 20 participants with protocol literacy and high-velocity iteration and quality over volume",
    "Infrastructure-first philosophy: smart contracts and blockchain architecture and cryptographic systems and low-level protocol development",
    "Multi-stakeholder ecosystem: AMAs and networking and access to foundation members and VCs and protocol teams and Hashed portfolio companies and Hanwha partners",
    "Pan-Asian momentum: Southeast Asia launch in 2024 and unified APAC format announced for 2025 across Bangkok and Singapore and Chiang Mai",
    "Community over education: peer cohort and ecosystem entry pass and not just a course",
    "Open to developers and designers and product managers and business planners and founders"
  ].join("\n"),
  prohibitedClaims: [
    "Do not guarantee funding or Series A investment or token launch or VC backing or placement or direct Solana/TON investment",
    "Do not claim every graduate succeeds or imply past alumni success predicts each applicant outcome",
    "Do not call Protocol Camp a complete Web3 academy or formal credential or ongoing school",
    "Do not claim apply from anywhere with no friction or zero barrier to entry",
    "Do not hide that Hashed is a VC with investment thesis bias and ecosystem incentives",
    "Do not promise a production-grade blockchain product in 12 weeks",
    "Do not imply Southeast Asia cohorts have the same maturity or track record as Korea cohorts",
    "Do not use elitist messaging around only 20 accepted as the sales hook",
    "Do not promise participants become protocol experts and frame it as protocol literacy",
    "Do not compare it as better than traditional Web2 bootcamps"
  ].join("\n"),
  allowedInteractionTemplate: "choice",
  ctaLabel: "Apply to Protocol Camp",
  ctaTarget: "agent://protocol-camp/apply",
  userQuestion: "I am a Web2 engineer planning a professional transition into Web3 infrastructure and AI-assisted coding. Is Protocol Camp a good way to validate a blockchain product idea?"
};

export const DEFAULT_CUSTOM_FORM: CustomPresetFormState = PROTOCOL_CAMP_CUSTOM_FORM;

const CONSOLE_STEPS: Array<{
  key: ConsoleStep;
  label: string;
  detail: string;
}> = [
  { key: "overview", label: "Campaigns", detail: "Select" },
  { key: "create", label: "Create", detail: "Brief" },
  { key: "targeting", label: "Targeting", detail: "Compile" },
  { key: "creative", label: "Creative", detail: "Claims" },
  { key: "review", label: "Review", detail: "Approval" },
  { key: "performance", label: "Performance", detail: "Signals" },
  { key: "settlement", label: "Settlement", detail: "Proof" }
];

const CUSTOM_PRESET_STEPS: Array<{
  key: CustomPresetBuilderStep;
  label: string;
  detail: string;
  requiredFields: Array<keyof CustomPresetFormState>;
}> = [
  {
    key: "basics",
    label: "Basics",
    detail: "Identity",
    requiredFields: ["id", "navigationLabel", "advertiserName", "campaignName", "objective"]
  },
  {
    key: "offer",
    label: "Offer",
    detail: "Targeting",
    requiredFields: ["productServiceSummary", "naturalLanguageTargetPolicy"]
  },
  {
    key: "creative",
    label: "Creative",
    detail: "Boundaries",
    requiredFields: ["mustIncludeAttributes"]
  },
  {
    key: "delivery",
    label: "Delivery",
    detail: "CTA",
    requiredFields: ["ctaLabel", "ctaTarget", "userQuestion"]
  }
];

export function Phase4DemoApp({
  scenarios: initialScenarios,
  mode,
  openRouterLiveConfigured = false,
  composerModelName = openRouterLiveConfigured ? "openai/gpt-4.1-mini" : "deterministic fixture",
  initialAnswerError = "",
  initialCleanChatReady = false
}: {
  scenarios: Phase4DemoScenario[];
  mode: DemoMode;
  openRouterLiveConfigured?: boolean;
  composerModelName?: string;
  initialAnswerError?: string;
  initialCleanChatReady?: boolean;
}) {
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [theme, setTheme] = useState<DemoAdTheme>(scenarios[0]?.theme ?? "travel");
  const [activeConsoleStep, setActiveConsoleStep] = useState<ConsoleStep>("overview");
  const [adState, setAdState] = useState<AdState>("visible");
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [interactionValue, setInteractionValue] = useState("");
  const [liveRefreshStatus, setLiveRefreshStatus] = useState<AsyncStatus>("idle");
  const [newChatNoticeOpen, setNewChatNoticeOpen] = useState(false);
  const [cleanChatReady, setCleanChatReady] = useState(initialCleanChatReady);
  const [customPresets, setCustomPresets] = useState<DemoPresetDraft[]>([]);
  const [customForm, setCustomForm] = useState<CustomPresetFormState>(DEFAULT_CUSTOM_FORM);
  const [customPresetError, setCustomPresetError] = useState("");
  const [campaignDeleteNotice, setCampaignDeleteNotice] = useState("");
  const [policyTextByTheme, setPolicyTextByTheme] = useState<Record<string, string>>({});
  const [compilePreviewByTheme, setCompilePreviewByTheme] = useState<Record<string, CompilePreview>>({});
  const [compileStatusByTheme, setCompileStatusByTheme] = useState<Record<string, CompileStatus>>({});
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [matchingModeByTheme, setMatchingModeByTheme] = useState<Record<string, MatchingMode>>({});
  const [compileError, setCompileError] = useState("");
  const [reviewStatusByTheme, setReviewStatusByTheme] = useState<Record<string, ReviewStatus>>({});
  const [submittedQuestionByTheme, setSubmittedQuestionByTheme] = useState<Record<string, string>>({});
  const [answerStreamByTheme, setAnswerStreamByTheme] = useState<Record<string, AnswerStreamState>>({});
  const [measuredPerformanceByTheme, setMeasuredPerformanceByTheme] = useState<Record<string, RuntimePerformanceMeasurement>>({});
  const [fundingDashboardByTheme, setFundingDashboardByTheme] = useState<Record<string, AdvertiserFundingDashboard>>(
    () => initialFundingDashboards(initialScenarios)
  );
  const [fundingAmountByTheme, setFundingAmountByTheme] = useState<Record<string, string>>({});
  const [fundingStatusByTheme, setFundingStatusByTheme] = useState<Record<string, {
    state: FundingStatus;
    message: string;
  }>>({});
  const [answerErrorByTheme, setAnswerErrorByTheme] = useState<Record<string, string>>(() => {
    const firstTheme = initialScenarios[0]?.theme;

    return initialAnswerError && firstTheme
      ? { [firstTheme]: initialAnswerError }
      : {};
  });
  const scenario = useMemo(
    () => scenarios.find((candidate) => candidate.theme === theme) ?? scenarios[0],
    [scenarios, theme]
  );
  const hideTopbarPreset = openRouterLiveConfigured && mode === "user-chat";
  const didResetScenarioStateRef = useRef(false);
  const adStartedAtByThemeRef = useRef<Record<string, number>>({});
  const interactionTouchedByThemeRef = useRef<Record<string, boolean>>({});
  const autoSettlementClaimInFlightRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const storedActiveTheme = readStoredActiveTheme();
    const storedSelectedThemes = readStoredActiveCampaignThemes();
    const storedMatchingModes = readStoredMatchingModesByTheme();
    const storedPresets = window.localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
    const restoreSelectedThemes = (availableScenarios: Phase4DemoScenario[]) => {
      const restoredThemes = resolveSelectedCampaignThemes({
        scenarios: availableScenarios,
        persistedThemes: storedSelectedThemes
      });

      setSelectedThemes(restoredThemes);
      persistActiveCampaignThemes(restoredThemes);
    };
    const restoreMatchingModes = (availableScenarios: Phase4DemoScenario[]) => {
      const restoredModes = resolveMatchingModesByTheme({
        scenarios: availableScenarios,
        persistedModes: storedMatchingModes
      });

      setMatchingModeByTheme(restoredModes);
      persistMatchingModesByTheme(restoredModes);
    };

    if (storedPresets) {
      try {
        const parsed = JSON.parse(storedPresets);
        const sanitized = sanitizeDemoPresetDrafts(parsed);

        if (sanitized.length === 0) {
          window.localStorage.removeItem(CUSTOM_PRESETS_STORAGE_KEY);
        } else {
          setCustomPresets(sanitized);
          window.localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(sanitized));
          void refreshScenarios(sanitized, {
            preferredTheme: storedActiveTheme ?? sanitized.at(-1)?.id
          }).then((refreshedScenarios) => {
            restoreSelectedThemes(refreshedScenarios);
            restoreMatchingModes(refreshedScenarios);
          }).catch((error: unknown) => {
            setCustomPresets([]);
            window.localStorage.removeItem(CUSTOM_PRESETS_STORAGE_KEY);
            restoreSelectedThemes(initialScenarios);
            restoreMatchingModes(initialScenarios);
            setCustomPresetError(getErrorMessage(error, "Saved custom presets could not be restored."));
          });
          return;
        }
      } catch {
        window.localStorage.removeItem(CUSTOM_PRESETS_STORAGE_KEY);
      }
    }

    if (storedActiveTheme) {
      setTheme((currentTheme) =>
        resolveActiveDemoTheme({
          scenarios: initialScenarios,
          preferredTheme: storedActiveTheme,
          fallbackTheme: currentTheme
        })
      );
    }
    restoreSelectedThemes(initialScenarios);
    restoreMatchingModes(initialScenarios);
  }, [initialScenarios]);

  useEffect(() => {
    const storedPerformance = window.localStorage.getItem(MEASURED_PERFORMANCE_STORAGE_KEY);

    if (!storedPerformance) {
      return;
    }

    try {
      const parsed = JSON.parse(storedPerformance) as Record<string, unknown>;
      const sanitized = Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, RuntimePerformanceMeasurement] =>
          typeof entry[0] === "string" && isRuntimePerformanceMeasurement(entry[1])
        )
      );

      setMeasuredPerformanceByTheme(sanitized);
    } catch {
      window.localStorage.removeItem(MEASURED_PERFORMANCE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    setAdState("visible");
    setDisclosureOpen(false);
    setInteractionValue(scenario.adExperience.interactionValue);
    setCompileError("");
    setLiveRefreshStatus("idle");
    setNewChatNoticeOpen(false);
    setCleanChatReady((currentCleanChatReady) => {
      if (!didResetScenarioStateRef.current && initialCleanChatReady) {
        return true;
      }

      if (openRouterLiveConfigured && mode === "user-chat" && currentCleanChatReady) {
        return true;
      }

      return false;
    });
    didResetScenarioStateRef.current = true;
  }, [scenario.theme, scenario.adExperience.interactionValue, initialCleanChatReady, mode, openRouterLiveConfigured]);

  useEffect(() => {
    if (mode !== "user-chat" || cleanChatReady || adState !== "visible") {
      return;
    }

    adStartedAtByThemeRef.current[scenario.theme] = Date.now();
    interactionTouchedByThemeRef.current[scenario.theme] = false;
  }, [adState, cleanChatReady, mode, scenario.theme]);

  const policyText =
    policyTextByTheme[scenario.theme] ??
    scenario.advertiserConsole.naturalLanguageTargetPolicySource;
  const compilePreview =
    compilePreviewByTheme[scenario.theme] ??
    scenario.advertiserConsole.compiledPolicy;
  const compileStatus = compileStatusByTheme[scenario.theme] ?? "ready";
  const reviewStatus = reviewStatusByTheme[scenario.theme] ?? scenario.platformReview.reviewStatus;
  const answerStream = answerStreamByTheme[scenario.theme] ?? EMPTY_ANSWER_STREAM;
  const answerError = answerErrorByTheme[scenario.theme] ?? "";
  const fundingDashboard = fundingDashboardByTheme[scenario.theme] ?? scenario.fundingDashboard;
  const fundingAmountEth = fundingAmountByTheme[scenario.theme] ?? "0.01";
  const fundingStatus = fundingStatusByTheme[scenario.theme] ?? {
    state: "idle" as const,
    message: "Ready to fund this campaign escrow."
  };
  const canDeleteSelectedCampaign = !isReservedDemoPresetId(scenario.theme);

  useEffect(() => {
    if (mode !== "advertiser-console" || activeConsoleStep !== "settlement") {
      return;
    }

    let cancelled = false;
    const refreshTheme = scenario.theme;

    setFundingStatusByTheme((current) => ({
      ...current,
      [refreshTheme]: {
        state: "pending",
        message: "Refreshing wallet balance and funding history..."
      }
    }));

    void fetchAdvertiserFundingDashboard({
      theme: refreshTheme,
      campaignId: scenario.fixture.campaign.id
    }).then((refreshedDashboard) => {
      if (cancelled) {
        return;
      }

      setFundingDashboardByTheme((current) => ({
        ...current,
        [refreshTheme]: refreshedDashboard
      }));
      setFundingStatusByTheme((current) => ({
        ...current,
        [refreshTheme]: {
          state: "confirmed",
          message: "Wallet balance and funding history refreshed."
        }
      }));
    }).catch((error: unknown) => {
      if (cancelled) {
        return;
      }

      setFundingStatusByTheme((current) => ({
        ...current,
        [refreshTheme]: {
          state: "failed",
          message: getErrorMessage(error, "Wallet balance and funding history refresh failed.")
        }
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [activeConsoleStep, mode, scenario.fixture.campaign.id, scenario.theme]);

  function clearAnswerError(themeToClear: string) {
    setAnswerErrorByTheme((current) => {
      const next = { ...current };
      delete next[themeToClear];
      return next;
    });
  }

  function clearSubmittedQuestion(themeToClear: string) {
    setSubmittedQuestionByTheme((current) => {
      const next = { ...current };
      delete next[themeToClear];
      return next;
    });
  }

  function clearAnswerStream(themeToClear: string) {
    setAnswerStreamByTheme((current) => {
      const next = { ...current };
      delete next[themeToClear];
      return next;
    });
  }

  function resetChatState() {
    setAdState("visible");
    setDisclosureOpen(false);
    setInteractionValue(scenario.adExperience.interactionValue);
    setLiveRefreshStatus("idle");
    clearAnswerError(scenario.theme);
    clearAnswerStream(scenario.theme);
  }

  function persistMeasuredPerformance(nextPerformanceState: Record<string, RuntimePerformanceMeasurement>) {
    setMeasuredPerformanceByTheme(nextPerformanceState);

    try {
      window.localStorage.setItem(MEASURED_PERFORMANCE_STORAGE_KEY, JSON.stringify(nextPerformanceState));
    } catch {
      // Performance remains visible for the current session if storage is unavailable.
    }
  }

  function recordMeasuredPerformance(themeToMeasure: string): RuntimePerformanceMeasurement {
    const startedAtMs = adStartedAtByThemeRef.current[themeToMeasure] ?? Date.now();
    const measurement = createRuntimePerformanceMeasurement({
      scenario,
      startedAtMs,
      endedAtMs: Date.now(),
      interactionTouched: Boolean(interactionTouchedByThemeRef.current[themeToMeasure]),
      interactionValue,
      measuredAt: new Date().toISOString()
    });
    const nextPerformanceState = {
      ...measuredPerformanceByTheme,
      [themeToMeasure]: measurement
    };

    persistMeasuredPerformance(nextPerformanceState);
    return measurement;
  }

  function updateMeasuredPerformanceFollowUp(themeToUpdate: string, followUpQuestion: string) {
    const measurement = measuredPerformanceByTheme[themeToUpdate];

    if (!measurement) {
      return;
    }

    const updatedMeasurement = updateRuntimePerformanceWithFollowUp({
      measurement,
      scenario,
      followUpQuestion,
      measuredAt: new Date().toISOString()
    });
    const nextPerformanceState = {
      ...measuredPerformanceByTheme,
      [themeToUpdate]: updatedMeasurement
    };

    persistMeasuredPerformance(nextPerformanceState);
    void submitAutomaticSettlementClaim(updatedMeasurement);
  }

  function clearMeasuredPerformance(themeToClear: string) {
    const nextPerformanceState = omitRecordKey(measuredPerformanceByTheme, themeToClear);

    persistMeasuredPerformance(nextPerformanceState);
  }

  function confirmNewChat() {
    resetChatState();
    clearSubmittedQuestion(scenario.theme);
    setCleanChatReady(true);
    setNewChatNoticeOpen(false);
  }

  function startCleanChat() {
    resetChatState();
    if (openRouterLiveConfigured) {
      setCleanChatReady(true);
      return;
    }

    setCleanChatReady(false);
  }

  async function compilePolicy() {
    setCompileStatusByTheme((current) => ({ ...current, [scenario.theme]: "pending" }));
    setCompileError("");

    try {
      const response = await fetch("/api/compile-policy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
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
      setCompilePreviewByTheme((current) => ({
        ...current,
        [scenario.theme]: payload
      }));
      setCompileStatusByTheme((current) => ({ ...current, [scenario.theme]: "ready" }));
    } catch (error) {
      setCompileStatusByTheme((current) => ({ ...current, [scenario.theme]: "failed" }));
      setCompileError(error instanceof Error ? error.message : "Policy compile failed.");
    }
  }

  function selectTheme(nextTheme: DemoAdTheme) {
    setCampaignDeleteNotice("");
    setTheme(nextTheme);
    persistActiveTheme(nextTheme);
  }

  function updateSelectedThemes(nextThemes: string[], nextActiveTheme?: DemoAdTheme) {
    const resolvedThemes = resolveSelectedCampaignThemes({
      scenarios,
      persistedThemes: nextThemes
    });

    setSelectedThemes(resolvedThemes);
    persistActiveCampaignThemes(resolvedThemes);

    if (nextActiveTheme && resolvedThemes.includes(nextActiveTheme)) {
      selectTheme(nextActiveTheme);
    }
  }

  function updateMatchingMode(themeToUpdate: string, mode: MatchingMode) {
    setMatchingModeByTheme((current) => {
      const resolvedModes = resolveMatchingModesByTheme({
        scenarios,
        persistedModes: {
          ...current,
          [themeToUpdate]: mode
        }
      });

      persistMatchingModesByTheme(resolvedModes);
      return resolvedModes;
    });
  }

  async function refreshScenarios(
    nextCustomPresets: DemoPresetDraft[],
    options: { preferredTheme?: string | null } = {}
  ) {
    const response = await fetch("/api/demo-scenarios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ customPresets: nextCustomPresets })
    });
    const payload = await readJsonResponse<{
      scenarios?: Phase4DemoScenario[];
      customPresets?: DemoPresetDraft[];
      error?: string;
      detail?: string;
    }>(response);

    if (!response.ok) {
      throw new Error(payload.detail ?? payload.error ?? "Failed to refresh demo scenarios.");
    }

    if (!Array.isArray(payload.scenarios)) {
      throw new Error("Demo scenario refresh returned an invalid response.");
    }

    const refreshedScenarios = payload.scenarios as Phase4DemoScenario[];
    const refreshedCustomPresets = sanitizeDemoPresetDrafts(payload.customPresets ?? nextCustomPresets);

    setScenarios(refreshedScenarios);
    setCustomPresets(refreshedCustomPresets);
    persistCustomPresets(refreshedCustomPresets);
    setFundingDashboardByTheme((current) => ({
      ...initialFundingDashboards(refreshedScenarios),
      ...current
    }));
    setTheme((currentTheme) =>
      resolveActiveDemoTheme({
        scenarios: refreshedScenarios,
        preferredTheme: options.preferredTheme,
        customPresets: nextCustomPresets,
        fallbackTheme: currentTheme
      })
    );

    return refreshedScenarios;
  }

  async function addCustomPreset() {
    const preset = formStateToPreset(customForm);

    if (isReservedDemoPresetId(preset.id)) {
      setCustomPresetError(`Preset ID "${preset.id}" is a reserved system preset. Please use a different ID.`);
      return;
    }

    if (isReservedDemoPresetCampaignName(preset.campaignName)) {
      setCustomPresetError(`Campaign "${preset.campaignName}" already exists as a system preset. Please use a distinct campaign name.`);
      return;
    }

    const validExistingPresets = sanitizeDemoPresetDrafts(customPresets);
    const duplicateCampaign = validExistingPresets.find((candidate) =>
      candidate.id !== preset.id && hasSameDemoPresetCampaignName(candidate, preset)
    );

    if (duplicateCampaign) {
      setCustomPresetError(`Campaign "${preset.campaignName}" already exists in your custom presets. Please use a distinct campaign name.`);
      return;
    }

    const nextPresets = [
      ...validExistingPresets.filter((candidate) => candidate.id !== preset.id),
      preset
    ];

    setCustomPresetError("");
    setCampaignDeleteNotice("");

    try {
      await refreshScenarios(nextPresets, { preferredTheme: preset.id });
      persistActiveTheme(preset.id);
      setCustomForm(DEFAULT_CUSTOM_FORM);
    } catch (error) {
      setCustomPresetError(getErrorMessage(error, "Failed to create this campaign preset."));
    }
  }

  async function deleteSelectedCampaign() {
    const themeToDelete = scenario.theme;
    const campaignName = scenario.advertiserConsole.campaignName;
    const { nextPresets, removedPreset } = removeCustomPresetByTheme(customPresets, themeToDelete);

    if (!removedPreset && isReservedDemoPresetId(themeToDelete)) {
      setCampaignDeleteNotice("Seed campaigns are locked. Only custom campaign presets can be deleted.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${campaignName}"? This removes the custom campaign preset from this browser.`
    );

    if (!confirmed) {
      return;
    }

    setCampaignDeleteNotice(`Deleting ${campaignName}...`);
    setCustomPresetError("");

    try {
      const refreshedScenarios = removedPreset
        ? await refreshScenarios(nextPresets, {
          preferredTheme: nextPresets.at(-1)?.id ?? null
        })
        : scenarios.filter((candidate) => candidate.theme !== themeToDelete);
      const nextTheme = resolveActiveDemoTheme({
        scenarios: refreshedScenarios,
        customPresets: nextPresets,
        fallbackTheme: themeToDelete
      });

      if (!removedPreset) {
        setScenarios(refreshedScenarios);
        setTheme(nextTheme);
      }

      setCustomPresets(nextPresets);
      setSelectedThemes((current) => {
        const nextSelectedThemes = current.filter((candidate) => candidate !== themeToDelete);
        persistActiveCampaignThemes(nextSelectedThemes);
        return nextSelectedThemes;
      });
      setMatchingModeByTheme((current) => {
        const nextModes = omitRecordKey(current, themeToDelete);
        persistMatchingModesByTheme(nextModes);
        return nextModes;
      });
      setPolicyTextByTheme((current) => omitRecordKey(current, themeToDelete));
      setCompilePreviewByTheme((current) => omitRecordKey(current, themeToDelete));
      setCompileStatusByTheme((current) => omitRecordKey(current, themeToDelete));
      setReviewStatusByTheme((current) => omitRecordKey(current, themeToDelete));
      setSubmittedQuestionByTheme((current) => omitRecordKey(current, themeToDelete));
      setAnswerStreamByTheme((current) => omitRecordKey(current, themeToDelete));
      setAnswerErrorByTheme((current) => omitRecordKey(current, themeToDelete));
      persistMeasuredPerformance(omitRecordKey(measuredPerformanceByTheme, themeToDelete));
      setFundingDashboardByTheme((current) => omitRecordKey(current, themeToDelete));
      setFundingAmountByTheme((current) => omitRecordKey(current, themeToDelete));
      setFundingStatusByTheme((current) => omitRecordKey(current, themeToDelete));

      if (removedPreset) {
        persistCustomPresets(nextPresets);
      }

      persistActiveTheme(nextTheme);
      setCampaignDeleteNotice(`${campaignName} was deleted.`);
    } catch (error) {
      setCampaignDeleteNotice(getErrorMessage(error, "Failed to delete this campaign preset."));
    }
  }

  async function runLiveScenario(userQuestion?: string) {
    setLiveRefreshStatus("pending");
    clearAnswerError(scenario.theme);
    clearAnswerStream(scenario.theme);

    const readyThemes = selectedThemes.filter(
      (t) => (compileStatusByTheme[t] ?? "ready") === "ready"
    );

    try {
      const response = await fetch("/api/live-scenario", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          theme: scenario.theme,
          customPresets,
          userQuestion,
          readyThemes,
          matchingModesByTheme: matchingModeByTheme
        })
      });

      if (!response.ok) {
        setLiveRefreshStatus("failed");
        setAnswerErrorByTheme((current) => ({
          ...current,
          [scenario.theme]: LIVE_ANSWER_ERROR_MESSAGE
        }));
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
      if (userQuestion?.trim()) {
        setSubmittedQuestionByTheme((current) => ({
          ...current,
          [payload.scenario.theme]: userQuestion.trim()
        }));
      }
      setFundingDashboardByTheme((current) => ({
        ...current,
        [payload.scenario.theme]: current[payload.scenario.theme] ?? payload.scenario.fundingDashboard
      }));
      clearAnswerError(payload.scenario.theme);
      setLiveRefreshStatus("idle");

      // Auto-switch to the matched scenario's theme to keep the UI aligned
      if (payload.scenario.theme !== scenario.theme) {
        setTheme(payload.scenario.theme);
      }
    } catch {
      setLiveRefreshStatus("failed");
      setAnswerErrorByTheme((current) => ({
        ...current,
        [scenario.theme]: LIVE_ANSWER_ERROR_MESSAGE
      }));
    }
  }

  function revealAnswer(nextAdState: AdState) {
    setAdState(nextAdState);

    if (openRouterLiveConfigured) {
      void streamLiveAnswer(submittedQuestionByTheme[scenario.theme]);
    }
  }

  async function streamLiveAnswer(userQuestion?: string) {
    const streamTheme = scenario.theme;
    const normalizedQuestion = userQuestion?.trim();

    setAnswerStreamByTheme((current) => ({
      ...current,
      [streamTheme]: {
        status: "pending",
        text: ""
      }
    }));
    clearAnswerError(streamTheme);

    try {
      const response = await fetch("/api/live-answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          theme: streamTheme,
          customPresets,
          ...(normalizedQuestion ? { userQuestion: normalizedQuestion } : {})
        })
      });

      if (!response.ok || !response.body) {
        throw new Error("Live answer stream failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalAnswer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = extractClientSsePayloads(buffer);
        buffer = parsed.remainder;

        for (const payload of parsed.payloads) {
          const event = JSON.parse(payload) as AnswerStreamPayload;

          if (event.type === "delta") {
            setAnswerStreamByTheme((current) => ({
              ...current,
              [streamTheme]: {
                status: "pending",
                text: `${current[streamTheme]?.text ?? ""}${event.text}`
              }
            }));
          } else if (event.type === "done") {
            finalAnswer = event.answer;
          } else {
            throw new Error(event.message);
          }
        }
      }

      const parsed = extractClientSsePayloads(buffer + decoder.decode());

      for (const payload of parsed.payloads) {
        const event = JSON.parse(payload) as AnswerStreamPayload;

        if (event.type === "delta") {
          finalAnswer += event.text;
        } else if (event.type === "done") {
          finalAnswer = event.answer;
        } else {
          throw new Error(event.message);
        }
      }

      if (!finalAnswer.trim()) {
        throw new Error("Live answer stream returned an empty answer.");
      }

      setAnswerStreamByTheme((current) => ({
        ...current,
        [streamTheme]: {
          status: "complete",
          text: finalAnswer
        }
      }));
    } catch {
      setAnswerStreamByTheme((current) => ({
        ...current,
        [streamTheme]: {
          status: "failed",
          text: ""
        }
      }));
      setAnswerErrorByTheme((current) => ({
        ...current,
        [streamTheme]: LIVE_ANSWER_ERROR_MESSAGE
      }));
    }
  }

  async function submitUserQuestion(userQuestion: string) {
    const submittedQuestion = userQuestion.trim();

    if (!submittedQuestion) {
      return;
    }

    if (adState !== "visible") {
      updateMeasuredPerformanceFollowUp(scenario.theme, submittedQuestion);
    }

    setSubmittedQuestionByTheme((current) => ({
      ...current,
      [scenario.theme]: submittedQuestion
    }));
    resetChatState();
    setCleanChatReady(false);
    setNewChatNoticeOpen(false);
    await runLiveScenario(submittedQuestion);
  }

  async function submitFundingDeposit() {
    setFundingStatusByTheme((current) => ({
      ...current,
      [scenario.theme]: {
        state: "pending",
        message: "Submitting deposit transaction..."
      }
    }));

    try {
      const response = await fetch("/api/advertiser-funding/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          advertiserId: scenario.fixture.campaign.advertiserId,
          campaignId: scenario.fixture.campaign.id,
          walletAddress: fundingDashboard.walletProfile.walletAddress ?? "",
          amountEth: fundingAmountEth,
          policyHash: fundingDashboard.account.policyHash
        })
      });
      const payload = await response.json() as {
        ledgerEntry?: EscrowLedgerEntry;
        error?: string;
      };

      if (!response.ok || !payload.ledgerEntry) {
        throw new Error(payload.error ?? "Deposit failed.");
      }

      setFundingDashboardByTheme((current) => ({
        ...current,
        [scenario.theme]: mergeFundingLedgerEntry(
          current[scenario.theme] ?? fundingDashboard,
          payload.ledgerEntry!
        )
      }));
      setFundingStatusByTheme((current) => ({
        ...current,
        [scenario.theme]: {
          state: "confirmed",
          message: "Deposit confirmed and added to funding history."
        }
      }));
    } catch (error) {
      setFundingStatusByTheme((current) => ({
        ...current,
        [scenario.theme]: {
          state: "failed",
          message: error instanceof Error ? error.message : "Deposit failed."
        }
      }));
    }
  }

  async function submitAutomaticSettlementClaim(measurement: RuntimePerformanceMeasurement) {
    if (!shouldAutoClaimSettlement({
      measurement,
      fundingDashboard,
      reviewStatus
    })) {
      return;
    }

    if (autoSettlementClaimInFlightRef.current[scenario.theme]) {
      return;
    }

    autoSettlementClaimInFlightRef.current[scenario.theme] = true;
    setFundingStatusByTheme((current) => ({
      ...current,
      [scenario.theme]: {
        state: "pending",
        message: "Attention threshold passed. Submitting settlement claim..."
      }
    }));

    try {
      const response = await fetch("/api/advertiser-funding/settlement-claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          advertiserId: scenario.fixture.campaign.advertiserId,
          campaignId: scenario.fixture.campaign.id,
          theme: scenario.theme,
          walletAddress: fundingDashboard.walletProfile.walletAddress,
          policyHash: fundingDashboard.account.policyHash,
          attentionMeasurement: {
            source: measurement.source,
            campaignId: measurement.campaignId,
            interstitialId: measurement.interstitialId,
            measuredAt: measurement.measuredAt,
            scoreBps: measurement.scoreBps,
            thresholdBps: measurement.thresholdBps,
            signalTypes: measurement.signalTypes
          },
          customPresets
        })
      });
      const payload = await response.json() as {
        ledgerEntry?: EscrowLedgerEntry;
        error?: string;
      };

      if (!response.ok || !payload.ledgerEntry) {
        throw new Error(payload.error ?? "Settlement claim failed.");
      }

      setFundingDashboardByTheme((current) => ({
        ...current,
        [scenario.theme]: mergeFundingLedgerEntry(
          current[scenario.theme] ?? fundingDashboard,
          payload.ledgerEntry!
        )
      }));
      setFundingStatusByTheme((current) => ({
        ...current,
        [scenario.theme]: {
          state: "confirmed",
          message: "Settlement automatically claimed and added to wallet history."
        }
      }));
    } catch (error) {
      delete autoSettlementClaimInFlightRef.current[scenario.theme];
      setFundingStatusByTheme((current) => ({
        ...current,
        [scenario.theme]: {
          state: "failed",
          message: error instanceof Error ? error.message : "Settlement claim failed."
        }
      }));
    }
  }

  return (
    <main className={`app-shell app-shell--${mode}`}>
      <header
        className={`topbar topbar--chat-app ${mode === "advertiser-console" ? "topbar--console-app" : ""} ${hideTopbarPreset ? "topbar--no-center-control" : ""}`}
      >
        <Link
          className="brand-lockup"
          href={mode === "user-chat" ? "/user-chat" : "/advertiser-console"}
          aria-label={`Adrail ${mode === "user-chat" ? "user chat" : "advertiser console"}`}
        >
          <span className="brand-mark" aria-hidden="true">
            <ShieldIcon />
          </span>
          <span>Adrail</span>
          <span className="beta-badge">BETA</span>
        </Link>

        {!hideTopbarPreset ? (
          <label className="preset-control">
            <span>Preset:</span>
            <select
              value={scenario.theme}
              onChange={(event) => selectTheme(event.currentTarget.value)}
            >
              {scenarios.map((candidate) => (
                <option key={getScenarioRenderKey(candidate)} value={candidate.theme}>
                  {candidate.navigationLabel}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="chat-top-actions">
          {mode === "user-chat" ? (
            <>
              <button
                className="new-chat-button"
                type="button"
                aria-label="Start a new chat"
                aria-haspopup="dialog"
                aria-expanded={newChatNoticeOpen}
                onClick={() => setNewChatNoticeOpen(true)}
              >
                <PlusIcon />
              </button>
              <Link className="console-link" href="/advertiser-console">
                Advertiser Console
                <ExternalIcon />
              </Link>
            </>
          ) : (
            <Link className="console-link" href="/user-chat">
              User Chat
              <ExternalIcon />
            </Link>
          )}
        </div>
      </header>

      {mode === "user-chat" ? (
        <UserChatPanel
          scenario={scenario}
          adState={adState}
          interactionValue={interactionValue}
          liveRefreshStatus={liveRefreshStatus}
          answerStream={answerStream}
          useStreamedAnswer={openRouterLiveConfigured}
          answerError={answerError}
          measuredPerformance={measuredPerformanceByTheme[scenario.theme]}
          composerModelName={composerModelName}
          cleanChatReady={cleanChatReady}
          newChatNoticeOpen={newChatNoticeOpen}
          submittedQuestion={submittedQuestionByTheme[scenario.theme]}
          onInteractionValue={(value) => {
            interactionTouchedByThemeRef.current[scenario.theme] = true;
            setInteractionValue(value);
          }}
          onCta={() => {
            const measurement = recordMeasuredPerformance(scenario.theme);
            void submitAutomaticSettlementClaim(measurement);
            revealAnswer("cta");
          }}
          onDismiss={() => revealAnswer("dismissed")}
          onNotRelevant={() => revealAnswer("not_relevant")}
          onDisclosure={() => setDisclosureOpen(true)}
          onRetryAnswer={() => {
            void streamLiveAnswer(submittedQuestionByTheme[scenario.theme] ?? scenario.userChat.userQuestion);
          }}
          onResetAd={() => {
            setAdState("visible");
            clearMeasuredPerformance(scenario.theme);
            clearAnswerError(scenario.theme);
            clearAnswerStream(scenario.theme);
          }}
          onRunLive={runLiveScenario}
          onCancelNewChat={() => setNewChatNoticeOpen(false)}
          onConfirmNewChat={confirmNewChat}
          onStartCleanChat={startCleanChat}
          onSubmitQuestion={submitUserQuestion}
        />
      ) : (
        <section className="console-screen" aria-label="Advertiser console screen">
          <aside className="console-panel" aria-label="Demo consoles">
            <nav className="console-stepper" aria-label="Advertiser console stages">
              {CONSOLE_STEPS.map((step) => (
                <button
                  key={step.key}
                  type="button"
                  className={activeConsoleStep === step.key ? "is-active" : ""}
                  aria-pressed={activeConsoleStep === step.key}
                  onClick={() => setActiveConsoleStep(step.key)}
                >
                  {step.label}
                </button>
              ))}
            </nav>

            {activeConsoleStep === "overview" ||
            activeConsoleStep === "create" ||
            activeConsoleStep === "targeting" ||
            activeConsoleStep === "creative" ? (
              <AdvertiserConsole
                activeStep={activeConsoleStep}
                scenario={scenario}
                scenarios={scenarios}
                policyText={policyText}
                compilePreview={compilePreview}
                compileStatus={compileStatus}
                compileError={compileError}
                compileStatusByTheme={compileStatusByTheme}
                selectedThemes={selectedThemes}
                matchingModeByTheme={matchingModeByTheme}
                customForm={customForm}
                onTheme={selectTheme}
                onSelectedThemes={updateSelectedThemes}
                onMatchingMode={updateMatchingMode}
                onPolicyText={(value) => {
                  setPolicyTextByTheme((current) => ({ ...current, [scenario.theme]: value }));
                  setCompileStatusByTheme((current) => ({ ...current, [scenario.theme]: "stale" }));
                  setCompileError("");
                }}
                onCompile={compilePolicy}
                onCustomForm={(value) => {
                  setCustomForm(value);
                  setCustomPresetError("");
                }}
                onAddCustomPreset={addCustomPreset}
                customPresetError={customPresetError}
                canDeleteSelectedCampaign={canDeleteSelectedCampaign}
                campaignDeleteNotice={campaignDeleteNotice}
                onDeleteSelectedCampaign={deleteSelectedCampaign}
              />
            ) : null}

            {activeConsoleStep === "review" ? (
              <PlatformReviewConsole
                scenario={scenario}
                reviewStatus={reviewStatus}
                compilePreview={compilePreview}
                onReviewStatus={(status) =>
                  setReviewStatusByTheme((current) => ({ ...current, [scenario.theme]: status }))
                }
              />
            ) : null}

            {activeConsoleStep === "performance" ? (
              <PerformanceDashboard
                scenario={scenario}
                reviewStatus={reviewStatus}
                measuredPerformance={measuredPerformanceByTheme[scenario.theme]}
              />
            ) : null}

            {activeConsoleStep === "settlement" ? (
              <SettlementDashboard
                scenario={scenario}
                reviewStatus={reviewStatus}
                fundingDashboard={fundingDashboard}
                fundingAmountEth={fundingAmountEth}
                fundingStatus={fundingStatus}
                onFundingAmount={(value) =>
                  setFundingAmountByTheme((current) => ({
                    ...current,
                    [scenario.theme]: value
                  }))
                }
                onSubmitFundingDeposit={submitFundingDeposit}
              />
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

function initialFundingDashboards(scenarios: Phase4DemoScenario[]): Record<string, AdvertiserFundingDashboard> {
  return Object.fromEntries(
    scenarios.map((scenario) => [scenario.theme, scenario.fundingDashboard])
  );
}

export function buildAdvertiserFundingRefreshPath(input: {
  theme: string;
  campaignId: string;
}): string {
  const params = new URLSearchParams({
    theme: input.theme,
    campaignId: input.campaignId
  });

  return `/api/advertiser-funding?${params.toString()}`;
}

export async function fetchAdvertiserFundingDashboard(input: {
  theme: string;
  campaignId: string;
  fetcher?: FundingDashboardFetcher;
}): Promise<AdvertiserFundingDashboard> {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(buildAdvertiserFundingRefreshPath(input), {
    cache: "no-store"
  });
  const payload = await readJsonResponse<{
    fundingDashboard?: AdvertiserFundingDashboard;
    error?: string;
    detail?: string;
  }>(response);

  if (!response.ok || !payload.fundingDashboard) {
    throw new Error(payload.detail ?? payload.error ?? "Failed to refresh wallet balance and funding history.");
  }

  return payload.fundingDashboard;
}

export function shouldAutoClaimSettlement(input: {
  measurement?: RuntimePerformanceMeasurement;
  fundingDashboard: AdvertiserFundingDashboard;
  reviewStatus: ReviewStatus;
}): boolean {
  if (input.reviewStatus !== "approved" || !input.measurement?.settlementEligible) {
    return false;
  }

  if (!input.fundingDashboard.walletProfile.walletAddress) {
    return false;
  }

  return !input.fundingDashboard.ledgerEntries.some((entry) =>
    entry.type === "attention_debit" &&
    entry.status !== "failed" &&
    entry.campaignId === input.measurement?.campaignId
  );
}

export function resolveActiveDemoTheme(input: {
  scenarios: Array<Pick<Phase4DemoScenario, "theme">>;
  preferredTheme?: string | null;
  customPresets?: DemoPresetDraft[];
  fallbackTheme?: string;
}): DemoAdTheme {
  const availableThemes = new Set(input.scenarios.map((candidate) => candidate.theme));
  const themeCandidates: string[] = [];
  const preferredTheme = input.preferredTheme?.trim();

  if (preferredTheme) {
    themeCandidates.push(preferredTheme, normalizeDemoPresetId(preferredTheme));
  }

  for (const preset of [...(input.customPresets ?? [])].reverse()) {
    themeCandidates.push(preset.id, normalizeDemoPresetId(preset.id));
  }

  if (input.fallbackTheme) {
    themeCandidates.push(input.fallbackTheme, normalizeDemoPresetId(input.fallbackTheme));
  }

  for (const candidate of themeCandidates) {
    if (availableThemes.has(candidate)) {
      return candidate;
    }
  }

  return input.scenarios[0]?.theme ?? "travel";
}

export function resolveSelectedCampaignThemes(input: {
  scenarios: Array<Pick<Phase4DemoScenario, "theme">>;
  persistedThemes?: unknown;
  fallbackThemes?: string[];
}): string[] {
  const availableThemes = new Map<string, string>();

  for (const scenario of input.scenarios) {
    availableThemes.set(scenario.theme, scenario.theme);
    availableThemes.set(normalizeDemoPresetId(scenario.theme), scenario.theme);
  }

  const selectedThemes = new Set<string>();
  const persistedThemes = Array.isArray(input.persistedThemes) ? input.persistedThemes : [];
  const themeCandidates = [...persistedThemes, ...(input.fallbackThemes ?? [])];

  for (const candidate of themeCandidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const trimmedCandidate = candidate.trim();

    if (!trimmedCandidate) {
      continue;
    }

    const resolvedTheme =
      availableThemes.get(trimmedCandidate) ??
      availableThemes.get(normalizeDemoPresetId(trimmedCandidate));

    if (resolvedTheme) {
      selectedThemes.add(resolvedTheme);
    }
  }

  return Array.from(selectedThemes);
}

export function resolveMatchingModesByTheme(input: {
  scenarios: Array<Pick<Phase4DemoScenario, "theme">>;
  persistedModes?: unknown;
}): Record<string, MatchingMode> {
  const availableThemes = new Map<string, string>();

  for (const scenario of input.scenarios) {
    availableThemes.set(scenario.theme, scenario.theme);
    availableThemes.set(normalizeDemoPresetId(scenario.theme), scenario.theme);
  }

  if (!input.persistedModes || typeof input.persistedModes !== "object" || Array.isArray(input.persistedModes)) {
    return {};
  }

  const resolvedModes: Record<string, MatchingMode> = {};

  for (const [rawTheme, rawMode] of Object.entries(input.persistedModes)) {
    if (rawMode !== "fast" && rawMode !== "professional") {
      continue;
    }

    const resolvedTheme =
      availableThemes.get(rawTheme) ??
      availableThemes.get(normalizeDemoPresetId(rawTheme));

    if (resolvedTheme) {
      resolvedModes[resolvedTheme] = rawMode;
    }
  }

  return resolvedModes;
}

export function getActiveMatchingModeStatus(input: {
  selectedThemes: string[];
  matchingModeByTheme: Record<string, MatchingMode>;
}): { mode: "fast" | "professional" | "none"; label: string; detail: string } {
  const activeCount = input.selectedThemes.length;

  if (activeCount === 0) {
    return {
      mode: "none",
      label: "No active campaigns",
      detail: "Activate at least one ready campaign before testing User Chat."
    };
  }

  const usesProfessional = input.selectedThemes.some((theme) =>
    input.matchingModeByTheme[theme] === "professional"
  );

  if (usesProfessional) {
    return {
      mode: "professional",
      label: "Professional Matching",
      detail: `LLM selects from all ${activeCount} active campaign${activeCount === 1 ? "" : "s"}.`
    };
  }

  return {
    mode: "fast",
    label: "Fast Matching",
    detail: `Embedding cosine similarity ranks ${activeCount} active campaign${activeCount === 1 ? "" : "s"}.`
  };
}

export function isCustomPresetTheme(customPresets: DemoPresetDraft[], theme: string): boolean {
  const normalizedTheme = normalizeDemoPresetId(theme);

  return sanitizeDemoPresetDrafts(customPresets).some(
    (preset) => normalizeDemoPresetId(preset.id) === normalizedTheme
  );
}

export function removeCustomPresetByTheme(
  customPresets: DemoPresetDraft[],
  theme: string
): { nextPresets: DemoPresetDraft[]; removedPreset?: DemoPresetDraft } {
  const normalizedTheme = normalizeDemoPresetId(theme);
  const sanitizedPresets = sanitizeDemoPresetDrafts(customPresets);
  const removedPreset = sanitizedPresets.find(
    (preset) => normalizeDemoPresetId(preset.id) === normalizedTheme
  );

  if (!removedPreset) {
    return {
      nextPresets: sanitizedPresets
    };
  }

  return {
    nextPresets: sanitizedPresets.filter(
      (preset) => normalizeDemoPresetId(preset.id) !== normalizedTheme
    ),
    removedPreset
  };
}

function omitRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];

  return next;
}

function readStoredActiveTheme(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_PRESET_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readStoredActiveCampaignThemes(): unknown {
  try {
    const storedThemes = window.localStorage.getItem(ACTIVE_CAMPAIGN_THEMES_STORAGE_KEY);

    if (!storedThemes) {
      return [];
    }

    return JSON.parse(storedThemes);
  } catch {
    return [];
  }
}

function readStoredMatchingModesByTheme(): unknown {
  try {
    const storedModes = window.localStorage.getItem(MATCHING_MODES_STORAGE_KEY);

    if (!storedModes) {
      return {};
    }

    return JSON.parse(storedModes);
  } catch {
    return {};
  }
}

function persistActiveTheme(themeToPersist: string) {
  try {
    window.localStorage.setItem(ACTIVE_PRESET_STORAGE_KEY, themeToPersist);
  } catch {
    // The active theme is a convenience handoff; the app still works without storage.
  }
}

function persistActiveCampaignThemes(themesToPersist: string[]) {
  try {
    if (themesToPersist.length > 0) {
      window.localStorage.setItem(ACTIVE_CAMPAIGN_THEMES_STORAGE_KEY, JSON.stringify(themesToPersist));
      return;
    }

    window.localStorage.removeItem(ACTIVE_CAMPAIGN_THEMES_STORAGE_KEY);
  } catch {
    // Active campaign toggles are a route handoff convenience; the app still works without storage.
  }
}

function persistMatchingModesByTheme(modesToPersist: Record<string, MatchingMode>) {
  try {
    const entries = Object.entries(modesToPersist);

    if (entries.length > 0) {
      window.localStorage.setItem(MATCHING_MODES_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
      return;
    }

    window.localStorage.removeItem(MATCHING_MODES_STORAGE_KEY);
  } catch {
    // Matching modes are a browser-local preference; the default Fast mode remains available.
  }
}

function persistCustomPresets(presetsToPersist: DemoPresetDraft[]) {
  try {
    if (presetsToPersist.length > 0) {
      window.localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(presetsToPersist));
      return;
    }

    window.localStorage.removeItem(CUSTOM_PRESETS_STORAGE_KEY);
  } catch {
    // Custom preset storage is a browser-local convenience; the seed campaigns remain available.
  }
}

function getScenarioRenderKey(scenario: Phase4DemoScenario): string {
  return scenario.fixture.campaign.id;
}

function mergeFundingLedgerEntry(
  dashboard: AdvertiserFundingDashboard,
  entry: EscrowLedgerEntry
): AdvertiserFundingDashboard {
  const ledgerEntries = dedupeFundingEntries([...dashboard.ledgerEntries, entry]);
  const summary = summarizeFundingEntries(ledgerEntries);

  return {
    ...dashboard,
    ledgerEntries,
    summary,
    account: {
      ...dashboard.account,
      depositedWei: summary.depositedWei,
      spentWei: summary.spentWei,
      availableWei: summary.availableWei,
      pendingDebitWei: summary.pendingDebitWei,
      lastIndexedBlock: summary.lastIndexedBlock,
      updatedAt: entry.updatedAt
    }
  };
}

function dedupeFundingEntries(entries: EscrowLedgerEntry[]): EscrowLedgerEntry[] {
  const byId = new Map<string, EscrowLedgerEntry>();
  const seenAttentionProofs = new Set<string>();

  for (const entry of entries) {
    if (entry.type === "attention_debit" && entry.proofHash) {
      const proofKey = `${entry.campaignId}:${entry.proofHash}`;

      if (seenAttentionProofs.has(proofKey)) {
        continue;
      }

      seenAttentionProofs.add(proofKey);
    }

    byId.set(entry.id, entry);
  }

  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function summarizeFundingEntries(entries: EscrowLedgerEntry[]): AdvertiserFundingDashboard["summary"] {
  let deposited = 0n;
  let spent = 0n;
  let pendingDebit = 0n;
  let lastIndexedBlock: number | undefined;

  for (const entry of entries) {
    const amount = BigInt(entry.amountWei);

    if (entry.status === "confirmed" && entry.type === "deposit") {
      deposited += amount;
    }

    if (entry.status === "confirmed" && entry.type === "refund") {
      deposited -= amount;
    }

    if (entry.status === "confirmed" && entry.type === "attention_debit") {
      spent += amount;
    }

    if (entry.status === "pending" && entry.type === "attention_debit") {
      pendingDebit += amount;
    }

    if (entry.blockNumber && (!lastIndexedBlock || entry.blockNumber > lastIndexedBlock)) {
      lastIndexedBlock = entry.blockNumber;
    }
  }

  const available = deposited - spent - pendingDebit;

  return {
    depositedWei: deposited.toString(),
    spentWei: spent.toString(),
    availableWei: available < 0n ? "0" : available.toString(),
    pendingDebitWei: pendingDebit.toString(),
    entryCount: entries.length,
    lastIndexedBlock
  };
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 3.2 19 5.8v5.5c0 4.3-2.8 7.8-7 9.5-4.2-1.7-7-5.2-7-9.5V5.8l7-2.6Z" />
      <path d="M12 7.2v7.5" />
      <path d="M8.9 10.6h6.2" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M7.2 5.4H5.6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1.6" />
      <path d="M10 4h6v6" />
      <path d="m8.8 11.2 7-7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M10 4.5v11" />
      <path d="M4.5 10h11" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M10 15.5v-11" />
      <path d="M5.8 8.6 10 4.4l4.2 4.2" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" />
      <path d="M10 9v4" />
      <path d="M10 6.8v.1" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M10 3.2 18 16.2H2L10 3.2Z" />
      <path d="M10 7.8v4.2" />
      <path d="M10 14.5v.1" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M16.4 7.1A6.2 6.2 0 0 0 5.2 4.4L3.4 6.2" />
      <path d="M3.4 2.5v3.7h3.7" />
      <path d="M3.6 12.9a6.2 6.2 0 0 0 11.2 2.7l1.8-1.8" />
      <path d="M16.6 17.5v-3.7h-3.7" />
    </svg>
  );
}

export function UserChatPanel({
  scenario,
  adState,
  interactionValue,
  liveRefreshStatus,
  answerStream,
  useStreamedAnswer,
  answerError,
  measuredPerformance,
  composerModelName,
  cleanChatReady,
  newChatNoticeOpen,
  submittedQuestion,
  onInteractionValue,
  onCta,
  onDismiss,
  onNotRelevant,
  onDisclosure,
  onRetryAnswer,
  onResetAd,
  onRunLive,
  onCancelNewChat,
  onConfirmNewChat,
  onStartCleanChat,
  onSubmitQuestion
}: {
  scenario: Phase4DemoScenario;
  adState: AdState;
  interactionValue: string;
  liveRefreshStatus: AsyncStatus;
  answerStream: AnswerStreamState;
  useStreamedAnswer: boolean;
  answerError: string;
  measuredPerformance?: RuntimePerformanceMeasurement;
  composerModelName: string;
  cleanChatReady: boolean;
  newChatNoticeOpen: boolean;
  submittedQuestion?: string;
  onInteractionValue: (value: string) => void;
  onCta: () => void;
  onDismiss: () => void;
  onNotRelevant: () => void;
  onDisclosure: () => void;
  onRetryAnswer: () => void;
  onResetAd: () => void;
  onRunLive: () => void;
  onCancelNewChat: () => void;
  onConfirmNewChat: () => void;
  onStartCleanChat: () => void;
  onSubmitQuestion: (userQuestion: string) => void;
}) {
  const [draftQuestion, setDraftQuestion] = useState("");
  const answerVisible = adState !== "visible" || Boolean(answerError);
  const adSelectionLoading = shouldRenderSponsoredAdLoading({
    adState,
    liveRefreshStatus,
    useStreamedAnswer
  });
  const modelSnippet = formatModelSnippet(composerModelName);
  const hasDraftQuestion = draftQuestion.trim().length > 0;
  const composerAction = cleanChatReady ? onStartCleanChat : onRunLive;
  const composerLabel = hasDraftQuestion
    ? "Send message"
    : cleanChatReady ? "Start new chat" : "Refresh response";
  const composerPlaceholder = cleanChatReady ? "Start a fresh chat..." : "Ask anything...";
  const activeUserQuestion = submittedQuestion ?? scenario.userChat.userQuestion;

  function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (hasDraftQuestion) {
      onSubmitQuestion(draftQuestion);
      setDraftQuestion("");
      return;
    }

    composerAction();
  }

  useEffect(() => {
    setDraftQuestion("");
  }, [scenario.theme, cleanChatReady]);

  return (
    <section className="chat-panel chat-panel--conversation" aria-label="User chat demo">
      <div className="chat-thread">
        {newChatNoticeOpen ? (
          <section
            className="new-chat-notice"
            role="dialog"
            aria-live="polite"
            aria-labelledby="new-chat-title"
            aria-describedby="new-chat-description"
          >
            <div>
              <strong id="new-chat-title">Start a new chat?</strong>
              <p id="new-chat-description">Your current conversation will be discarded.</p>
            </div>
            <div className="new-chat-notice-actions">
              <button type="button" className="small-button" onClick={onCancelNewChat}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={onConfirmNewChat}>
                Continue
              </button>
            </div>
          </section>
        ) : null}
        <div className="conversation-date">Today</div>
        {cleanChatReady ? (
          <div className="conversation-stack conversation-stack--empty">
            <section className="empty-chat-state" aria-label="New chat ready">
              <span>New chat</span>
              <h2>Ready when you are.</h2>
              <p>Your previous conversation was discarded. Start fresh from a clean thread.</p>
            </section>
          </div>
        ) : (
          <div className="conversation-stack">
            <article className="message user-message chat-bubble">
	              <div className="message-meta">
	                <span>You</span>
	                <time dateTime="2026-05-20T10:24:00">10:24 AM</time>
	              </div>
	              <p>{activeUserQuestion}</p>
	            </article>

            <div className="thread-label">
              <span>Advertiser message</span>
              <time dateTime="2026-05-20T10:24:00">10:24 AM</time>
            </div>

            {adState === "visible" ? null : (
              <SponsoredReceipt
                scenario={scenario}
                adState={adState}
                measuredPerformance={measuredPerformance}
                onDisclosure={onDisclosure}
                onResetAd={onResetAd}
              />
            )}

            {adSelectionLoading ? (
              <SponsoredAdLoadingFrame />
            ) : adState === "visible" && !answerError ? (
              <SponsoredFrame
                scenario={scenario}
                interactionValue={interactionValue}
                onInteractionValue={onInteractionValue}
                onCta={onCta}
                onDismiss={onDismiss}
                onNotRelevant={onNotRelevant}
                onDisclosure={onDisclosure}
              />
            ) : null}

            {answerVisible ? (
              <ResolvedAnswer
                scenario={scenario}
                adState={adState}
                answerStream={answerStream}
                useStreamedAnswer={useStreamedAnswer}
                answerError={answerError}
                measuredPerformance={measuredPerformance}
                onDisclosure={onDisclosure}
                onRetryAnswer={onRetryAnswer}
              />
            ) : null}
          </div>
        )}

	        <form className="chat-composer" aria-label="Chat composer" onSubmit={handleComposerSubmit}>
	          <span
	            className="composer-model-snippet"
	            title={composerModelName}
            aria-label={`Current model: ${composerModelName}`}
          >
            <span>Model</span>
            <strong>{modelSnippet}</strong>
	          </span>
	          <div className="composer-field">
	            <input
	              type="text"
	              value={draftQuestion}
	              placeholder={composerPlaceholder}
	              aria-label="Ask anything"
	              onChange={(event) => setDraftQuestion(event.currentTarget.value)}
	            />
	            <p>
	              {cleanChatReady
	                ? "Previous conversation discarded. Your data stays private."
                : "Private by design. Your data is not shared with advertisers."}
            </p>
          </div>
          <button
	            className="composer-send"
	            type="submit"
	            aria-label={composerLabel}
	            disabled={liveRefreshStatus === "pending"}
	          >
	            <ArrowUpIcon />
	          </button>
	        </form>
      </div>
    </section>
  );
}

export function shouldRenderSponsoredAdLoading({
  adState,
  liveRefreshStatus,
  useStreamedAnswer
}: {
  adState: "visible" | "cta" | "dismissed" | "not_relevant";
  liveRefreshStatus: "idle" | "pending" | "failed";
  useStreamedAnswer: boolean;
}) {
  return useStreamedAnswer && adState === "visible" && liveRefreshStatus === "pending";
}

function formatModelSnippet(modelName: string): string {
  const normalized = modelName.trim();

  if (!normalized) {
    return "Fixture";
  }

  if (normalized === "deterministic fixture") {
    return "Fixture";
  }

  const shortName = normalized.split("/").pop() ?? normalized;
  const label = shortName.replace(/-/g, " ");

  return label
    .replace(/^gpt (?=\d)/i, "GPT-")
    .replace(/^gemini\b/i, "Gemini")
    .replace(/^claude\b/i, "Claude")
    .replace(/^llama\b/i, "Llama")
    .replace(/\bflash\b/i, "Flash");
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

function SponsoredReceipt({
  scenario,
  adState,
  measuredPerformance,
  onDisclosure,
  onResetAd
}: {
  scenario: Phase4DemoScenario;
  adState: AdState;
  measuredPerformance?: RuntimePerformanceMeasurement;
  onDisclosure: () => void;
  onResetAd: () => void;
}) {
  const interstitial = scenario.adExperience.interstitial;
  const outcome = getAdOutcome(scenario, adState, measuredPerformance);

  return (
    <section className={`sponsored-receipt sponsored-receipt--${outcome.tone}`} aria-label="Closed sponsored message">
      <div>
        <span className="sponsored-label">{interstitial.label}</span>
        <strong>{interstitial.advertiserName}</strong>
        <p>{outcome.title}</p>
        <small>{outcome.scoreLabel} - {outcome.hashLabel}</small>
      </div>
      <div className="receipt-actions">
        <button className="small-button" type="button" onClick={onDisclosure}>
          Why this ad
        </button>
        <button className="small-button" type="button" onClick={onResetAd}>
          Undo close
        </button>
      </div>
    </section>
  );
}

export function SponsoredAdLoadingFrame() {
  return (
    <section
      className="sponsored-loading-frame"
      role="status"
      aria-live="polite"
      aria-label="Ad loading"
    >
      <span className="sponsored-loading-icon" aria-hidden="true">
        <ShieldIcon />
      </span>
      <div className="sponsored-loading-copy">
        <span className="sponsored-label">Ad loading</span>
        <h2>Selecting a privacy-safe sponsored message...</h2>
        <p>Matching approved campaigns without sharing your private chat with advertisers.</p>
      </div>
    </section>
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
  const spec = normalizeVisualSpec(interstitial.visualSpec);
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
        <div className="sponsored-kicker">
          <span className="sponsored-label">{interstitial.label}</span>
          <span className="advertiser-name">{interstitial.advertiserName}</span>
          <span className="verified-dot" aria-label="Verified advertiser" />
        </div>
        <button className="small-button disclosure-button" type="button" onClick={onDisclosure}>
          <span>Why this ad</span>
          <InfoIcon />
        </button>
      </header>

      <div className="sponsored-main">
        <span className="sponsor-avatar" aria-hidden="true">
          <ShieldIcon />
        </span>
        <div className="sponsored-copy">
          <h2>{headline}</h2>
          <p className="ad-body">{interstitial.body}</p>
        </div>
      </div>

      <ul className="sponsored-attributes" aria-label="Advertiser approved attributes">
        {spec.cards.slice(0, 3).map((card) => (
          <li key={card.title}>{card.title}</li>
        ))}
      </ul>

      <div className="sponsored-creative-preview" aria-label="Prepared sponsored creative preview">
        <ScriptedGraphic
          visualSpec={interstitial.visualSpec}
          interactionValue={interactionValue}
        />
        <InteractionResult
          visualSpec={interstitial.visualSpec}
          interactionValue={interactionValue}
        />
      </div>

      <div className="interaction-block">
        <label htmlFor="ad-interaction">{interstitial.interactionSpec.prompt}</label>
        <InteractionControl
          interstitial={interstitial}
          value={interactionValue}
          onChange={onInteractionValue}
        />
      </div>

      <div className="action-row">
        <button className="primary-button sponsored-cta" type="button" onClick={onCta}>
          <span>{interstitial.cta.label}</span>
          <ExternalIcon />
        </button>
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
        <button type="button" onClick={onNotRelevant}>
          Not relevant
        </button>
      </div>
      <p className="sponsored-privacy">
        <ShieldIcon />
        Your choice stays private. We do not share this with advertisers.
      </p>
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

function InteractionResult({
  visualSpec,
  interactionValue
}: {
  visualSpec: unknown;
  interactionValue: string;
}) {
  const spec = normalizeVisualSpec(visualSpec);
  const resultSpec = spec.resultSpec;

  if (resultSpec.type === "slider") {
    const numericValue = Number(interactionValue || 0);
    const activeBand = resultSpec.bands.find((band) =>
      numericValue >= band.min && numericValue <= band.max
    ) ?? resultSpec.bands[0];

    return (
      <section className="interaction-result interaction-result--slider" aria-label="Slider preview result">
        <div className="interaction-result-header">
          <span>Slider preview</span>
          <strong>{activeBand.label}</strong>
        </div>
        <div className="slider-meter-preview" aria-hidden="true">
          {resultSpec.bands.map((band) => (
            <span
              key={`${band.min}-${band.max}`}
              className={band === activeBand ? "is-active" : ""}
            />
          ))}
        </div>
        <p>{activeBand.detail}</p>
        <small>{resultSpec.minLabel} to {resultSpec.maxLabel}</small>
      </section>
    );
  }

  if (resultSpec.type === "short_text") {
    const value = interactionValue.trim() || "your outcome";

    return (
      <section className="interaction-result interaction-result--short-text" aria-label="Short text preview result">
        <div className="interaction-result-header">
          <span>Short text result</span>
          <strong>{resultSpec.resultTitle}</strong>
        </div>
        <p>{resultSpec.resultTemplate.replace("{value}", value)}</p>
        <small>{resultSpec.examples.slice(0, 2).join(" + ")}</small>
      </section>
    );
  }

  const selectedValue = interactionValue || resultSpec.outcomes[0]?.value || "";
  const selectedOutcome =
    resultSpec.outcomes.find((outcome) => outcome.value === selectedValue) ??
    resultSpec.outcomes[0];

  return (
    <section className="interaction-result interaction-result--choice" aria-label="Choice preview result">
      <div className="interaction-result-header">
        <span>Choice result</span>
        <strong>{selectedOutcome.title}</strong>
      </div>
      <p>{selectedOutcome.detail}</p>
      <small>{selectedOutcome.highlight}</small>
    </section>
  );
}

function ResolvedAnswer({
  scenario,
  adState,
  answerStream,
  useStreamedAnswer,
  answerError,
  measuredPerformance,
  onDisclosure,
  onRetryAnswer
}: {
  scenario: Phase4DemoScenario;
  adState: AdState;
  answerStream: AnswerStreamState;
  useStreamedAnswer: boolean;
  answerError: string;
  measuredPerformance?: RuntimePerformanceMeasurement;
  onDisclosure: () => void;
  onRetryAnswer: () => void;
}) {
  const hasAnswerError = Boolean(answerError);
  const outcome = hasAnswerError ? null : getAdOutcome(scenario, adState, measuredPerformance);
  const streamedAnswerText = answerStream.text.trim() ? answerStream.text : "";
  const answerText = useStreamedAnswer ? streamedAnswerText : scenario.userChat.serviceAnswer;
  const answerPending = useStreamedAnswer &&
    !hasAnswerError &&
    (answerStream.status === "idle" || answerStream.status === "pending") &&
    !answerText;
  const answerStreaming = useStreamedAnswer && answerStream.status === "pending";
  const answerReady = !hasAnswerError &&
    (!useStreamedAnswer || answerStream.status === "complete");
  const canRetryAnswer = useStreamedAnswer && (hasAnswerError || answerReady);

  return (
    <>
      <div className="thread-label thread-label--answer">
        <span>Adrail</span>
        <time dateTime="2026-05-20T10:25:00">10:25 AM</time>
      </div>
      <article
        className={`message system-message answer-card ${hasAnswerError ? "answer-card--error" : ""} ${answerStreaming ? "answer-card--streaming" : ""}`}
        aria-live={hasAnswerError ? "assertive" : "polite"}
      >
        <div className="message-meta">
          <span>{hasAnswerError ? "Answer failed" : answerStreaming ? "Answer streaming" : "Answer"}</span>
          <time dateTime="2026-05-20T10:25:00">10:25 AM</time>
        </div>
        {hasAnswerError ? (
          <div className="answer-error-copy" role="status">
            <AlertIcon />
            <div>
              <strong>LLM answer failed</strong>
              <p>{answerError}</p>
            </div>
          </div>
        ) : answerPending ? (
          <p className="streaming-answer-placeholder">Preparing a private answer...</p>
        ) : (
          <p>
            {answerText}
            {answerStreaming ? <span className="streaming-answer-cursor" aria-hidden="true" /> : null}
          </p>
        )}
        <div className={`answer-source ${hasAnswerError ? "answer-source--error" : ""}`}>
          <span>{hasAnswerError ? "Server response failed" : answerStreaming ? "Streaming privately" : "Private to you"}</span>
          <span>
            {hasAnswerError
              ? "No deterministic fixture answer was substituted."
              : answerStreaming
                ? "Advertiser data stays out of the Answer Agent input."
                : "Sources retrieved securely, not used for training."}
          </span>
        </div>
        {canRetryAnswer || answerReady ? (
          <div
            className="answer-actions"
            aria-label={answerReady ? "Answer and proof controls" : "Answer retry controls"}
          >
            {canRetryAnswer ? (
              <button
                className="proof-chip proof-chip--plain answer-retry-button"
                type="button"
                aria-label="Retry answer"
                onClick={onRetryAnswer}
              >
                <RetryIcon />
                Retry answer
              </button>
            ) : null}
            {answerReady ? (
              <>
                <button className="proof-chip" type="button" onClick={onDisclosure}>
                  <ShieldIcon />
                  Why this ad
                </button>
                <button className="proof-chip" type="button" onClick={onDisclosure}>
                  Ad proof
                </button>
                <span className={`proof-chip proof-chip--${outcome?.tone}`}>
                  Settlement
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      </article>
    </>
  );
}

function AdvertiserConsole({
  activeStep,
  scenario,
  scenarios,
  policyText,
  compilePreview,
  compileStatus,
  compileError,
  compileStatusByTheme,
  selectedThemes,
  matchingModeByTheme,
  customForm,
  onTheme,
  onSelectedThemes,
  onMatchingMode,
  onPolicyText,
  onCompile,
  onCustomForm,
  onAddCustomPreset,
  customPresetError,
  canDeleteSelectedCampaign,
  campaignDeleteNotice,
  onDeleteSelectedCampaign
}: {
  activeStep: AdvertiserConsoleStep;
  scenario: Phase4DemoScenario;
  scenarios: Phase4DemoScenario[];
  policyText: string;
  compilePreview: CompilePreview;
  compileStatus: CompileStatus;
  compileError: string;
  compileStatusByTheme: Record<string, CompileStatus>;
  selectedThemes: string[];
  matchingModeByTheme: Record<string, MatchingMode>;
  customForm: CustomPresetFormState;
  onTheme: (theme: DemoAdTheme) => void;
  onSelectedThemes: (themes: string[], activeTheme?: DemoAdTheme) => void;
  onMatchingMode: (theme: string, mode: MatchingMode) => void;
  onPolicyText: (value: string) => void;
  onCompile: () => void;
  onCustomForm: (value: CustomPresetFormState) => void;
  onAddCustomPreset: () => void;
  customPresetError: string;
  canDeleteSelectedCampaign: boolean;
  campaignDeleteNotice: string;
  onDeleteSelectedCampaign: () => void;
}) {
  const adPoolItem = scenario.fixture.adPoolItem;
  const activeMatchingStatus = getActiveMatchingModeStatus({
    selectedThemes,
    matchingModeByTheme
  });
  const stageCopy: Record<typeof activeStep, { eyebrow: string; title: string; detail: string }> = {
    overview: {
      eyebrow: "Campaigns",
      title: "Campaigns",
      detail: "Choose a campaign to manage."
    },
    create: {
      eyebrow: "Create campaign",
      title: "Campaign brief",
      detail: "Define the advertiser, offer, CTA, and demo seed."
    },
    targeting: {
      eyebrow: "Targeting",
      title: "Target policy",
      detail: "Write who this campaign should reach."
    },
    creative: {
      eyebrow: "Creative",
      title: "Ad pool and claim boundaries",
      detail: "Confirm the offer, required attributes, prohibited claims, and interaction."
    }
  };

  return (
    <section className="console-section" aria-label="Advertiser console">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{stageCopy[activeStep].eyebrow}</p>
          <h2>{stageCopy[activeStep].title}</h2>
          <p className="console-subcopy">{stageCopy[activeStep].detail}</p>
        </div>
        <div className="panel-actions">
          <span className="status-pill">{scenario.advertiserConsole.campaignStatus}</span>
          {activeStep === "overview" ? (
            <button
              className="small-button danger-button"
              type="button"
              disabled={!canDeleteSelectedCampaign}
              title={canDeleteSelectedCampaign ? `Delete ${scenario.advertiserConsole.campaignName}` : "Seed campaigns are locked"}
              onClick={onDeleteSelectedCampaign}
            >
              Delete selected
            </button>
          ) : null}
        </div>
      </header>

      {activeStep === "overview" ? (
        <>
          <div
            className={`matching-mode-status matching-mode-status--${activeMatchingStatus.mode}`}
            role="status"
            aria-live="polite"
          >
            <span>Mode</span>
            <strong>{activeMatchingStatus.label}</strong>
            <small>{activeMatchingStatus.detail}</small>
          </div>
          <table className="campaign-list campaign-table" aria-label="Campaign presets">
            <thead>
              <tr>
                <th scope="col">Active</th>
                <th scope="col">Campaign</th>
                <th scope="col">Matching</th>
                <th scope="col">Status</th>
                <th scope="col">Budget</th>
                <th scope="col">Policy</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((candidate) => {
                const isSelected = candidate.theme === scenario.theme;
                const rowCompileStatus = compileStatusByTheme[candidate.theme] ?? "ready";
                const isReady = rowCompileStatus === "ready";
                const isChecked = selectedThemes.includes(candidate.theme);
                const canToggleActive = isReady || isChecked;
                const matchingMode = matchingModeByTheme[candidate.theme] ?? "fast";

                return (
                  <tr key={getScenarioRenderKey(candidate)} className={isSelected ? "campaign-row is-active" : "campaign-row"}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Activate ${candidate.advertiserConsole.campaignName}`}
                        checked={isChecked}
                        disabled={!canToggleActive}
                        onChange={(e) => {
                          if (e.currentTarget.checked) {
                            onSelectedThemes([...selectedThemes, candidate.theme], candidate.theme);
                          } else {
                            onSelectedThemes(selectedThemes.filter((t) => t !== candidate.theme));
                          }
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        className="campaign-row-action"
                        onClick={() => onTheme(candidate.theme)}
                      >
                        <strong>{candidate.advertiserConsole.campaignName}</strong>
                        <small>{candidate.advertiserConsole.advertiserName}</small>
                      </button>
                    </td>
                    <td>
                      <div
                        className="matching-mode-toggle"
                        role="group"
                        aria-label={`Matching mode for ${candidate.advertiserConsole.campaignName}`}
                      >
                        <button
                          type="button"
                          className={matchingMode === "fast" ? "is-active" : ""}
                          aria-pressed={matchingMode === "fast"}
                          onClick={() => onMatchingMode(candidate.theme, "fast")}
                        >
                          Fast
                        </button>
                        <button
                          type="button"
                          className={matchingMode === "professional" ? "is-active" : ""}
                          aria-pressed={matchingMode === "professional"}
                          onClick={() => onMatchingMode(candidate.theme, "professional")}
                        >
                          Professional
                        </button>
                      </div>
                    </td>
                    <td>{candidate.advertiserConsole.campaignStatus}</td>
                    <td>{formatCents(candidate.fixture.campaign.budgetCents)}</td>
                    <td>{getCompileStatusCopy(rowCompileStatus).label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {campaignDeleteNotice ? (
            <p className="inline-help campaign-delete-notice" aria-live="polite">
              {campaignDeleteNotice}
            </p>
          ) : null}
        </>
      ) : null}

      {activeStep === "create" ? (
        <CustomPresetBuilder
          value={customForm}
          onChange={onCustomForm}
          onAdd={onAddCustomPreset}
          error={customPresetError}
        />
      ) : null}

      {activeStep === "targeting" ? (
        <div className="targeting-stack">
          <section className="targeting-editor-card" aria-label="Target policy editor">
            <div className="targeting-card-header">
              <label className="field-label" htmlFor="policy-source">
                Audience policy
              </label>
              <span className={`compile-status compile-status--${compileStatus}`}>
                {getCompileStatusCopy(compileStatus).label}
              </span>
            </div>
            <textarea
              id="policy-source"
              value={policyText}
              onChange={(event) => onPolicyText(event.currentTarget.value)}
              rows={4}
            />
            <div className="targeting-actions">
              <button
                className="primary-button"
                type="button"
                disabled={compileStatus === "pending"}
                onClick={onCompile}
              >
                {compileStatus === "pending" ? "Compiling" : "Compile"}
              </button>
              <p className={`inline-help ${compileStatus === "failed" ? "inline-help--error" : ""}`} aria-live="polite">
                {compileStatus === "failed"
                  ? compileError || "Policy compile failed. Check the policy text and try again."
                  : getCompileStatusCopy(compileStatus).detail}
              </p>
            </div>
          </section>

          <section className="targeting-preview" aria-label="Compiled policy preview">
            <header>
              <p className="eyebrow">Preview</p>
              <div className="preview-meta-row" aria-label="Compiled policy metadata">
                <span>{formatSafetyVerdict(compilePreview.safetyVerdict)}</span>
                <code>{shortHash(compilePreview.policyHash)}</code>
              </div>
            </header>
            <p>{compilePreview.compiledSummary}</p>
          </section>
        </div>
      ) : null}

      {activeStep === "creative" ? (
        <>
          <section className="console-stage-card">
            <p className="eyebrow">Approved ad pool</p>
            <h3>{adPoolItem.objective}</h3>
            <p>{adPoolItem.productServiceSummary}</p>
            <dl className="creative-details-grid">
              <div>
                <dt>Interaction</dt>
                <dd>{adPoolItem.allowedInteractionTemplates.join(", ")}</dd>
              </div>
              <div>
                <dt>Review status</dt>
                <dd>{adPoolItem.reviewStatus}</dd>
              </div>
              <div>
                <dt>Deep link</dt>
                <dd>{adPoolItem.landingDeepLinkAction.target}</dd>
              </div>
            </dl>
          </section>

          <section className="console-stage-card">
            <p className="eyebrow">Required attributes</p>
            <ul className="compact-list">
              {adPoolItem.mustIncludeAttributes.map((attribute) => (
                <li key={attribute}>{attribute}</li>
              ))}
            </ul>
          </section>

          <section className="console-stage-card">
            <p className="eyebrow">Prohibited claims</p>
            <ul className="compact-list compact-list--danger">
              {adPoolItem.prohibitedClaims.map((claim) => (
                <li key={claim}>{claim}</li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </section>
  );
}

function CustomPresetBuilder({
  value,
  onChange,
  onAdd,
  error
}: {
  value: CustomPresetFormState;
  onChange: (value: CustomPresetFormState) => void;
  onAdd: () => void;
  error: string;
}) {
  const [activeBuilderStep, setActiveBuilderStep] = useState<CustomPresetBuilderStep>("basics");
  const canAddPreset = [
    value.id,
    value.navigationLabel,
    value.advertiserName,
    value.campaignName,
    value.objective,
    value.productServiceSummary,
    value.naturalLanguageTargetPolicy,
    value.mustIncludeAttributes,
    value.ctaLabel,
    value.ctaTarget,
    value.userQuestion
  ].every((item) => item.trim().length > 0);
  const activeBuilderStepIndex = CUSTOM_PRESET_STEPS.findIndex((step) => step.key === activeBuilderStep);
  const visibleStep = CUSTOM_PRESET_STEPS[activeBuilderStepIndex] ?? CUSTOM_PRESET_STEPS[0];
  const visibleStepComplete = isCustomPresetStepComplete(value, visibleStep.key);
  const isFirstBuilderStep = activeBuilderStepIndex <= 0;
  const isLastBuilderStep = activeBuilderStepIndex === CUSTOM_PRESET_STEPS.length - 1;

  function update(key: keyof CustomPresetFormState, nextValue: string) {
    onChange({
      ...value,
      [key]: nextValue
    });
  }

  function goToNextStep() {
    const nextStep = CUSTOM_PRESET_STEPS[activeBuilderStepIndex + 1];

    if (isLastBuilderStep || !visibleStepComplete) {
      return;
    }

    if (nextStep && canOpenCustomPresetBuilderStep(value, nextStep.key)) {
      setActiveBuilderStep(nextStep.key);
    }
  }

  function goToPreviousStep() {
    if (isFirstBuilderStep) {
      return;
    }

    setActiveBuilderStep(CUSTOM_PRESET_STEPS[activeBuilderStepIndex - 1].key);
  }

  return (
    <section className="preset-builder">
      <header>
        <p className="eyebrow">Create workflow</p>
        <h3>Add campaign preset</h3>
      </header>

      {error ? (
        <div className="notice notice--danger" role="alert">
          {error}
        </div>
      ) : null}

      <nav className="builder-stepper" aria-label="Create workflow steps">
        {CUSTOM_PRESET_STEPS.map((step, index) => {
          const isActive = step.key === activeBuilderStep;
          const isComplete = isCustomPresetStepComplete(value, step.key);
          const canOpenStep = canOpenCustomPresetBuilderStep(value, step.key);

          return (
            <button
              key={step.key}
              type="button"
              className={`${isActive ? "is-active" : ""} ${isComplete ? "is-complete" : ""} ${canOpenStep ? "" : "is-locked"}`}
              aria-current={isActive ? "step" : undefined}
              aria-pressed={isActive}
              disabled={!canOpenStep}
              title={canOpenStep ? undefined : "Complete previous steps first."}
              onClick={() => {
                if (canOpenStep) {
                  setActiveBuilderStep(step.key);
                }
              }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </button>
          );
        })}
      </nav>

      {activeBuilderStep === "basics" ? (
        <section className="builder-section" aria-label="Basics">
          <div className="form-grid">
            <label>
              Preset id
              <input value={value.id} onChange={(event) => update("id", event.currentTarget.value)} />
            </label>
            <label>
              Dashboard label
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
        </section>
      ) : null}

      {activeBuilderStep === "offer" ? (
        <section className="builder-section" aria-label="Offer and targeting">
          <p className="eyebrow">Offer and targeting</p>
          <label className="field-label">
            Product summary
            <textarea
              value={value.productServiceSummary}
              rows={4}
              onChange={(event) => update("productServiceSummary", event.currentTarget.value)}
            />
          </label>
          <label className="field-label">
            Natural-language target policy
            <textarea
              value={value.naturalLanguageTargetPolicy}
              rows={5}
              onChange={(event) => update("naturalLanguageTargetPolicy", event.currentTarget.value)}
            />
          </label>
        </section>
      ) : null}

      {activeBuilderStep === "creative" ? (
        <section className="builder-section" aria-label="Creative boundaries">
          <p className="eyebrow">Creative boundaries</p>
          <div className="form-grid">
            <label>
              Must-include attributes
              <textarea
                value={value.mustIncludeAttributes}
                rows={5}
                onChange={(event) => update("mustIncludeAttributes", event.currentTarget.value)}
              />
            </label>
            <label>
              Prohibited claims
              <textarea
                value={value.prohibitedClaims}
                rows={5}
                onChange={(event) => update("prohibitedClaims", event.currentTarget.value)}
              />
            </label>
          </div>
        </section>
      ) : null}

      {activeBuilderStep === "delivery" ? (
        <section className="builder-section" aria-label="Delivery">
          <p className="eyebrow">Delivery</p>
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
            <label>
              Demo user question
              <input value={value.userQuestion} onChange={(event) => update("userQuestion", event.currentTarget.value)} />
            </label>
          </div>
        </section>
      ) : null}

      <div className="builder-actions">
        <button type="button" disabled={isFirstBuilderStep} onClick={goToPreviousStep}>
          Back
        </button>
        {isLastBuilderStep ? (
          <button className="primary-button" type="button" disabled={!canAddPreset} onClick={onAdd}>
            Add preset
          </button>
        ) : (
          <button className="primary-button" type="button" disabled={!visibleStepComplete} onClick={goToNextStep}>
            Continue
          </button>
        )}
        {!visibleStepComplete ? (
          <span className="inline-help inline-help--error">Complete this step before continuing.</span>
        ) : null}
        {isLastBuilderStep && visibleStepComplete && !canAddPreset ? (
          <span className="inline-help inline-help--error">Fill required preset fields first.</span>
        ) : null}
      </div>
    </section>
  );
}

export function isCustomPresetStepComplete(
  value: CustomPresetFormState,
  stepKey: CustomPresetBuilderStep
): boolean {
  const step = CUSTOM_PRESET_STEPS.find((candidate) => candidate.key === stepKey);

  if (!step) {
    return false;
  }

  return step.requiredFields.every((field) => value[field].trim().length > 0);
}

export function canOpenCustomPresetBuilderStep(
  value: CustomPresetFormState,
  stepKey: CustomPresetBuilderStep
): boolean {
  const targetStepIndex = CUSTOM_PRESET_STEPS.findIndex((candidate) => candidate.key === stepKey);

  if (targetStepIndex < 0) {
    return false;
  }

  return CUSTOM_PRESET_STEPS
    .slice(0, targetStepIndex)
    .every((candidate) => isCustomPresetStepComplete(value, candidate.key));
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
          <p className="eyebrow">Review & approval</p>
          <h2>Submit policy and claims</h2>
        </div>
        <span className={`status-pill status-pill--${reviewStatus}`}>{reviewStatus}</span>
      </header>

      {reviewStatus === "rejected" ? (
        <div className="notice notice--danger" role="status">
          Rejected campaigns cannot serve new sponsored frames or create settlement claims until approved again.
        </div>
      ) : (
        <div className="notice" role="status">
          Approved campaigns can serve sponsored frames and submit attention proofs.
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
  reviewStatus,
  fundingDashboard,
  fundingAmountEth,
  fundingStatus,
  onFundingAmount,
  onSubmitFundingDeposit
}: {
  scenario: Phase4DemoScenario;
  reviewStatus: ReviewStatus;
  fundingDashboard: AdvertiserFundingDashboard;
  fundingAmountEth: string;
  fundingStatus: {
    state: FundingStatus;
    message: string;
  };
  onFundingAmount: (value: string) => void;
  onSubmitFundingDeposit: () => void;
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
          <p className="eyebrow">Budget & settlement</p>
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

      <FundingPanel
        fundingDashboard={fundingDashboard}
        amountEth={fundingAmountEth}
        fundingStatus={fundingStatus}
        isBlocked={isBlocked}
        onAmount={onFundingAmount}
        onSubmitDeposit={onSubmitFundingDeposit}
      />

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

export function PerformanceDashboard({
  scenario,
  reviewStatus,
  measuredPerformance
}: {
  scenario: Phase4DemoScenario;
  reviewStatus: ReviewStatus;
  measuredPerformance?: RuntimePerformanceMeasurement;
}) {
  const dashboard = scenario.settlementDashboard;
  const policy = scenario.fixture.settlementPolicy;
  const isBlocked = reviewStatus === "rejected";
  const shouldShowPerformance = Boolean(measuredPerformance) && !isBlocked;
  const contributionRows = measuredPerformance?.contributionRows ?? [];
  const eligibleSignals = contributionRows
    .filter((row) => row.normalizedScore > 0)
    .map((row) => getSignalLabel(row.signalType))
    .join(", ");

  return (
    <section className="console-section performance-dashboard" aria-label="Campaign performance dashboard">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Performance</p>
          <h2>Measured attention</h2>
          <p className="console-subcopy">
            Browser-session signal quality for this campaign test. No raw transcript, profile vector, direct
            identifier, or browsing history is shown.
          </p>
        </div>
        <span className={`status-pill ${isBlocked ? "status-pill--rejected" : shouldShowPerformance ? "" : "status-pill--neutral"}`}>
          {isBlocked ? "blocked" : shouldShowPerformance ? "measured" : "no data"}
        </span>
      </header>

      {!shouldShowPerformance ? (
        <section className="performance-empty-state" role="status" aria-live="polite">
          <p className="eyebrow">Performance data</p>
          <h3>{isBlocked ? "Campaign review is blocking measurement." : "No verified test event yet."}</h3>
          <p>
            {isBlocked
              ? "Approve the campaign before collecting attention signals or settlement performance."
              : "Run the sponsored message test from User Chat and trigger the CTA. Dwell starts when the sponsored frame appears, and interaction quality only counts after the micro-interaction changes."}
          </p>
          <dl>
            <div>
              <dt>Current scope</dt>
              <dd>Zero measured attention events</dd>
            </div>
            <div>
              <dt>Privacy boundary</dt>
              <dd>Raw conversation, user profile, and browsing history remain hidden</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {shouldShowPerformance ? (
        <>
      <dl className="metric-grid performance-summary">
        <div>
          <dt>Attention score</dt>
          <dd>{formatBps(measuredPerformance?.scoreBps ?? 0)}</dd>
        </div>
        <div>
          <dt>Settlement threshold</dt>
          <dd>{formatBps(measuredPerformance?.thresholdBps ?? 0)}</dd>
        </div>
        <div>
          <dt>Eligible signals</dt>
          <dd>{eligibleSignals || "None"}</dd>
        </div>
        <div>
          <dt>Privacy scope</dt>
          <dd>Measured test event, no identity</dd>
        </div>
      </dl>

      <section className="performance-signal-table" aria-label="Privacy-safe attention signal breakdown">
        <div className="performance-signal-head" aria-hidden="true">
          <span>Signal</span>
          <span>Observed value</span>
          <span>Weight</span>
          <span>Contribution</span>
          <span>Privacy-safe evidence</span>
        </div>
        {contributionRows.map((row) => (
          <div key={row.signalType} className="performance-signal-row">
            <strong>{getSignalLabel(row.signalType)}</strong>
            <span>{getSignalObservedValue(row.signalType, scenario, measuredPerformance)}</span>
            <span>{formatBps(row.weightBps)}</span>
            <span>
              <meter min={0} max={10000} value={row.contributionBps} />
              <b>{formatBps(row.contributionBps)}</b>
            </span>
            <span>{getSignalEvidenceCopy(row.signalType, scenario, measuredPerformance)}</span>
          </div>
        ))}
      </section>

      <section className="performance-evidence-panel">
        <div>
          <p className="eyebrow">Evidence summary</p>
          <h3>{formatBps(Math.round((measuredPerformance?.retention.confidence ?? 0) * 10000))} classifier confidence</h3>
          <p>{measuredPerformance?.retention.rationale}</p>
        </div>
        <dl>
          <div>
            <dt>Policy version</dt>
            <dd>v{policy?.version ?? 1}</dd>
          </div>
          <div>
            <dt>Policy hash</dt>
            <dd><code>{shortHash(dashboard.settlementProof.settlementPolicyHash)}</code></dd>
          </div>
          <div>
            <dt>Evidence chunks</dt>
            <dd>{measuredPerformance?.retention.evidenceCount ?? 0} campaign-safe summaries</dd>
          </div>
          <div>
            <dt>Measured source</dt>
            <dd>Browser session</dd>
          </div>
        </dl>
      </section>
        </>
      ) : null}
    </section>
  );
}

function FundingPanel({
  fundingDashboard,
  amountEth,
  fundingStatus,
  isBlocked,
  onAmount,
  onSubmitDeposit
}: {
  fundingDashboard: AdvertiserFundingDashboard;
  amountEth: string;
  fundingStatus: {
    state: FundingStatus;
    message: string;
  };
  isBlocked: boolean;
  onAmount: (value: string) => void;
  onSubmitDeposit: () => void;
}) {
  const walletStatus = fundingDashboard.walletProfile.verificationStatus;
  const walletAddress = fundingDashboard.walletProfile.walletAddress;
  const history = [...fundingDashboard.ledgerEntries]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  return (
    <section className="console-stage-card funding-panel" aria-label="Campaign escrow funding">
      <header className="funding-panel-header">
        <div>
          <p className="eyebrow">Escrow funding</p>
          <h3>Campaign wallet and spend</h3>
        </div>
        <span className={`status-pill status-pill--wallet-${walletStatus}`}>
          {formatWalletStatus(walletStatus)}
        </span>
      </header>

      <dl className="metric-grid funding-metrics">
        <div>
          <dt>Available</dt>
          <dd>{formatWeiAmount(fundingDashboard.summary.availableWei)} ETH</dd>
        </div>
        <div>
          <dt>Deposited</dt>
          <dd>{formatWeiAmount(fundingDashboard.summary.depositedWei)} ETH</dd>
        </div>
        <div>
          <dt>Spent</dt>
          <dd>{formatWeiAmount(fundingDashboard.summary.spentWei)} ETH</dd>
        </div>
        <div>
          <dt>Pending debit</dt>
          <dd>{formatWeiAmount(fundingDashboard.summary.pendingDebitWei)} ETH</dd>
        </div>
      </dl>

      <div className="funding-form">
        <div className="funding-wallet-readout">
          <span className="funding-wallet-readout__label">Wallet address</span>
          <code className="funding-wallet-readout__value">
            {walletAddress ?? "Not configured"}
          </code>
        </div>
        <label>
          Amount
          <input
            type="text"
            inputMode="decimal"
            value={amountEth}
            placeholder="0.01"
            onChange={(event) => onAmount(event.currentTarget.value)}
          />
        </label>
        <div className="funding-actions">
          <button
            className="primary-button"
            type="button"
            disabled={isBlocked || !walletAddress || fundingStatus.state === "pending"}
            onClick={onSubmitDeposit}
          >
            Fund
          </button>
        </div>
      </div>

      <p className={`inline-help ${fundingStatus.state === "failed" ? "inline-help--error" : ""}`} aria-live="polite">
        {isBlocked ? "Campaign approval is required before new funding actions." : fundingStatus.message}
      </p>

      <section className="funding-history" aria-label="Funding history">
        <header>
          <h4>Wallet settlement history</h4>
          <span>{fundingDashboard.summary.entryCount} entries</span>
        </header>
        <ol>
          {history.map((entry) => (
            <li key={entry.id} className={`funding-history-row funding-history-row--${entry.status}`}>
              <div>
                <strong>{formatLedgerEntryType(entry.type)}</strong>
                <span>{entry.eventName ?? entry.status}</span>
              </div>
              <div>
                <code>{entry.txHash ? shortHash(entry.txHash) : "No tx"}</code>
                <span>{entry.blockNumber ? `Block ${entry.blockNumber}` : "Not indexed"}</span>
              </div>
              <div>
                <strong>{entry.type.includes("debit") ? "-" : "+"}{formatWeiAmount(entry.amountWei)} ETH</strong>
                <span>{entry.status}</span>
              </div>
            </li>
          ))}
        </ol>
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

  const interstitial = scenario.adExperience.interstitial;

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
      <aside className="privacy-drawer privacy-drawer--chat" role="dialog" aria-modal="true" aria-label="Ad disclosure">
        <header className="disclosure-header">
          <div>
            <p className="eyebrow">Why this ad</p>
            <h2>{interstitial.advertiserName}</h2>
          </div>
          <button ref={closeButtonRef} className="small-button disclosure-close" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <section className="disclosure-ad-card" aria-label="Sponsored message summary">
          <div className="disclosure-ad-kicker">
            <span className="sponsored-label">{interstitial.label}</span>
            <strong>{interstitial.advertiserName}</strong>
          </div>
          <h3>{interstitial.headline}</h3>
          <p>{interstitial.body}</p>
        </section>

        <div className="disclosure-section-list">
          <section className="disclosure-section">
            <span className="disclosure-section-icon" aria-hidden="true">
              <InfoIcon />
            </span>
            <div>
              <h3>Why it appeared</h3>
              <p>{interstitial.disclosure.whyShown}</p>
            </div>
          </section>

          <section className="disclosure-section">
            <span className="disclosure-section-icon" aria-hidden="true">
              <ShieldIcon />
            </span>
            <div>
              <h3>Data boundary</h3>
              <p>{interstitial.disclosure.dataBoundary}</p>
            </div>
          </section>

          <section className="disclosure-section">
            <span className="disclosure-section-icon" aria-hidden="true">
              <ShieldIcon />
            </span>
            <div>
              <h3>Your controls</h3>
              <p>You can dismiss this ad, mark the category as not relevant, or keep reading without sharing raw conversation data.</p>
            </div>
          </section>
        </div>

        <div className="disclosure-proof-strip" aria-label="Ad proof metadata">
          <span>Policy</span>
          <code>{shortHash(interstitial.sponsoredMetadata.policyHash)}</code>
        </div>

        <div className="action-row disclosure-actions">
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
      preparedCreative?: {
        resultSpec?: unknown;
      };
    }
    : {};
  const resultSpec = normalizeResultSpec(candidate.preparedCreative?.resultSpec, candidate.interactionPreview?.options);

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
    },
    resultSpec
  };
}

type NormalizedResultSpec =
  | {
      type: "choice";
      outcomes: Array<{
        value: string;
        title: string;
        detail: string;
        highlight: string;
      }>;
    }
  | {
      type: "slider";
      minLabel: string;
      maxLabel: string;
      bands: Array<{
        min: number;
        max: number;
        label: string;
        detail: string;
      }>;
    }
  | {
      type: "short_text";
      placeholder: string;
      resultTitle: string;
      resultTemplate: string;
      examples: string[];
    };

function normalizeResultSpec(value: unknown, fallbackOptions?: string[]): NormalizedResultSpec {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (record.type === "slider" && Array.isArray(record.bands)) {
      const bands = record.bands
        .map((band) => normalizeSliderBand(band))
        .filter((band): band is { min: number; max: number; label: string; detail: string } => Boolean(band));

      if (bands.length > 0) {
        return {
          type: "slider",
          minLabel: typeof record.minLabel === "string" ? record.minLabel : "Light touch",
          maxLabel: typeof record.maxLabel === "string" ? record.maxLabel : "Full plan",
          bands
        };
      }
    }

    if (record.type === "short_text") {
      return {
        type: "short_text",
        placeholder: typeof record.placeholder === "string" ? record.placeholder : "Name the outcome",
        resultTitle: typeof record.resultTitle === "string" ? record.resultTitle : "Drafted sponsored brief",
        resultTemplate: typeof record.resultTemplate === "string"
          ? record.resultTemplate
          : "We will shape \"{value}\" into a sponsored brief.",
        examples: Array.isArray(record.examples)
          ? record.examples.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          : ["Approved attribute"]
      };
    }

    if (record.type === "choice" && Array.isArray(record.outcomes)) {
      const outcomes = record.outcomes
        .map((outcome) => normalizeChoiceOutcome(outcome))
        .filter((outcome): outcome is { value: string; title: string; detail: string; highlight: string } => Boolean(outcome));

      if (outcomes.length > 0) {
        return {
          type: "choice",
          outcomes
        };
      }
    }
  }

  const options = fallbackOptions && fallbackOptions.length > 0 ? fallbackOptions : ["Compare", "Continue"];

  return {
    type: "choice",
    outcomes: options.map((option) => ({
      value: option,
      title: `${option} path`,
      detail: `Prepared result for ${option}.`,
      highlight: option
    }))
  };
}

function normalizeChoiceOutcome(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const optionValue = typeof record.value === "string" ? record.value : "";

  if (!optionValue) {
    return null;
  }

  return {
    value: optionValue,
    title: typeof record.title === "string" ? record.title : `${optionValue} path`,
    detail: typeof record.detail === "string" ? record.detail : `Prepared result for ${optionValue}.`,
    highlight: typeof record.highlight === "string" ? record.highlight : optionValue
  };
}

function normalizeSliderBand(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const min = typeof record.min === "number" ? record.min : Number(record.min);
  const max = typeof record.max === "number" ? record.max : Number(record.max);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }

  return {
    min,
    max,
    label: typeof record.label === "string" ? record.label : "Prepared band",
    detail: typeof record.detail === "string" ? record.detail : "Prepared sponsored preview."
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

function getAdOutcome(
  scenario: Phase4DemoScenario,
  adState: AdState,
  measuredPerformance?: RuntimePerformanceMeasurement
) {
  if (adState === "cta") {
    const scoreLabel = measuredPerformance
      ? `${formatBps(measuredPerformance.scoreBps)} measured attention score`
      : `${formatBps(scenario.settlementDashboard.attentionEvent.scoreBps)} fixture attention score`;
    const hashLabel = measuredPerformance
      ? measuredPerformance.settlementEligible ? "eligible proof" : "below threshold"
      : shortHash(scenario.settlementDashboard.transactionHash);

    return {
      title: "CTA verified as an agent deep-link",
      detail: measuredPerformance
        ? "This proof uses the browser-measured dwell, interaction, and CTA event from this session."
        : "The user chose the sponsored CTA, so attention proof can be submitted.",
      scoreLabel,
      hashLabel,
      tone: measuredPerformance?.settlementEligible === false ? "neutral" : "success"
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
    submitted: "Settlement submitted",
    pending: "Settlement pending",
    rejected: "Settlement rejected"
  };

  return copy[value] ?? value.replaceAll("_", " ");
}

function formatWalletStatus(value: AdvertiserFundingDashboard["walletProfile"]["verificationStatus"]): string {
  const copy: Record<AdvertiserFundingDashboard["walletProfile"]["verificationStatus"], string> = {
    unconfigured: "No wallet",
    format_valid: "Valid format",
    configured_match: "Wallet linked",
    mismatch: "Mismatch"
  };

  return copy[value];
}

function formatLedgerEntryType(value: EscrowLedgerEntry["type"]): string {
  const copy: Record<EscrowLedgerEntry["type"], string> = {
    deposit: "Deposit",
    attention_debit: "Attention debit",
    failed_debit: "Failed debit",
    refund: "Refund"
  };

  return copy[value];
}

function getSignalLabel(value: Phase4DemoScenario["settlementDashboard"]["contributionRows"][number]["signalType"]): string {
  const copy: Record<Phase4DemoScenario["settlementDashboard"]["contributionRows"][number]["signalType"], string> = {
    dwell: "Dwell",
    realtime_interaction: "Realtime interaction",
    context_retention: "Context retention",
    deep_link: "Deep link"
  };

  return copy[value];
}

function getSignalObservedValue(
  value: Phase4DemoScenario["settlementDashboard"]["contributionRows"][number]["signalType"],
  scenario: Phase4DemoScenario,
  measuredPerformance?: RuntimePerformanceMeasurement
): string {
  const policy = scenario.fixture.settlementPolicy;
  const attentionEvent = scenario.settlementDashboard.attentionEvent;

  const copy: Record<typeof value, string> = {
    dwell: measuredPerformance
      ? `${measuredPerformance.dwellSeconds}s dwell, ${measuredPerformance.dwellThresholdSeconds}s threshold`
      : `${attentionEvent.dwellSeconds}s dwell, ${policy?.dwellThresholdSeconds ?? 0}s threshold`,
    realtime_interaction: measuredPerformance
      ? `${Math.round(measuredPerformance.realtimeInteractionScore * 100)}% measured interaction quality`
      : `${Math.round(attentionEvent.realtimeInteractionScore * 100)}% ad interaction quality`,
    context_retention: measuredPerformance
      ? `${Math.round(measuredPerformance.contextRetentionScore * 100)}% measured follow-up retention`
      : `${Math.round(attentionEvent.contextRetentionScore * 100)}% campaign context retained`,
    deep_link: measuredPerformance
      ? `${Math.round(measuredPerformance.deepLinkScore * 100)}% CTA handoff verification`
      : `${Math.round(attentionEvent.deepLinkScore * 100)}% agent deep-link verification`
  };

  return copy[value];
}

function getSignalEvidenceCopy(
  value: Phase4DemoScenario["settlementDashboard"]["contributionRows"][number]["signalType"],
  scenario: Phase4DemoScenario,
  measuredPerformance?: RuntimePerformanceMeasurement
): string {
  const evidenceCount = measuredPerformance?.retention.evidenceCount ??
    scenario.settlementDashboard.contextRetentionEvidence.evidenceChunks.length;
  const copy: Record<typeof value, string> = {
    dwell: measuredPerformance
      ? "Measured from sponsored frame render until the CTA click in this browser session."
      : "Measured inside the sponsored frame, not tied to a direct identifier.",
    realtime_interaction: measuredPerformance?.interactionTouched
      ? "Counts the micro-interaction changed in the sponsored frame while keeping Answer Agent input isolated."
      : "No sponsored micro-interaction change was measured before the CTA.",
    context_retention: measuredPerformance?.retention.followUpObserved
      ? `${evidenceCount} campaign-safe summaries matched a later measured follow-up. Raw text is not exposed.`
      : "No later follow-up has been measured for this sponsored frame yet.",
    deep_link: "Verifies the campaign CTA handoff only, without showing a browsing history."
  };

  return copy[value];
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

async function readJsonResponse<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    return {} as T;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function extractClientSsePayloads(buffer: string): {
  payloads: string[];
  remainder: string;
} {
  const parts = buffer.split(/\r?\n\r?\n/);
  const remainder = parts.pop() ?? "";
  const payloads = parts
    .map((part) =>
      part
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n")
    )
    .filter(Boolean);

  return { payloads, remainder };
}

function formatCents(value: number): string {
  return `$${(value / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function formatWeiAmount(value: string): string {
  const wei = BigInt(value);
  const whole = wei / 1000000000000000000n;
  const fraction = wei % 1000000000000000000n;
  const fractionText = fraction.toString().padStart(18, "0").replace(/0+$/, "");

  if (!fractionText) {
    return whole.toString();
  }

  return `${whole}.${fractionText.slice(0, 6)}`;
}

function shortHash(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export function formStateToPreset(value: CustomPresetFormState): DemoPresetDraft {
  return {
    id: normalizeDemoPresetId(value.id),
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
