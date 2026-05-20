import {
  type AttentionEvent,
  type ContextRetentionEvidence,
  type ContractTransaction,
  type SettlementEvent
} from "../domain/schemas";

export function renderSettlementDashboardHtml(input: {
  attentionEvent: AttentionEvent;
  contextRetentionEvidence?: ContextRetentionEvidence;
  settlementEvent?: SettlementEvent;
  transaction?: ContractTransaction;
}): string {
  const settlementStatus = input.settlementEvent?.status ?? "attention_pending";
  const txHash = input.transaction?.txHash ?? "No transaction submitted";
  const eventName = input.transaction?.eventName ?? "Awaiting contract event";
  const retentionSummary = input.contextRetentionEvidence
    ? `${Math.round(input.contextRetentionEvidence.score * 100)}% retention confidence ${Math.round(input.contextRetentionEvidence.confidence * 100)}%`
    : "No context retention evidence";

  return [
    '<section class="settlement-dashboard" data-dashboard="settlement">',
    "  <header>",
    "    <p>Settlement Dashboard</p>",
    `    <h2>${escapeHtml(input.attentionEvent.campaignId)}</h2>`,
    "  </header>",
    "  <dl>",
    `    <dt>Attention score</dt><dd data-attention-score="${input.attentionEvent.scoreBps}">${input.attentionEvent.scoreBps} bps</dd>`,
    `    <dt>Threshold</dt><dd>${input.attentionEvent.thresholdBps} bps</dd>`,
    `    <dt>Signals</dt><dd>${escapeHtml(input.attentionEvent.signalTypes.join(", "))}</dd>`,
    `    <dt>Eligibility</dt><dd data-eligible="${input.attentionEvent.settlementEligible}">${input.attentionEvent.settlementEligible ? "Eligible" : "Not eligible"}</dd>`,
    `    <dt>Retention</dt><dd>${escapeHtml(retentionSummary)}</dd>`,
    `    <dt>Settlement status</dt><dd data-settlement-status="${escapeHtml(settlementStatus)}">${escapeHtml(settlementStatus)}</dd>`,
    `    <dt>Transaction hash</dt><dd><code data-transaction-hash>${escapeHtml(txHash)}</code></dd>`,
    `    <dt>Contract event</dt><dd data-contract-event="${escapeHtml(eventName)}">${escapeHtml(eventName)}</dd>`,
    "  </dl>",
    "</section>"
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
