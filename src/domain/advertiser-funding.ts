import { formatEther, getAddress, isAddress, keccak256, parseEther, toBytes } from "viem";
import {
  advertiserWalletProfileSchema,
  campaignFundingAccountSchema,
  escrowLedgerEntrySchema,
  fundingBalanceSummarySchema,
  hashStableJson,
  type AdvertiserWalletProfile,
  type CampaignFundingAccount,
  type ContractTransaction,
  type EscrowLedgerEntry,
  type FundingBalanceSummary,
  type SettlementEvent
} from "./schemas";
import type {
  ParsedCampaignDepositContractEvent,
  ParsedSettlementContractEvent
} from "./settlement";

export type AdvertiserFundingDashboard = {
  walletProfile: AdvertiserWalletProfile;
  account: CampaignFundingAccount;
  ledgerEntries: EscrowLedgerEntry[];
  summary: FundingBalanceSummary;
};

export type FundingRuntimePublicConfig = {
  chainId: number;
  escrowContractAddress: string;
  advertiserDepositWallet?: string;
  campaignDepositAmountWei: string;
  settlementPayoutAmountWei: string;
};

const ZERO_WEI = "0";

export function readFundingRuntimePublicConfig(
  env: Record<string, string | undefined> = process.env
): FundingRuntimePublicConfig {
  return {
    chainId: readPositiveInteger(env.CHAIN_ID, 84532),
    escrowContractAddress: env.ESCROW_CONTRACT_ADDRESS &&
      env.ESCROW_CONTRACT_ADDRESS !== "replace_me" &&
      env.ESCROW_CONTRACT_ADDRESS !== "replace_after_deploy"
      ? env.ESCROW_CONTRACT_ADDRESS
      : "0x1111111111111111111111111111111111111111",
    advertiserDepositWallet: env.ADVERTISER_DEPOSIT_WALLET &&
      env.ADVERTISER_DEPOSIT_WALLET !== "replace_me"
      ? env.ADVERTISER_DEPOSIT_WALLET
      : undefined,
    campaignDepositAmountWei: readWeiEnv(env.CAMPAIGN_DEPOSIT_AMOUNT_WEI, "10000000000000000"),
    settlementPayoutAmountWei: readWeiEnv(env.SETTLEMENT_PAYOUT_AMOUNT_WEI, "100000000000000")
  };
}

export function createAdvertiserWalletProfile(input: {
  advertiserId: string;
  walletAddress?: string;
  configuredWalletAddress?: string;
  chainId: number;
  updatedAt: string;
}): AdvertiserWalletProfile {
  const walletAddress = input.walletAddress?.trim();

  if (!walletAddress) {
    return advertiserWalletProfileSchema.parse({
      advertiserId: input.advertiserId,
      chainId: input.chainId,
      verificationStatus: "unconfigured",
      updatedAt: input.updatedAt
    });
  }

  const normalizedWallet = normalizeWalletAddress(walletAddress);
  const configuredWallet = input.configuredWalletAddress
    ? normalizeWalletAddress(input.configuredWalletAddress)
    : undefined;

  return advertiserWalletProfileSchema.parse({
    advertiserId: input.advertiserId,
    walletAddress: normalizedWallet,
    chainId: input.chainId,
    verificationStatus: configuredWallet
      ? normalizedWallet === configuredWallet ? "configured_match" : "mismatch"
      : "format_valid",
    updatedAt: input.updatedAt
  });
}

export function assertWalletCanFund(profile: AdvertiserWalletProfile): void {
  if (profile.verificationStatus !== "configured_match" && profile.verificationStatus !== "format_valid") {
    throw new Error("Advertiser wallet must match the configured testnet deposit wallet.");
  }
}

export function parseEthAmountToWei(value: string): bigint {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Funding amount is required.");
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Funding amount must be a non-negative ETH decimal.");
  }

  const wei = parseEther(trimmed);

  if (wei <= 0n) {
    throw new Error("Funding amount must be greater than zero.");
  }

  return wei;
}

export function formatWeiToEth(wei: string): string {
  return formatEther(BigInt(normalizeWeiAmount(wei)));
}

export function createDemoFundingPolicyHash(campaignId: string): string {
  return keccak256(toBytes(`${campaignId}:approved-policy:v1`)).replace(/^0x/, "");
}

export function createDepositLedgerEntry(input: {
  campaignId: string;
  transaction: ContractTransaction;
  parsedEvent: ParsedCampaignDepositContractEvent;
  createdAt: string;
  updatedAt?: string;
}): EscrowLedgerEntry {
  return escrowLedgerEntrySchema.parse({
    id: ledgerEntryId({
      type: "deposit",
      campaignId: input.campaignId,
      txHash: input.transaction.txHash,
      eventName: input.parsedEvent.eventName
    }),
    campaignId: input.campaignId,
    type: "deposit",
    amountWei: normalizeWeiAmount(input.parsedEvent.amountWei),
    status: input.transaction.status,
    txHash: input.transaction.txHash,
    blockNumber: input.transaction.blockNumber,
    eventName: input.parsedEvent.eventName,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt
  });
}

export function createAttentionDebitLedgerEntry(input: {
  settlementEvent: SettlementEvent;
  transaction: ContractTransaction;
  parsedEvent?: ParsedSettlementContractEvent;
  amountWei: string | bigint;
  createdAt: string;
  updatedAt?: string;
}): EscrowLedgerEntry {
  const failed = input.transaction.status === "failed";

  return escrowLedgerEntrySchema.parse({
    id: ledgerEntryId({
      type: failed ? "failed_debit" : "attention_debit",
      campaignId: input.settlementEvent.campaignId,
      txHash: input.transaction.txHash,
      proofHash: input.settlementEvent.proofHash
    }),
    campaignId: input.settlementEvent.campaignId,
    type: failed ? "failed_debit" : "attention_debit",
    amountWei: normalizeWeiAmount(input.amountWei),
    status: input.transaction.status,
    txHash: input.transaction.txHash,
    blockNumber: input.transaction.blockNumber,
    eventName: input.parsedEvent?.eventName ?? input.transaction.eventName,
    attentionEventId: input.settlementEvent.attentionEventId,
    settlementEventId: input.settlementEvent.id,
    proofHash: input.settlementEvent.proofHash,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt
  });
}

export function createFailedDebitLedgerEntry(input: {
  campaignId: string;
  attentionEventId: string;
  settlementEventId?: string;
  proofHash?: string;
  amountWei: string | bigint;
  reason: string;
  createdAt: string;
}): EscrowLedgerEntry {
  return escrowLedgerEntrySchema.parse({
    id: ledgerEntryId({
      type: "failed_debit",
      campaignId: input.campaignId,
      proofHash: input.proofHash,
      reason: input.reason
    }),
    campaignId: input.campaignId,
    type: "failed_debit",
    amountWei: normalizeWeiAmount(input.amountWei),
    status: "failed",
    eventName: input.reason,
    attentionEventId: input.attentionEventId,
    settlementEventId: input.settlementEventId,
    proofHash: input.proofHash,
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  });
}

export function summarizeEscrowLedger(entries: EscrowLedgerEntry[]): FundingBalanceSummary {
  const uniqueEntries = dedupeEscrowLedgerEntries(entries);
  let deposited = 0n;
  let spent = 0n;
  let pendingDebit = 0n;
  let lastIndexedBlock: number | undefined;

  for (const entry of uniqueEntries) {
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

  if (available < 0n) {
    throw new Error("Escrow ledger would produce a negative available balance.");
  }

  return fundingBalanceSummarySchema.parse({
    depositedWei: deposited.toString(),
    spentWei: spent.toString(),
    availableWei: available.toString(),
    pendingDebitWei: pendingDebit.toString(),
    entryCount: uniqueEntries.length,
    lastIndexedBlock
  });
}

export function createCampaignFundingAccount(input: {
  campaignId: string;
  advertiserId: string;
  chainId: number;
  escrowContractAddress: string;
  walletAddress?: string;
  policyHash: string;
  ledgerEntries?: EscrowLedgerEntry[];
  updatedAt: string;
}): CampaignFundingAccount {
  const summary = summarizeEscrowLedger(input.ledgerEntries ?? []);

  return campaignFundingAccountSchema.parse({
    campaignId: input.campaignId,
    advertiserId: input.advertiserId,
    chainId: input.chainId,
    escrowContractAddress: input.escrowContractAddress,
    walletAddress: input.walletAddress ? normalizeWalletAddress(input.walletAddress) : undefined,
    policyHash: input.policyHash,
    depositedWei: summary.depositedWei,
    spentWei: summary.spentWei,
    availableWei: summary.availableWei,
    pendingDebitWei: summary.pendingDebitWei,
    lastIndexedBlock: summary.lastIndexedBlock,
    updatedAt: input.updatedAt
  });
}

export function createAdvertiserFundingDashboard(input: {
  advertiserId: string;
  campaignId: string;
  chainId: number;
  escrowContractAddress: string;
  walletAddress?: string;
  configuredWalletAddress?: string;
  policyHash: string;
  ledgerEntries: EscrowLedgerEntry[];
  updatedAt: string;
}): AdvertiserFundingDashboard {
  const walletProfile = createAdvertiserWalletProfile({
    advertiserId: input.advertiserId,
    walletAddress: input.walletAddress,
    configuredWalletAddress: input.configuredWalletAddress,
    chainId: input.chainId,
    updatedAt: input.updatedAt
  });
  const account = createCampaignFundingAccount({
    campaignId: input.campaignId,
    advertiserId: input.advertiserId,
    chainId: input.chainId,
    escrowContractAddress: input.escrowContractAddress,
    walletAddress: walletProfile.walletAddress,
    policyHash: input.policyHash,
    ledgerEntries: input.ledgerEntries,
    updatedAt: input.updatedAt
  });

  return {
    walletProfile,
    account,
    ledgerEntries: dedupeEscrowLedgerEntries(input.ledgerEntries),
    summary: summarizeEscrowLedger(input.ledgerEntries)
  };
}

export function dedupeEscrowLedgerEntries(entries: EscrowLedgerEntry[]): EscrowLedgerEntry[] {
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

  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function normalizeWalletAddress(value: string): string {
  const trimmed = value.trim();

  if (!isAddress(trimmed)) {
    throw new Error("Expected a valid EVM wallet address.");
  }

  return getAddress(trimmed);
}

export function normalizeWeiAmount(value: string | bigint): string {
  const normalized = typeof value === "bigint" ? value : BigInt(value);

  if (normalized < 0n) {
    throw new Error("Wei amount cannot be negative.");
  }

  return normalized.toString();
}

function ledgerEntryId(input: Record<string, unknown>): string {
  return `escrow_ledger_${hashStableJson(input).slice(0, 16)}`;
}

function readWeiEnv(value: string | undefined, fallback: string): string {
  if (!value || value === "replace_me") {
    return fallback;
  }

  return normalizeWeiAmount(value);
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value || value === "replace_me") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Expected a positive integer env value.");
  }

  return parsed;
}
