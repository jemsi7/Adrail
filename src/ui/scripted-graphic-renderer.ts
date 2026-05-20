import { createElement, type ReactElement } from "react";
import { type ScriptedGraphicSpec } from "../domain/ad-generation";

type ScriptedGraphicRendererProps = {
  visualSpec: unknown;
};

export function ScriptedGraphicRenderer({
  visualSpec
}: ScriptedGraphicRendererProps): ReactElement {
  const spec = normalizeScriptedGraphicSpec(visualSpec);

  return createElement(
    "section",
    {
      "aria-label": "Sponsored interactive graphic",
      "data-renderer": spec.renderer,
      "data-theme": spec.theme,
      className: "scripted-graphic"
    },
    createElement("div", {
      className: "scripted-graphic__accent",
      style: { backgroundColor: spec.accentColor }
    }),
    createElement("h3", { className: "scripted-graphic__title" }, spec.headlineAnchor),
    createElement(
      "div",
      { className: `scripted-graphic__cards scripted-graphic__cards--${spec.layout}` },
      ...spec.cards.map((card) =>
        createElement(
          "article",
          { key: card.title, className: "scripted-graphic__card" },
          createElement("strong", null, card.title),
          createElement("span", null, card.detail)
        )
      )
    ),
    createElement(
      "p",
      { className: "scripted-graphic__interaction" },
      `${spec.interactionPreview.prompt}: ${spec.interactionPreview.options.join(" / ")}`
    )
  );
}

export function renderScriptedGraphicHtml(visualSpec: unknown): string {
  const spec = normalizeScriptedGraphicSpec(visualSpec);
  const cards = spec.cards
    .map((card) => [
      `<article class="scripted-graphic__card">`,
      `<strong>${escapeHtml(card.title)}</strong>`,
      `<span>${escapeHtml(card.detail)}</span>`,
      `</article>`
    ].join(""))
    .join("");

  return [
    `<section class="scripted-graphic" data-renderer="${spec.renderer}" data-theme="${spec.theme}">`,
    `<div class="scripted-graphic__accent" style="background-color:${escapeHtml(spec.accentColor)}"></div>`,
    `<h3>${escapeHtml(spec.headlineAnchor)}</h3>`,
    `<div class="scripted-graphic__cards scripted-graphic__cards--${spec.layout}">${cards}</div>`,
    `<p>${escapeHtml(spec.interactionPreview.prompt)}: ${spec.interactionPreview.options.map(escapeHtml).join(" / ")}</p>`,
    `</section>`
  ].join("");
}

export function normalizeScriptedGraphicSpec(visualSpec: unknown): ScriptedGraphicSpec {
  const candidate = visualSpec && typeof visualSpec === "object"
    ? visualSpec as Partial<ScriptedGraphicSpec>
    : {};

  return {
    renderer: "scripted_graphic_v1",
    theme: candidate.theme ?? "general",
    layout: candidate.layout ?? "attribute-stack",
    accentColor: candidate.accentColor ?? "#374151",
    headlineAnchor: candidate.headlineAnchor ?? "Sponsored option",
    cards: Array.isArray(candidate.cards) && candidate.cards.length > 0
      ? candidate.cards.map((card) => ({
        title: String(card.title ?? "Approved attribute"),
        detail: String(card.detail ?? "Included from the campaign brief.")
      }))
      : [{ title: "Approved attribute", detail: "Included from the campaign brief." }],
    interactionPreview: {
      type: candidate.interactionPreview?.type ?? "choice",
      prompt: candidate.interactionPreview?.prompt ?? "Choose what to personalize",
      options: candidate.interactionPreview?.options ?? ["Compare", "Continue"]
    }
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
