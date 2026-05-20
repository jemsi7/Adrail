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

export const ATTENTION_ESCROW_ABI = [
  "event CampaignDeposited(bytes32 indexed campaignId,address indexed advertiser,uint256 amount,bytes32 policyHash)",
  "event SettlementClaimed(bytes32 indexed campaignId,bytes32 indexed attentionEventId,bytes32 proofHash,uint16 scoreBps,uint16 thresholdBps,address recipient,uint256 payoutAmount)",
  "function depositCampaign(bytes32 campaignId,bytes32 policyHash) external payable",
  "function claimSettlement(bytes32 campaignId,bytes32 attentionEventId,bytes32 policyHash,bytes32 proofHash,uint16 scoreBps,uint16 thresholdBps,address payable recipient,uint256 payoutAmount) external"
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
  }): SettlementTransactionSubmission;
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
};

export const deterministicTestnetSettlementGateway: SettlementTransactionGateway = {
  submitSettlementProof(input) {
    return {
      txHash: toTxHash(hashStableJson({
        contractAddress: input.contractAddress,
        chainId: input.chainId,
        proofHash: input.proof.proofHash,
        settlementEventId: input.settlementEvent.id,
        submittedAt: input.submittedAt
      })),
      chainId: input.chainId,
      contractAddress: input.contractAddress,
      submittedAt: input.submittedAt
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
    submittedAt: input.submittedAt
  });
  const submittedEvent = settlementEventSchema.parse({
    ...input.settlementEvent,
    status: "submitted",
    transactionHash: submission.txHash,
    updatedAt: submission.submittedAt
  });
  const transaction = contractTransactionSchema.parse({
    id: `contract_tx_${hashStableJson({
      txHash: submission.txHash,
      settlementEventId: submittedEvent.id
    }).slice(0, 16)}`,
    chainId: submission.chainId,
    contractAddress: submission.contractAddress,
    type: "settlement_claim",
    txHash: submission.txHash,
    status: "pending",
    relatedCampaignId: input.proof.campaignId,
    relatedSettlementEventId: submittedEvent.id,
    createdAt: submission.submittedAt,
    updatedAt: submission.submittedAt
  });

  return {
    settlementEvent: submittedEvent,
    transaction
  };
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
    thresholdBps: readRequiredNumber(log.args.thresholdBps, "thresholdBps")
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

function readRequiredString(value: unknown, key: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing contract event argument: ${key}`);
  }

  return value;
}

function readRequiredNumber(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Missing contract event argument: ${key}`);
  }

  return value;
}

function normalizeHash(value: string): string {
  return value.replace(/^0x/i, "").toLowerCase();
}

function toTxHash(hash: string): string {
  return `0x${hash.slice(0, 64)}`;
}
