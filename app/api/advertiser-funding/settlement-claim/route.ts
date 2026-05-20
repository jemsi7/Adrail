import { createPublicClient, http } from "viem";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAttentionDebitLedgerEntry,
  readFundingRuntimePublicConfig
} from "../../../../src/domain/advertiser-funding";
import { recordEscrowLedgerEntry } from "../../../../src/domain/advertiser-funding-store";
import { buildPhase4DemoScenario } from "../../../../src/domain/demo-ux";
import { demoPresetDraftSchema, sanitizeDemoPresetDrafts } from "../../../../src/domain/demo-presets";
import {
  createSettlementGatewayFromRuntimeConfig,
  readSettlementRuntimeConfig,
  viemReceiptToSettlementContractReceipt
} from "../../../../src/domain/settlement-contract";
import {
  normalizeAddress,
  normalizeBytes32Hash,
  stripHexPrefix
} from "../../../../src/domain/settlement-encoding";
import {
  indexSettlementContractEvent,
  submitSettlementTransactionAsync
} from "../../../../src/domain/settlement";
import {
  hashStableJson,
  signalTypeSchema,
  settlementEventSchema,
  settlementProofSchema
} from "../../../../src/domain/schemas";

const attentionMeasurementSchema = z.object({
  source: z.literal("browser_session"),
  campaignId: z.string().min(1),
  interstitialId: z.string().min(1),
  measuredAt: z.string().datetime({ offset: true }),
  scoreBps: z.number().int().min(0).max(10000),
  thresholdBps: z.number().int().min(5000).max(9000),
  signalTypes: z.array(signalTypeSchema).min(1)
}).strict();

const requestSchema = z.object({
  advertiserId: z.string().min(1),
  campaignId: z.string().min(1),
  theme: z.string().min(1),
  walletAddress: z.string().min(1).optional(),
  policyHash: z.string().min(16),
  attentionMeasurement: attentionMeasurementSchema.optional(),
  customPresets: z.array(demoPresetDraftSchema).optional()
}).strict();

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid advertiser settlement claim payload.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const runtimeConfig = readSettlementRuntimeConfig();

    if (runtimeConfig.mode !== "testnet") {
      return NextResponse.json(
        { error: "Live settlement claim requires SETTLEMENT_MODE=testnet." },
        { status: 409 }
      );
    }

    if (!runtimeConfig.chainId || !runtimeConfig.rpcUrl || !runtimeConfig.contractAddress) {
      throw new Error("Missing live testnet escrow runtime config.");
    }

    const publicConfig = readFundingRuntimePublicConfig();
    const customPresets = sanitizeDemoPresetDrafts(parsed.data.customPresets ?? []);
    const scenario = buildPhase4DemoScenario({
      theme: parsed.data.theme,
      customPresets
    });

    if (scenario.fixture.campaign.id !== parsed.data.campaignId) {
      throw new Error("Settlement claim campaign does not match the selected scenario.");
    }

    const measurement = parsed.data.attentionMeasurement;
    const attentionEvent = scenario.settlementDashboard.attentionEvent;
    const policy = scenario.fixture.settlementPolicy;

    if (measurement && measurement.campaignId !== parsed.data.campaignId) {
      throw new Error("Attention measurement campaign does not match the selected campaign.");
    }

    if (measurement && measurement.interstitialId !== scenario.adExperience.interstitial.id) {
      throw new Error("Attention measurement interstitial does not match the selected sponsored frame.");
    }

    if (measurement && policy && measurement.thresholdBps !== policy.thresholdBps) {
      throw new Error("Attention measurement threshold does not match the campaign settlement policy.");
    }

    const scoreBps = measurement?.scoreBps ?? attentionEvent.scoreBps;
    const thresholdBps = measurement?.thresholdBps ?? attentionEvent.thresholdBps;
    const signalTypes = measurement?.signalTypes ?? attentionEvent.signalTypes;

    if (scoreBps < thresholdBps) {
      return NextResponse.json(
        { error: "Attention score is below the campaign settlement threshold." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const attentionEventId = measurement
      ? `attention_${scenario.theme}_${hashStableJson({
          campaignId: measurement.campaignId,
          interstitialId: measurement.interstitialId,
          measuredAt: measurement.measuredAt,
          scoreBps: measurement.scoreBps,
          thresholdBps: measurement.thresholdBps
        }).slice(0, 16)}`
      : `attention_${scenario.theme}_live_${Date.now()}`;
    const policyHash = stripHexPrefix(normalizeBytes32Hash(parsed.data.policyHash));
    const payoutAmountWei = BigInt(publicConfig.settlementPayoutAmountWei);
    const recipientAddress = normalizeAddress(readRequiredEnv("SETTLEMENT_PAYOUT_RECIPIENT"));
    const proofBase = {
      campaignId: parsed.data.campaignId,
      attentionEventId,
      settlementPolicyHash: policyHash,
      signalTypes,
      scoreBps,
      thresholdBps,
      pseudonymousUserProof: attentionEvent.pseudonymousUserProof,
      occurredAt: measurement?.measuredAt ?? now
    };
    const proof = settlementProofSchema.parse({
      ...proofBase,
      proofHash: hashStableJson(proofBase)
    });
    const settlementEvent = settlementEventSchema.parse({
      id: `settlement_${attentionEventId}`,
      campaignId: parsed.data.campaignId,
      attentionEventId,
      policyHash,
      proofHash: proof.proofHash,
      scoreBps: proof.scoreBps,
      thresholdBps: proof.thresholdBps,
      status: "pending",
      createdAt: now,
      updatedAt: now
    });
    const submitted = await submitSettlementTransactionAsync({
      settlementEvent,
      proof,
      chainId: runtimeConfig.chainId,
      contractAddress: runtimeConfig.contractAddress,
      submittedAt: now,
      recipientAddress,
      payoutAmountWei,
      gateway: createSettlementGatewayFromRuntimeConfig(runtimeConfig)
    });
    const publicClient = createPublicClient({
      transport: http(runtimeConfig.rpcUrl)
    });
    const receipt = await publicClient.getTransactionReceipt({
      hash: submitted.transaction.txHash as `0x${string}`
    });
    const contractReceipt = viemReceiptToSettlementContractReceipt({
      receipt,
      chainId: runtimeConfig.chainId,
      contractAddress: runtimeConfig.contractAddress
    });
    const indexed = indexSettlementContractEvent({
      receipt: contractReceipt,
      settlementEvent: submitted.settlementEvent,
      transaction: submitted.transaction,
      indexedAt: new Date().toISOString()
    });
    const ledgerEntry = createAttentionDebitLedgerEntry({
      settlementEvent: indexed.settlementEvent,
      transaction: indexed.transaction,
      parsedEvent: indexed.parsedEvent,
      amountWei: indexed.parsedEvent.payoutAmountWei ?? payoutAmountWei,
      createdAt: now,
      updatedAt: new Date().toISOString()
    });
    recordEscrowLedgerEntry(ledgerEntry);

    return NextResponse.json({
      ledgerEntry,
      settlementEvent: indexed.settlementEvent,
      settlementProof: proof,
      transaction: indexed.transaction,
      parsedEvent: indexed.parsedEvent
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Settlement claim failed."
    }, { status: 400 });
  }
}

function readRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value || value === "replace_me") {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
}
