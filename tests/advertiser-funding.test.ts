import { describe, expect, it } from "vitest";
import {
  createAdvertiserFundingDashboard,
  createAdvertiserWalletProfile,
  createAttentionDebitLedgerEntry,
  createCampaignFundingAccount,
  createDepositLedgerEntry,
  createFailedDebitLedgerEntry,
  dedupeEscrowLedgerEntries,
  formatWeiToEth,
  parseEthAmountToWei,
  summarizeEscrowLedger
} from "../src/domain/advertiser-funding";
import type {
  ContractTransaction,
  SettlementEvent
} from "../src/domain/schemas";
import type {
  ParsedCampaignDepositContractEvent,
  ParsedSettlementContractEvent
} from "../src/domain/settlement";

const now = "2026-05-20T06:30:00.000Z";
const indexedAt = "2026-05-20T06:30:12.000Z";
const campaignId = "campaign_travel_001";
const advertiserId = "advertiser_atlas";
const chainId = 84532;
const contractAddress = "0x88ca42ba054470cec6a31e8a25e8368634340b9a";
const walletAddress = "0xf382e32067B8231e57C69Dbcd550A495892F6B83";
const policyHash = "a".repeat(64);
const proofHash = "b".repeat(64);

const depositTransaction: ContractTransaction = {
  id: "contract_tx_deposit",
  chainId,
  contractAddress,
  type: "escrow_deposit",
  txHash: `0x${"1".repeat(64)}`,
  status: "confirmed",
  blockNumber: 41757614,
  eventName: "CampaignDeposited",
  relatedCampaignId: campaignId,
  createdAt: now,
  updatedAt: indexedAt
};

const settlementTransaction: ContractTransaction = {
  id: "contract_tx_settlement",
  chainId,
  contractAddress,
  type: "settlement_claim",
  txHash: `0x${"2".repeat(64)}`,
  status: "confirmed",
  blockNumber: 41757621,
  eventName: "SettlementClaimed",
  relatedCampaignId: campaignId,
  relatedSettlementEventId: "settlement_travel",
  createdAt: now,
  updatedAt: indexedAt
};

const depositEvent: ParsedCampaignDepositContractEvent = {
  eventName: "CampaignDeposited",
  campaignId,
  advertiser: walletAddress,
  amountWei: "10000000000000000",
  policyHash
};

const settlementEvent: SettlementEvent = {
  id: "settlement_travel",
  campaignId,
  attentionEventId: "attention_travel",
  policyHash,
  proofHash,
  scoreBps: 7600,
  thresholdBps: 6500,
  status: "settled",
  transactionHash: settlementTransaction.txHash,
  createdAt: now,
  updatedAt: indexedAt
};

const parsedSettlementEvent: ParsedSettlementContractEvent = {
  eventName: "SettlementClaimed",
  campaignId,
  attentionEventId: settlementEvent.attentionEventId,
  proofHash,
  scoreBps: 7600,
  thresholdBps: 6500
};

describe("advertiser funding ledger", () => {
  it("validates advertiser wallet addresses against the configured testnet wallet", () => {
    const profile = createAdvertiserWalletProfile({
      advertiserId,
      walletAddress: walletAddress.toLowerCase(),
      configuredWalletAddress: walletAddress,
      chainId,
      updatedAt: now
    });

    expect(profile.walletAddress).toBe(walletAddress);
    expect(profile.verificationStatus).toBe("configured_match");
    expect(() =>
      createAdvertiserWalletProfile({
        advertiserId,
        walletAddress: "not-a-wallet",
        configuredWalletAddress: walletAddress,
        chainId,
        updatedAt: now
      })
    ).toThrow(/valid EVM wallet/i);
    expect(createAdvertiserWalletProfile({
      advertiserId,
      chainId,
      updatedAt: now
    }).verificationStatus).toBe("unconfigured");
  });

  it("parses ETH decimal funding input into exact wei strings", () => {
    expect(parseEthAmountToWei("0.01").toString()).toBe("10000000000000000");
    expect(parseEthAmountToWei("0.0001").toString()).toBe("100000000000000");
    expect(formatWeiToEth("10000000000000000")).toBe("0.01");
    expect(() => parseEthAmountToWei("0")).toThrow(/greater than zero/i);
    expect(() => parseEthAmountToWei("-1")).toThrow(/non-negative ETH decimal/i);
  });

  it("maps confirmed deposit and settlement receipts into balances and history", () => {
    const deposit = createDepositLedgerEntry({
      campaignId,
      transaction: depositTransaction,
      parsedEvent: depositEvent,
      createdAt: now,
      updatedAt: indexedAt
    });
    const debit = createAttentionDebitLedgerEntry({
      settlementEvent,
      transaction: settlementTransaction,
      parsedEvent: parsedSettlementEvent,
      amountWei: "100000000000000",
      createdAt: now,
      updatedAt: indexedAt
    });
    const summary = summarizeEscrowLedger([deposit, debit]);
    const account = createCampaignFundingAccount({
      campaignId,
      advertiserId,
      chainId,
      escrowContractAddress: contractAddress,
      walletAddress,
      policyHash,
      ledgerEntries: [deposit, debit],
      updatedAt: indexedAt
    });

    expect(summary.depositedWei).toBe("10000000000000000");
    expect(summary.spentWei).toBe("100000000000000");
    expect(summary.availableWei).toBe("9900000000000000");
    expect(summary.lastIndexedBlock).toBe(41757621);
    expect(account.availableWei).toBe("9900000000000000");
  });

  it("does not double-charge duplicate attention proof ledger entries", () => {
    const deposit = createDepositLedgerEntry({
      campaignId,
      transaction: depositTransaction,
      parsedEvent: depositEvent,
      createdAt: now,
      updatedAt: indexedAt
    });
    const debit = createAttentionDebitLedgerEntry({
      settlementEvent,
      transaction: settlementTransaction,
      parsedEvent: parsedSettlementEvent,
      amountWei: "100000000000000",
      createdAt: now,
      updatedAt: indexedAt
    });
    const duplicate = {
      ...debit,
      id: "duplicate_same_proof"
    };
    const deduped = dedupeEscrowLedgerEntries([debit, duplicate]);
    const summary = summarizeEscrowLedger([deposit, debit, duplicate]);

    expect(deduped).toHaveLength(1);
    expect(summary.spentWei).toBe("100000000000000");
  });

  it("records failed debit attempts without reducing available escrow", () => {
    const deposit = createDepositLedgerEntry({
      campaignId,
      transaction: depositTransaction,
      parsedEvent: depositEvent,
      createdAt: now
    });
    const failed = createFailedDebitLedgerEntry({
      campaignId,
      attentionEventId: settlementEvent.attentionEventId,
      settlementEventId: settlementEvent.id,
      proofHash,
      amountWei: "999999999999999999",
      reason: "InsufficientEscrow",
      createdAt: indexedAt
    });
    const dashboard = createAdvertiserFundingDashboard({
      advertiserId,
      campaignId,
      chainId,
      escrowContractAddress: contractAddress,
      walletAddress,
      configuredWalletAddress: walletAddress,
      policyHash,
      ledgerEntries: [deposit, failed],
      updatedAt: indexedAt
    });

    expect(dashboard.summary.depositedWei).toBe("10000000000000000");
    expect(dashboard.summary.spentWei).toBe("0");
    expect(dashboard.summary.availableWei).toBe("10000000000000000");
    expect(dashboard.ledgerEntries.at(-1)?.type).toBe("failed_debit");
  });
});
