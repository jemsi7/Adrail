import { NextResponse } from "next/server";
import {
  createAdvertiserFundingDashboard,
  readFundingRuntimePublicConfig
} from "../../../src/domain/advertiser-funding";
import { getStoredEscrowLedgerEntries } from "../../../src/domain/advertiser-funding-store";
import { buildAllPhase4DemoScenarios } from "../../../src/domain/demo-ux";
import type { EscrowLedgerEntry } from "../../../src/domain/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const theme = url.searchParams.get("theme");
  const campaignId = url.searchParams.get("campaignId");
  const scenarios = buildAllPhase4DemoScenarios();
  const scenario = scenarios.find((candidate) =>
    (theme && candidate.theme === theme) ||
    (campaignId && candidate.fixture.campaign.id === campaignId)
  ) ?? scenarios[0];
  const publicConfig = readFundingRuntimePublicConfig();
  const storedEntries = getStoredEscrowLedgerEntries(scenario.fixture.campaign.id);
  const fixtureEntries = scenario.fundingDashboard.ledgerEntries;
  const baseEntries = process.env.SETTLEMENT_MODE === "testnet"
    ? getTestnetBaselineEntries({
        fixtureEntries,
        storedEntries
      })
    : fixtureEntries;
  const fundingDashboard = createAdvertiserFundingDashboard({
    advertiserId: scenario.fixture.campaign.advertiserId,
    campaignId: scenario.fixture.campaign.id,
    chainId: publicConfig.chainId,
    escrowContractAddress: publicConfig.escrowContractAddress,
    walletAddress: publicConfig.advertiserDepositWallet ??
      scenario.fundingDashboard.walletProfile.walletAddress,
    configuredWalletAddress: publicConfig.advertiserDepositWallet,
    policyHash: scenario.fundingDashboard.account.policyHash,
    ledgerEntries: [...baseEntries, ...storedEntries],
    updatedAt: new Date().toISOString()
  });

  return NextResponse.json({
    fundingDashboard
  });
}

function getTestnetBaselineEntries(input: {
  fixtureEntries: EscrowLedgerEntry[];
  storedEntries: EscrowLedgerEntry[];
}): EscrowLedgerEntry[] {
  const hasStoredDeposit = input.storedEntries.some((entry) => entry.type === "deposit");
  const hasStoredDebit = input.storedEntries.some((entry) => entry.type === "attention_debit");

  if (hasStoredDeposit || !hasStoredDebit) {
    return [];
  }

  return input.fixtureEntries.filter((entry) => entry.type === "deposit");
}
