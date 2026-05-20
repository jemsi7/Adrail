import { dedupeEscrowLedgerEntries } from "./advertiser-funding";
import type { EscrowLedgerEntry } from "./schemas";

const escrowLedgerEntriesByCampaign = new Map<string, EscrowLedgerEntry[]>();

export function getStoredEscrowLedgerEntries(campaignId: string): EscrowLedgerEntry[] {
  return [...(escrowLedgerEntriesByCampaign.get(campaignId) ?? [])];
}

export function recordEscrowLedgerEntry(entry: EscrowLedgerEntry): EscrowLedgerEntry {
  const entries = dedupeEscrowLedgerEntries([
    ...getStoredEscrowLedgerEntries(entry.campaignId),
    entry
  ]);

  escrowLedgerEntriesByCampaign.set(entry.campaignId, entries);
  return entry;
}

export function clearEscrowLedgerStore(): void {
  escrowLedgerEntriesByCampaign.clear();
}
