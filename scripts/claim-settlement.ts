import { createPublicClient, http, keccak256, toBytes } from "viem";
import {
  createSettlementGatewayFromRuntimeConfig,
  readSettlementRuntimeConfig,
  viemReceiptToSettlementContractReceipt
} from "../src/domain/settlement-contract";
import {
  indexSettlementContractEvent,
  submitSettlementTransactionAsync
} from "../src/domain/settlement";
import {
  normalizeAddress,
  normalizeBytes32Hash,
  stripHexPrefix
} from "../src/domain/settlement-encoding";
import type { SettlementEvent, SettlementProof } from "../src/domain/schemas";

try {
  process.loadEnvFile?.(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

const config = readSettlementRuntimeConfig();

if (config.mode !== "testnet") {
  throw new Error("SETTLEMENT_MODE must be testnet to submit a live settlement.");
}

if (!config.rpcUrl || !config.chainId || !config.contractAddress) {
  throw new Error("Missing live testnet escrow runtime config.");
}

const campaignId = process.env.TESTNET_DEMO_CAMPAIGN_ID ?? "campaign_travel_001";
const policyHash = readDemoPolicyHash(campaignId);
const now = new Date().toISOString();
const attentionEventId =
  process.env.TESTNET_DEMO_ATTENTION_EVENT_ID ?? `attention_event_${Date.now()}`;
const scoreBps = readOptionalInteger("TESTNET_DEMO_SCORE_BPS", 7600);
const thresholdBps = readOptionalInteger("TESTNET_DEMO_THRESHOLD_BPS", 6500);
const payoutAmountWei = readRequiredBigInt("SETTLEMENT_PAYOUT_AMOUNT_WEI");
const recipientAddress = normalizeAddress(readRequiredEnv("SETTLEMENT_PAYOUT_RECIPIENT"));
const privacySalt = readRequiredEnv("PRIVACY_SALT");
const proofHash = readDemoProofHash({
  campaignId,
  attentionEventId,
  policyHash,
  scoreBps,
  thresholdBps,
  privacySalt
});

const proof: SettlementProof = {
  campaignId,
  attentionEventId,
  settlementPolicyHash: policyHash,
  signalTypes: ["dwell", "deep_link"],
  scoreBps,
  thresholdBps,
  pseudonymousUserProof: stripHexPrefix(
    keccak256(toBytes(`${privacySalt}:${campaignId}:demo-user`))
  ),
  occurredAt: now,
  proofHash
};

const settlementEvent: SettlementEvent = {
  id: `settlement_${attentionEventId}`,
  campaignId,
  attentionEventId,
  policyHash,
  proofHash,
  scoreBps,
  thresholdBps,
  status: "pending",
  createdAt: now,
  updatedAt: now
};

const submitted = await submitSettlementTransactionAsync({
  settlementEvent,
  proof,
  chainId: config.chainId,
  contractAddress: config.contractAddress,
  submittedAt: now,
  recipientAddress,
  payoutAmountWei,
  gateway: createSettlementGatewayFromRuntimeConfig(config)
});

const publicClient = createPublicClient({
  transport: http(config.rpcUrl)
});
const receipt = await publicClient.getTransactionReceipt({
  hash: submitted.transaction.txHash as `0x${string}`
});
const contractReceipt = viemReceiptToSettlementContractReceipt({
  receipt,
  chainId: config.chainId,
  contractAddress: config.contractAddress
});
const indexed = indexSettlementContractEvent({
  receipt: contractReceipt,
  settlementEvent: submitted.settlementEvent,
  transaction: submitted.transaction,
  indexedAt: new Date().toISOString()
});

console.log(JSON.stringify({
  action: "claimSettlement",
  campaignId,
  attentionEventId,
  policyHash,
  proofHash,
  scoreBps,
  thresholdBps,
  recipientAddress,
  payoutAmountWei: payoutAmountWei.toString(),
  txHash: indexed.transaction.txHash,
  status: indexed.transaction.status,
  blockNumber: indexed.transaction.blockNumber,
  eventName: indexed.parsedEvent.eventName,
  contractAddress: config.contractAddress,
  chainId: config.chainId
}, null, 2));

function readRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
}

function readRequiredBigInt(key: string): bigint {
  return BigInt(readRequiredEnv(key));
}

function readOptionalInteger(key: string, fallback: number): number {
  const value = process.env[key];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${key} must be an integer.`);
  }

  return parsed;
}

function readDemoPolicyHash(campaignId: string): string {
  const configured = process.env.TESTNET_DEMO_POLICY_HASH;
  const hash = configured ?? keccak256(toBytes(`${campaignId}:approved-policy:v1`));

  return stripHexPrefix(normalizeBytes32Hash(hash));
}

function readDemoProofHash(input: {
  campaignId: string;
  attentionEventId: string;
  policyHash: string;
  scoreBps: number;
  thresholdBps: number;
  privacySalt: string;
}): string {
  const configured = process.env.TESTNET_DEMO_PROOF_HASH;
  const hash = configured ?? keccak256(toBytes(JSON.stringify(input)));

  return stripHexPrefix(normalizeBytes32Hash(hash));
}
