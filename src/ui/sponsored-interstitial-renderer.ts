import { createElement, type ReactElement } from "react";
import {
  type SponsoredInterstitial,
  sponsoredInterstitialSchema
} from "../domain/schemas";
import {
  ScriptedGraphicRenderer,
  renderScriptedGraphicHtml
} from "./scripted-graphic-renderer";

type SponsoredInterstitialRendererProps = {
  interstitial: SponsoredInterstitial;
  onDismiss?: () => void;
  onNotRelevant?: () => void;
  onCta?: () => void;
  onInteract?: (value: string) => void;
};

export function SponsoredInterstitialRenderer({
  interstitial,
  onDismiss,
  onNotRelevant,
  onCta,
  onInteract
}: SponsoredInterstitialRendererProps): ReactElement {
  const sponsoredInterstitial = sponsoredInterstitialSchema.parse(interstitial);
  const interactionControls = buildInteractionControls(sponsoredInterstitial, onInteract);

  return createElement(
    "section",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Sponsored interstitial",
      "data-sponsored": "true",
      "data-campaign-id": sponsoredInterstitial.campaignId,
      className: "sponsored-interstitial"
    },
    createElement(
      "header",
      { className: "sponsored-interstitial__header" },
      createElement("span", { className: "sponsored-interstitial__label" }, sponsoredInterstitial.label),
      createElement("span", { className: "sponsored-interstitial__advertiser" }, sponsoredInterstitial.advertiserName)
    ),
    createElement("h2", { className: "sponsored-interstitial__headline" }, sponsoredInterstitial.headline),
    createElement("p", { className: "sponsored-interstitial__body" }, sponsoredInterstitial.body),
    createElement(ScriptedGraphicRenderer, { visualSpec: sponsoredInterstitial.visualSpec }),
    createElement(
      "div",
      { className: "sponsored-interstitial__interaction" },
      createElement("p", null, sponsoredInterstitial.interactionSpec.prompt),
      ...interactionControls
    ),
    createElement(
      "div",
      { className: "sponsored-interstitial__actions" },
      createElement("button", { type: "button", onClick: onCta }, sponsoredInterstitial.cta.label),
      createElement("button", { type: "button", onClick: onDismiss }, "Dismiss"),
      createElement("button", { type: "button", onClick: onNotRelevant }, "Not relevant")
    ),
    createElement(
      "details",
      { className: "sponsored-interstitial__disclosure" },
      createElement("summary", null, "Why this ad?"),
      createElement("p", null, sponsoredInterstitial.disclosure.whyShown),
      createElement("p", null, sponsoredInterstitial.disclosure.dataBoundary)
    )
  );
}

export function renderSponsoredInterstitialHtml(interstitial: SponsoredInterstitial): string {
  const sponsoredInterstitial = sponsoredInterstitialSchema.parse(interstitial);
  const interactionControls = renderInteractionControls(sponsoredInterstitial);

  return [
    `<section class="sponsored-interstitial" role="dialog" aria-modal="true" data-sponsored="true" data-campaign-id="${escapeHtml(sponsoredInterstitial.campaignId)}">`,
    `<header><span class="sponsored-interstitial__label">${sponsoredInterstitial.label}</span><span>${escapeHtml(sponsoredInterstitial.advertiserName)}</span></header>`,
    `<h2>${escapeHtml(sponsoredInterstitial.headline)}</h2>`,
    `<p>${escapeHtml(sponsoredInterstitial.body)}</p>`,
    renderScriptedGraphicHtml(sponsoredInterstitial.visualSpec),
    `<div class="sponsored-interstitial__interaction"><p>${escapeHtml(sponsoredInterstitial.interactionSpec.prompt)}</p>${interactionControls}</div>`,
    `<div class="sponsored-interstitial__actions"><button>${escapeHtml(sponsoredInterstitial.cta.label)}</button><button>Dismiss</button><button>Not relevant</button></div>`,
    `<details><summary>Why this ad?</summary><p>${escapeHtml(sponsoredInterstitial.disclosure.whyShown)}</p><p>${escapeHtml(sponsoredInterstitial.disclosure.dataBoundary)}</p></details>`,
    `</section>`
  ].join("");
}

function buildInteractionControls(
  interstitial: SponsoredInterstitial,
  onInteract: SponsoredInterstitialRendererProps["onInteract"]
): ReactElement[] {
  if (interstitial.interactionSpec.type === "slider") {
    return [
      createElement("input", {
        key: "slider",
        type: "range",
        min: "0",
        max: String(interstitial.interactionSpec.allowedOutputs.at(-1) ?? "20"),
        step: "1",
        onChange: (event: { currentTarget: { value: string } }) => onInteract?.(event.currentTarget.value)
      })
    ];
  }

  if (interstitial.interactionSpec.type === "short_text") {
    return [
      createElement("input", {
        key: "short_text",
        type: "text",
        "aria-label": interstitial.interactionSpec.prompt,
        onChange: (event: { currentTarget: { value: string } }) => onInteract?.(event.currentTarget.value)
      })
    ];
  }

  return interstitial.interactionSpec.allowedOutputs.map((option) =>
    createElement(
      "button",
      {
        key: option,
        type: "button",
        onClick: () => onInteract?.(option)
      },
      option
    )
  );
}

function renderInteractionControls(interstitial: SponsoredInterstitial): string {
  if (interstitial.interactionSpec.type === "slider") {
    const max = interstitial.interactionSpec.allowedOutputs.at(-1) ?? "20";
    return `<input type="range" min="0" max="${escapeHtml(max)}" step="1" />`;
  }

  if (interstitial.interactionSpec.type === "short_text") {
    return `<input type="text" aria-label="${escapeHtml(interstitial.interactionSpec.prompt)}" />`;
  }

  return interstitial.interactionSpec.allowedOutputs
    .map((option) => `<button>${escapeHtml(option)}</button>`)
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
