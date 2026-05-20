import { isAddress, isHex, keccak256, toBytes } from "viem";
import type { SettlementProof } from "./schemas";

export type Bytes32Hex = `0x${string}`;
export type AddressHex = `0x${string}`;

export type SettlementContractArgs = readonly [
  campaignId: Bytes32Hex,
  attentionEventId: Bytes32Hex,
  policyHash: Bytes32Hex,
  proofHash: Bytes32Hex,
  scoreBps: number,
  thresholdBps: number,
  recipient: AddressHex,
  payoutAmountWei: bigint
];

export type DepositContractArgs = readonly [
  campaignId: Bytes32Hex,
  policyHash: Bytes32Hex
];

const BYTES32_PATTERN = /^0x[a-f0-9]{64}$/;
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export function domainIdToBytes32(id: string): Bytes32Hex {
  const trimmed = id.trim();

  if (trimmed.length === 0) {
    throw new Error("Cannot encode an empty domain id as bytes32.");
  }

  return keccak256(toBytes(trimmed));
}

export function normalizeBytes32Hash(value: string): Bytes32Hex {
  const normalized = value.startsWith("0x")
    ? value.toLowerCase()
    : `0x${value.toLowerCase()}`;

  if (!isHex(normalized) || !BYTES32_PATTERN.test(normalized)) {
    throw new Error("Expected a 32-byte hex value.");
  }

  if (normalized === ZERO_BYTES32) {
    throw new Error("bytes32 value cannot be zero.");
  }

  return normalized as Bytes32Hex;
}

export function normalizeAddress(value: string): AddressHex {
  if (!isAddress(value)) {
    throw new Error("Expected a valid EVM address.");
  }

  return value as AddressHex;
}

export function settlementProofToContractArgs(input: {
  proof: SettlementProof;
  recipientAddress: string;
  payoutAmountWei: bigint;
}): SettlementContractArgs {
  if (input.payoutAmountWei <= 0n) {
    throw new Error("Settlement payout amount must be greater than zero.");
  }

  return [
    domainIdToBytes32(input.proof.campaignId),
    domainIdToBytes32(input.proof.attentionEventId),
    normalizeBytes32Hash(input.proof.settlementPolicyHash),
    normalizeBytes32Hash(input.proof.proofHash),
    input.proof.scoreBps,
    input.proof.thresholdBps,
    normalizeAddress(input.recipientAddress),
    input.payoutAmountWei
  ];
}

export function depositToContractArgs(input: {
  campaignId: string;
  policyHash: string;
}): DepositContractArgs {
  return [
    domainIdToBytes32(input.campaignId),
    normalizeBytes32Hash(input.policyHash)
  ];
}

export function assertPrivacySafeContractArgs(args: readonly unknown[]): void {
  const serialized = JSON.stringify(args, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  ).toLowerCase();
  const forbiddenMarkers = [
    "rawtranscript",
    "raw transcript",
    "profilevector",
    "profile vector",
    "uservault",
    "user_vault",
    "directuserid",
    "direct_user_id"
  ];

  for (const marker of forbiddenMarkers) {
    if (serialized.includes(marker)) {
      throw new Error(`Contract args contain forbidden private marker: ${marker}`);
    }
  }
}

export function stripHexPrefix(value: string): string {
  return value.replace(/^0x/i, "").toLowerCase();
}
