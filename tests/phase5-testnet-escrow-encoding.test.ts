import { describe, expect, it } from "vitest";
import {
  assertPrivacySafeContractArgs,
  depositToContractArgs,
  domainIdToBytes32,
  normalizeBytes32Hash,
  settlementProofToContractArgs
} from "../src/domain/settlement-encoding";
import {
  createEscrowDepositGatewayFromRuntimeConfig,
  createSettlementGatewayFromRuntimeConfig,
  readSettlementRuntimeConfig
} from "../src/domain/settlement-contract";
import {
  indexCampaignDepositContractEvent,
  parseCampaignDepositContractEvent,
  submitEscrowDepositTransaction,
  submitSettlementTransactionAsync
} from "../src/domain/settlement";
import type { SettlementProof } from "../src/domain/schemas";

const now = "2026-05-20T06:30:00.000Z";
const indexedAt = "2026-05-20T06:30:12.000Z";
const chainId = 84532;
const contractAddress = "0x1111111111111111111111111111111111111111";
const policyHash = "a".repeat(64);
const proofHash = "b".repeat(64);
const recipientAddress = "0x2222222222222222222222222222222222222222";

const proof: SettlementProof = {
  campaignId: "campaign_travel_001",
  attentionEventId: "attention_event_001",
  settlementPolicyHash: policyHash,
  signalTypes: ["dwell", "deep_link"],
  scoreBps: 7600,
  thresholdBps: 6500,
  pseudonymousUserProof: "c".repeat(64),
  occurredAt: now,
  proofHash
};

describe("Phase 5 testnet escrow encoding", () => {
  it("encodes domain ids and hashes into bytes32 contract arguments", () => {
    const campaignBytes32 = domainIdToBytes32(proof.campaignId);
    const args = settlementProofToContractArgs({
      proof,
      recipientAddress,
      payoutAmountWei: 1000000000000000n
    });

    expect(campaignBytes32).toMatch(/^0x[a-f0-9]{64}$/);
    expect(domainIdToBytes32(proof.campaignId)).toBe(campaignBytes32);
    expect(domainIdToBytes32(proof.attentionEventId)).not.toBe(campaignBytes32);
    expect(normalizeBytes32Hash(policyHash)).toBe(`0x${policyHash}`);
    expect(args).toEqual([
      domainIdToBytes32(proof.campaignId),
      domainIdToBytes32(proof.attentionEventId),
      `0x${policyHash}`,
      `0x${proofHash}`,
      proof.scoreBps,
      proof.thresholdBps,
      recipientAddress,
      1000000000000000n
    ]);
  });

  it("rejects invalid bytes32, invalid recipient, and private markers in calldata args", () => {
    expect(() => normalizeBytes32Hash("abc")).toThrow(/32-byte/);
    expect(() =>
      settlementProofToContractArgs({
        proof,
        recipientAddress: "not-an-address",
        payoutAmountWei: 1n
      })
    ).toThrow(/address/i);
    expect(() =>
      assertPrivacySafeContractArgs(["rawTranscript should never be encoded"])
    ).toThrow(/forbidden private marker/i);
  });

  it("submits and indexes deterministic deposit transactions with CampaignDeposited receipts", () => {
    const transaction = submitEscrowDepositTransaction({
      campaignId: proof.campaignId,
      policyHash,
      depositAmountWei: 500000000000000000n,
      chainId,
      contractAddress,
      depositedAt: now
    });
    const receipt = {
      txHash: transaction.txHash,
      chainId,
      contractAddress,
      status: "confirmed" as const,
      blockNumber: 234567,
      logs: [
        {
          eventName: "CampaignDeposited",
          args: {
            campaignId: depositToContractArgs({
              campaignId: proof.campaignId,
              policyHash
            })[0],
            advertiser: recipientAddress,
            amount: "500000000000000000",
            policyHash: `0x${policyHash}`
          }
        }
      ]
    };

    const parsed = parseCampaignDepositContractEvent(receipt);
    const indexed = indexCampaignDepositContractEvent({
      receipt,
      transaction,
      expectedPolicyHash: policyHash,
      indexedAt
    });

    expect(transaction.type).toBe("escrow_deposit");
    expect(transaction.status).toBe("pending");
    expect(parsed.policyHash).toBe(policyHash);
    expect(parsed.amountWei).toBe("500000000000000000");
    expect(indexed.transaction.status).toBe("confirmed");
    expect(indexed.transaction.eventName).toBe("CampaignDeposited");
  });

  it("supports async settlement gateways for live testnet implementations", async () => {
    const settlementEvent = {
      id: "settlement_async_test",
      campaignId: proof.campaignId,
      attentionEventId: proof.attentionEventId,
      policyHash: proof.settlementPolicyHash,
      proofHash: proof.proofHash,
      scoreBps: proof.scoreBps,
      thresholdBps: proof.thresholdBps,
      status: "pending" as const,
      createdAt: now,
      updatedAt: now
    };
    const submitted = await submitSettlementTransactionAsync({
      settlementEvent,
      proof,
      chainId,
      contractAddress,
      submittedAt: now,
      recipientAddress,
      payoutAmountWei: 1000000000000000n,
      gateway: {
        async submitSettlementProof() {
          return {
            txHash: `0x${"d".repeat(64)}`,
            chainId,
            contractAddress,
            submittedAt: now
          };
        }
      }
    });

    expect(submitted.settlementEvent.status).toBe("submitted");
    expect(submitted.transaction.type).toBe("settlement_claim");
    expect(submitted.transaction.txHash).toBe(`0x${"d".repeat(64)}`);
  });

  it("selects simulated gateways without secrets and rejects incomplete testnet env", () => {
    const simulatedConfig = readSettlementRuntimeConfig({
      SETTLEMENT_MODE: "simulated"
    });

    expect(simulatedConfig.mode).toBe("simulated");
    expect(createSettlementGatewayFromRuntimeConfig(simulatedConfig)).toBeTruthy();
    expect(createEscrowDepositGatewayFromRuntimeConfig(simulatedConfig)).toBeTruthy();
    expect(() =>
      readSettlementRuntimeConfig({
        SETTLEMENT_MODE: "testnet",
        CHAIN_ID: String(chainId),
        CHAIN_RPC_URL: "https://example.invalid"
      })
    ).toThrow(/missing testnet settlement env vars/i);
  });
});
