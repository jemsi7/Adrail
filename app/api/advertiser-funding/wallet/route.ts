import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdvertiserWalletProfile,
  readFundingRuntimePublicConfig
} from "../../../../src/domain/advertiser-funding";

const requestSchema = z.object({
  advertiserId: z.string().min(1),
  walletAddress: z.string().min(1),
  chainId: z.number().int().positive().optional()
}).strict();

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid advertiser wallet payload.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const config = readFundingRuntimePublicConfig();
    const walletProfile = createAdvertiserWalletProfile({
      advertiserId: parsed.data.advertiserId,
      walletAddress: parsed.data.walletAddress,
      configuredWalletAddress: config.advertiserDepositWallet,
      chainId: parsed.data.chainId ?? config.chainId,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ walletProfile });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Wallet validation failed."
    }, { status: 400 });
  }
}
