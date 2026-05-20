import { createPublicClient, http, keccak256, toBytes } from "viem";
import {
  createEscrowDepositGatewayFromRuntimeConfig,
  readSettlementRuntimeConfig,
  viemReceiptToSettlementContractReceipt
} from "../src/domain/settlement-contract";
import {
  indexCampaignDepositContractEvent,
  submitEscrowDepositTransactionAsync
} from "../src/domain/settlement";
import {
  normalizeBytes32Hash,
  stripHexPrefix
} from "../src/domain/settlement-encoding";

try {
  process.loadEnvFile?.(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

const config = readSettlementRuntimeConfig();

if (config.mode !== "testnet") {
  throw new Error("SETTLEMENT_MODE must be testnet to submit a live deposit.");
}

if (!config.rpcUrl || !config.chainId || !config.contractAddress) {
  throw new Error("Missing live testnet escrow runtime config.");
}

const campaignId = process.env.TESTNET_DEMO_CAMPAIGN_ID ?? "campaign_travel_001";
const policyHash = readDemoPolicyHash(campaignId);
const depositAmountWei = readRequiredBigInt("CAMPAIGN_DEPOSIT_AMOUNT_WEI");
const depositedAt = new Date().toISOString();

const transaction = await submitEscrowDepositTransactionAsync({
  campaignId,
  policyHash,
  depositAmountWei,
  chainId: config.chainId,
  contractAddress: config.contractAddress,
  depositedAt,
  gateway: createEscrowDepositGatewayFromRuntimeConfig(config)
});

const publicClient = createPublicClient({
  transport: http(config.rpcUrl)
});
const receipt = await publicClient.getTransactionReceipt({
  hash: transaction.txHash as `0x${string}`
});
const contractReceipt = viemReceiptToSettlementContractReceipt({
  receipt,
  chainId: config.chainId,
  contractAddress: config.contractAddress
});
const indexed = indexCampaignDepositContractEvent({
  receipt: contractReceipt,
  transaction,
  expectedPolicyHash: policyHash,
  indexedAt: new Date().toISOString()
});

console.log(JSON.stringify({
  action: "depositCampaign",
  campaignId,
  policyHash,
  depositAmountWei: depositAmountWei.toString(),
  txHash: indexed.transaction.txHash,
  status: indexed.transaction.status,
  blockNumber: indexed.transaction.blockNumber,
  eventName: indexed.parsedEvent.eventName,
  advertiser: indexed.parsedEvent.advertiser,
  contractAddress: config.contractAddress,
  chainId: config.chainId
}, null, 2));

function readRequiredBigInt(key: string): bigint {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return BigInt(value);
}

function readDemoPolicyHash(campaignId: string): string {
  const configured = process.env.TESTNET_DEMO_POLICY_HASH;
  const hash = configured ?? keccak256(toBytes(`${campaignId}:approved-policy:v1`));

  return stripHexPrefix(normalizeBytes32Hash(hash));
}
