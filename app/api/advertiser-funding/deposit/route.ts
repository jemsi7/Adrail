import { createPublicClient, http } from "viem";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertWalletCanFund,
  createAdvertiserFundingDashboard,
  createAdvertiserWalletProfile,
  createDepositLedgerEntry,
  parseEthAmountToWei,
  readFundingRuntimePublicConfig
} from "../../../../src/domain/advertiser-funding";
import {
  createEscrowDepositGatewayFromRuntimeConfig,
  readSettlementRuntimeConfig,
  viemReceiptToSettlementContractReceipt
} from "../../../../src/domain/settlement-contract";
import { recordEscrowLedgerEntry } from "../../../../src/domain/advertiser-funding-store";
import {
  indexCampaignDepositContractEvent,
  submitEscrowDepositTransactionAsync
} from "../../../../src/domain/settlement";

const requestSchema = z.object({
  advertiserId: z.string().min(1),
  campaignId: z.string().min(1),
  walletAddress: z.string().min(1),
  amountEth: z.string().min(1),
  policyHash: z.string().min(16)
}).strict();

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid advertiser funding deposit payload.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const runtimeConfig = readSettlementRuntimeConfig();

    if (runtimeConfig.mode !== "testnet") {
      return NextResponse.json(
        { error: "Live advertiser deposit requires SETTLEMENT_MODE=testnet." },
        { status: 409 }
      );
    }

    if (!runtimeConfig.chainId || !runtimeConfig.rpcUrl || !runtimeConfig.contractAddress) {
      throw new Error("Missing live testnet escrow runtime config.");
    }

    const publicConfig = readFundingRuntimePublicConfig();
    const now = new Date().toISOString();
    const walletProfile = createAdvertiserWalletProfile({
      advertiserId: parsed.data.advertiserId,
      walletAddress: parsed.data.walletAddress,
      configuredWalletAddress: publicConfig.advertiserDepositWallet,
      chainId: runtimeConfig.chainId,
      updatedAt: now
    });
    assertWalletCanFund(walletProfile);

    const depositAmountWei = parseEthAmountToWei(parsed.data.amountEth);
    const transaction = await submitEscrowDepositTransactionAsync({
      campaignId: parsed.data.campaignId,
      policyHash: parsed.data.policyHash,
      depositAmountWei,
      chainId: runtimeConfig.chainId,
      contractAddress: runtimeConfig.contractAddress,
      depositedAt: now,
      gateway: createEscrowDepositGatewayFromRuntimeConfig(runtimeConfig)
    });
    const publicClient = createPublicClient({
      transport: http(runtimeConfig.rpcUrl)
    });
    const receipt = await publicClient.getTransactionReceipt({
      hash: transaction.txHash as `0x${string}`
    });
    const contractReceipt = viemReceiptToSettlementContractReceipt({
      receipt,
      chainId: runtimeConfig.chainId,
      contractAddress: runtimeConfig.contractAddress
    });
    const indexed = indexCampaignDepositContractEvent({
      receipt: contractReceipt,
      transaction,
      expectedPolicyHash: parsed.data.policyHash,
      indexedAt: new Date().toISOString()
    });
    const ledgerEntry = createDepositLedgerEntry({
      campaignId: parsed.data.campaignId,
      transaction: indexed.transaction,
      parsedEvent: indexed.parsedEvent,
      createdAt: now,
      updatedAt: new Date().toISOString()
    });
    recordEscrowLedgerEntry(ledgerEntry);
    const fundingDashboard = createAdvertiserFundingDashboard({
      advertiserId: parsed.data.advertiserId,
      campaignId: parsed.data.campaignId,
      chainId: runtimeConfig.chainId,
      escrowContractAddress: runtimeConfig.contractAddress,
      walletAddress: walletProfile.walletAddress,
      configuredWalletAddress: publicConfig.advertiserDepositWallet,
      policyHash: parsed.data.policyHash,
      ledgerEntries: [ledgerEntry],
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      fundingDashboard,
      ledgerEntry,
      transaction: indexed.transaction,
      parsedEvent: indexed.parsedEvent
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Advertiser deposit failed."
    }, { status: 400 });
  }
}
