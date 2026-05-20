import {
  type AttentionEvent,
  type ContractTransaction,
  type DynamicSettlementPolicy,
  type SettlementEvent,
  type SettlementProof,
  contractTransactionSchema,
  hashStableJson,
  settlementEventSchema,
  settlementProofSchema
} from "./schemas";
import { validateDynamicSettlementPolicy } from "./attention";

type MaybePromise<T> = T | Promise<T>;

export const ATTENTION_ESCROW_ABI = [
  "event CampaignDeposited(bytes32 indexed campaignId,address indexed advertiser,uint256 amount,bytes32 policyHash)",
  "event SettlementClaimed(bytes32 indexed campaignId,bytes32 indexed attentionEventId,bytes32 proofHash,uint16 scoreBps,uint16 thresholdBps,address recipient,uint256 payoutAmount)",
  "function depositCampaign(bytes32 campaignId,bytes32 policyHash) external payable",
  "function claimSettlement(bytes32 campaignId,bytes32 attentionEventId,bytes32 policyHash,bytes32 proofHash,uint16 scoreBps,uint16 thresholdBps,address payable recipient,uint256 payoutAmount) external",
  "function refundCampaign(bytes32 campaignId,address payable recipient,uint256 amount) external"
] as const;

export type SettlementTriggerResult =
  | {
      triggered: true;
      reason: "settlement_triggered";
      proof: SettlementProof;
      settlementEvent: SettlementEvent;
    }
  | {
      triggered: false;
      reason: "attention_not_eligible" | "duplicate_settlement";
      proof?: SettlementProof;
    };

export type SettlementTransactionSubmission = {
  txHash: string;
  chainId: number;
  contractAddress: string;
  submittedAt: string;
};

export type SettlementTransactionGateway = {
  submitSettlementProof(input: {
    settlementEvent: SettlementEvent;
    proof: SettlementProof;
    chainId: number;
    contractAddress: string;
    submittedAt: string;
    recipientAddress?: string;
    payoutAmountWei?: bigint;
  }): MaybePromise<SettlementTransactionSubmission>;
};

export type EscrowDepositGateway = {
  depositCampaign(input: {
    campaignId: string;
    policyHash: string;
    depositAmountWei: bigint;
    chainId: number;
    contractAddress: string;
    depositedAt: string;
  }): MaybePromise<SettlementTransactionSubmission>;
};

export type SettlementContractLog = {
  eventName: "SettlementClaimed" | "CampaignDeposited" | string;
  args: Record<string, unknown>;
};

export type SettlementContractReceipt = {
  txHash: string;
  chainId: number;
  contractAddress: string;
  status: "confirmed" | "failed";
  blockNumber?: number;
  logs: SettlementContractLog[];
};

export type ParsedSettlementContractEvent = {
  eventName: "SettlementClaimed";
  campaignId: string;
  attentionEventId: string;
  proofHash: string;
  scoreBps: number;
  thresholdBps: number;
  recipient?: string;
  payoutAmountWei?: string;
};

export type ParsedCampaignDepositContractEvent = {
  eventName: "CampaignDeposited";
  campaignId: string;
  advertiser: string;
  amountWei: string;
  policyHash: string;
};

export const deterministicTestnetSettlementGateway: SettlementTransactionGateway = {
  submitSettlementProof(input) {
    return {
      txHash: toTxHash(hashStableJson({
        contractAddress: input.contractAddress,
        chainId: input.chainId,
        proofHash: input.proof.proofHash,
        recipientAddress: input.recipientAddress ?? null,
        payoutAmountWei: input.payoutAmountWei?.toString() ?? null,
        settlementEventId: input.settlementEvent.id,
        submittedAt: input.submittedAt
      })),
      chainId: input.chainId,
      contractAddress: input.contractAddress,
      submittedAt: input.submittedAt
    };
  }
};

export const deterministicEscrowDepositGateway: EscrowDepositGateway = {
  depositCampaign(input) {
    return {
      txHash: toTxHash(hashStableJson({
        campaignId: input.campaignId,
        policyHash: input.policyHash,
        depositAmountWei: input.depositAmountWei.toString(),
        contractAddress: input.contractAddress,
        chainId: input.chainId,
        depositedAt: input.depositedAt
      })),
      chainId: input.chainId,
      contractAddress: input.contractAddress,
      submittedAt: input.depositedAt
    };
  }
};

export function createSettlementProof(input: {
  attentionEvent: AttentionEvent;
  settlementPolicy: DynamicSettlementPolicy;
}): SettlementProof {
  const policy = validateDynamicSettlementPolicy(input.settlementPolicy);

  if (!input.attentionEvent.settlementEligible) {
    throw new Error("Cannot create settlement proof for ineligible attention event.");
  }

  if (input.attentionEvent.thresholdBps !== policy.thresholdBps) {
    throw new Error("Attention event threshold does not match settlement policy threshold.");
  }

  if (input.attentionEvent.scoreBps < policy.thresholdBps) {
    throw new Error("Attention score is below settlement policy threshold.");
  }

  const proofBase = {
    campaignId: input.attentionEvent.campaignId,
    attentionEventId: input.attentionEvent.id,
    settlementPolicyHash: policy.policyHash,
    signalTypes: input.attentionEvent.signalTypes,
    scoreBps: input.attentionEvent.scoreBps,
    thresholdBps: input.attentionEvent.thresholdBps,
    pseudonymousUserProof: input.attentionEvent.pseudonymousUserProof,
    occurredAt: input.attentionEvent.occurredAt
  };

  return settlementProofSchema.parse({
    ...proofBase,
    proofHash: hashStableJson(proofBase)
  });
}

export function createSettlementEvent(input: {
  id: string;
  proof: SettlementProof;
  status?: SettlementEvent["status"];
  transactionHash?: string;
  now: string;
}): SettlementEvent {
  return settlementEventSchema.parse({
    id: input.id,
    campaignId: input.proof.campaignId,
    attentionEventId: input.proof.attentionEventId,
    policyHash: input.proof.settlementPolicyHash,
    proofHash: input.proof.proofHash,
    scoreBps: input.proof.scoreBps,
    thresholdBps: input.proof.thresholdBps,
    status: input.status ?? "pending",
    transactionHash: input.transactionHash,
    createdAt: input.now,
    updatedAt: input.now
  });
}

export function triggerSettlement(input: {
  attentionEvent: AttentionEvent;
  settlementPolicy: DynamicSettlementPolicy;
  existingSettlementEvents?: SettlementEvent[];
  settlementEventId: string;
  now: string;
}): SettlementTriggerResult {
  if (!input.attentionEvent.settlementEligible) {
    return {
      triggered: false,
      reason: "attention_not_eligible"
    };
  }

  const proof = createSettlementProof({
    attentionEvent: input.attentionEvent,
    settlementPolicy: input.settlementPolicy
  });
  const duplicate = (input.existingSettlementEvents ?? []).some((event) =>
    event.proofHash === proof.proofHash ||
    (event.attentionEventId === input.attentionEvent.id && event.status !== "rejected")
  );

  if (duplicate) {
    return {
      triggered: false,
      reason: "duplicate_settlement",
      proof
    };
  }

  return {
    triggered: true,
    reason: "settlement_triggered",
    proof,
    settlementEvent: createSettlementEvent({
      id: input.settlementEventId,
      proof,
      now: input.now
    })
  };
}

export function submitSettlementTransaction(input: {
  settlementEvent: SettlementEvent;
  proof: SettlementProof;
  chainId: number;
  contractAddress: string;
  submittedAt: string;
  recipientAddress?: string;
  payoutAmountWei?: bigint;
  gateway?: SettlementTransactionGateway;
}): {
  settlementEvent: SettlementEvent;
  transaction: ContractTransaction;
} {
  if (input.settlementEvent.proofHash !== input.proof.proofHash) {
    throw new Error("Settlement event proof hash does not match settlement proof.");
  }

  const gateway = input.gateway ?? deterministicTestnetSettlementGateway;
  const submission = gateway.submitSettlementProof({
    settlementEvent: input.settlementEvent,
    proof: input.proof,
    chainId: input.chainId,
    contractAddress: input.contractAddress,
    submittedAt: input.submittedAt,
    recipientAddress: input.recipientAddress,
    payoutAmountWei: input.payoutAmountWei
  });

  if (isPromiseLike(submission)) {
    throw new Error("Use submitSettlementTransactionAsync with asynchronous settlement gateways.");
  }

  return buildSubmittedSettlementTransaction({
    settlementEvent: input.settlementEvent,
    proof: input.proof,
    submission
  });
}

export async function submitSettlementTransactionAsync(input: {
  settlementEvent: SettlementEvent;
  proof: SettlementProof;
  chainId: number;
  contractAddress: string;
  submittedAt: string;
  recipientAddress?: string;
  payoutAmountWei?: bigint;
  gateway?: SettlementTransactionGateway;
}): Promise<{
  settlementEvent: SettlementEvent;
  transaction: ContractTransaction;
}> {
  if (input.settlementEvent.proofHash !== input.proof.proofHash) {
    throw new Error("Settlement event proof hash does not match settlement proof.");
  }

  const gateway = input.gateway ?? deterministicTestnetSettlementGateway;
  const submission = await gateway.submitSettlementProof({
    settlementEvent: input.settlementEvent,
    proof: input.proof,
    chainId: input.chainId,
    contractAddress: input.contractAddress,
    submittedAt: input.submittedAt,
    recipientAddress: input.recipientAddress,
    payoutAmountWei: input.payoutAmountWei
  });

  return buildSubmittedSettlementTransaction({
    settlementEvent: input.settlementEvent,
    proof: input.proof,
    submission
  });
}

export function submitEscrowDepositTransaction(input: {
  campaignId: string;
  policyHash: string;
  depositAmountWei: bigint;
  chainId: number;
  contractAddress: string;
  depositedAt: string;
  gateway?: EscrowDepositGateway;
}): ContractTransaction {
  const gateway = input.gateway ?? deterministicEscrowDepositGateway;
  const submission = gateway.depositCampaign({
    campaignId: input.campaignId,
    policyHash: input.policyHash,
    depositAmountWei: input.depositAmountWei,
    chainId: input.chainId,
    contractAddress: input.contractAddress,
    depositedAt: input.depositedAt
  });

  if (isPromiseLike(submission)) {
    throw new Error("Use submitEscrowDepositTransactionAsync with asynchronous deposit gateways.");
  }

  return buildSubmittedDepositTransaction({
    campaignId: input.campaignId,
    policyHash: input.policyHash,
    depositAmountWei: input.depositAmountWei,
    submission
  });
}

export async function submitEscrowDepositTransactionAsync(input: {
  campaignId: string;
  policyHash: string;
  depositAmountWei: bigint;
  chainId: number;
  contractAddress: string;
  depositedAt: string;
  gateway?: EscrowDepositGateway;
}): Promise<ContractTransaction> {
  const gateway = input.gateway ?? deterministicEscrowDepositGateway;
  const submission = await gateway.depositCampaign({
    campaignId: input.campaignId,
    policyHash: input.policyHash,
    depositAmountWei: input.depositAmountWei,
    chainId: input.chainId,
    contractAddress: input.contractAddress,
    depositedAt: input.depositedAt
  });

  return buildSubmittedDepositTransaction({
    campaignId: input.campaignId,
    policyHash: input.policyHash,
    depositAmountWei: input.depositAmountWei,
    submission
  });
}

function buildSubmittedSettlementTransaction(input: {
  settlementEvent: SettlementEvent;
  proof: SettlementProof;
  submission: SettlementTransactionSubmission;
}): {
  settlementEvent: SettlementEvent;
  transaction: ContractTransaction;
} {
  const submittedEvent = settlementEventSchema.parse({
    ...input.settlementEvent,
    status: "submitted",
    transactionHash: input.submission.txHash,
    updatedAt: input.submission.submittedAt
  });
  const transaction = contractTransactionSchema.parse({
    id: `contract_tx_${hashStableJson({
      txHash: input.submission.txHash,
      settlementEventId: submittedEvent.id
    }).slice(0, 16)}`,
    chainId: input.submission.chainId,
    contractAddress: input.submission.contractAddress,
    type: "settlement_claim",
    txHash: input.submission.txHash,
    status: "pending",
    relatedCampaignId: input.proof.campaignId,
    relatedSettlementEventId: submittedEvent.id,
    createdAt: input.submission.submittedAt,
    updatedAt: input.submission.submittedAt
  });

  return {
    settlementEvent: submittedEvent,
    transaction
  };
}

function buildSubmittedDepositTransaction(input: {
  campaignId: string;
  policyHash: string;
  depositAmountWei: bigint;
  submission: SettlementTransactionSubmission;
}): ContractTransaction {
  return contractTransactionSchema.parse({
    id: `contract_tx_${hashStableJson({
      txHash: input.submission.txHash,
      campaignId: input.campaignId,
      policyHash: input.policyHash,
      depositAmountWei: input.depositAmountWei.toString()
    }).slice(0, 16)}`,
    chainId: input.submission.chainId,
    contractAddress: input.submission.contractAddress,
    type: "escrow_deposit",
    txHash: input.submission.txHash,
    status: "pending",
    relatedCampaignId: input.campaignId,
    createdAt: input.submission.submittedAt,
    updatedAt: input.submission.submittedAt
  });
}

export function parseSettlementContractEvent(
  receipt: SettlementContractReceipt
): ParsedSettlementContractEvent {
  if (receipt.status !== "confirmed") {
    throw new Error("Cannot parse settlement event from a failed transaction receipt.");
  }

  const log = receipt.logs.find((candidate) => candidate.eventName === "SettlementClaimed");

  if (!log) {
    throw new Error("SettlementClaimed event not found in transaction receipt.");
  }

  return {
    eventName: "SettlementClaimed",
    campaignId: readRequiredString(log.args.campaignId, "campaignId"),
    attentionEventId: readRequiredString(log.args.attentionEventId, "attentionEventId"),
    proofHash: normalizeHash(readRequiredString(log.args.proofHash, "proofHash")),
    scoreBps: readRequiredNumber(log.args.scoreBps, "scoreBps"),
    thresholdBps: readRequiredNumber(log.args.thresholdBps, "thresholdBps"),
    recipient: readOptionalString(log.args.recipient),
    payoutAmountWei: readOptionalNumberishAsString(log.args.payoutAmount)
  };
}

export function parseCampaignDepositContractEvent(
  receipt: SettlementContractReceipt
): ParsedCampaignDepositContractEvent {
  if (receipt.status !== "confirmed") {
    throw new Error("Cannot parse deposit event from a failed transaction receipt.");
  }

  const log = receipt.logs.find((candidate) => candidate.eventName === "CampaignDeposited");

  if (!log) {
    throw new Error("CampaignDeposited event not found in transaction receipt.");
  }

  return {
    eventName: "CampaignDeposited",
    campaignId: readRequiredString(log.args.campaignId, "campaignId"),
    advertiser: readRequiredString(log.args.advertiser, "advertiser"),
    amountWei: readRequiredNumberishAsString(log.args.amount, "amount"),
    policyHash: normalizeHash(readRequiredString(log.args.policyHash, "policyHash"))
  };
}

export function indexSettlementContractEvent(input: {
  receipt: SettlementContractReceipt;
  settlementEvent: SettlementEvent;
  transaction: ContractTransaction;
  indexedAt: string;
}): {
  settlementEvent: SettlementEvent;
  transaction: ContractTransaction;
  parsedEvent: ParsedSettlementContractEvent;
} {
  const parsedEvent = parseSettlementContractEvent(input.receipt);

  if (parsedEvent.proofHash !== normalizeHash(input.settlementEvent.proofHash)) {
    throw new Error("Contract event proof hash does not match settlement event proof hash.");
  }

  if (parsedEvent.scoreBps !== input.settlementEvent.scoreBps) {
    throw new Error("Contract event score does not match settlement event score.");
  }

  const settlementEvent = settlementEventSchema.parse({
    ...input.settlementEvent,
    status: "settled",
    updatedAt: input.indexedAt
  });
  const transaction = contractTransactionSchema.parse({
    ...input.transaction,
    status: "confirmed",
    blockNumber: input.receipt.blockNumber,
    eventName: parsedEvent.eventName,
    updatedAt: input.indexedAt
  });

  return {
    settlementEvent,
    transaction,
    parsedEvent
  };
}

export function indexCampaignDepositContractEvent(input: {
  receipt: SettlementContractReceipt;
  transaction: ContractTransaction;
  indexedAt: string;
  expectedPolicyHash?: string;
}): {
  transaction: ContractTransaction;
  parsedEvent: ParsedCampaignDepositContractEvent;
} {
  const parsedEvent = parseCampaignDepositContractEvent(input.receipt);

  if (
    input.expectedPolicyHash &&
    parsedEvent.policyHash !== normalizeHash(input.expectedPolicyHash)
  ) {
    throw new Error("Contract deposit policy hash does not match expected policy hash.");
  }

  const transaction = contractTransactionSchema.parse({
    ...input.transaction,
    status: "confirmed",
    blockNumber: input.receipt.blockNumber,
    eventName: parsedEvent.eventName,
    updatedAt: input.indexedAt
  });

  return {
    transaction,
    parsedEvent
  };
}

function readRequiredString(value: unknown, key: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing contract event argument: ${key}`);
  }

  return value;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readRequiredNumber(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Missing contract event argument: ${key}`);
  }

  return value;
}

function readRequiredNumberishAsString(value: unknown, key: string): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new Error(`Missing contract event argument: ${key}`);
}

function readOptionalNumberishAsString(value: unknown): string | undefined {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return undefined;
}

function normalizeHash(value: string): string {
  return value.replace(/^0x/i, "").toLowerCase();
}

function toTxHash(hash: string): string {
  return `0x${hash.slice(0, 64)}`;
}

function isPromiseLike<T>(value: MaybePromise<T>): value is Promise<T> {
  return Boolean(value && typeof (value as Promise<T>).then === "function");
}
