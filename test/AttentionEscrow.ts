import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress, parseEther } from "viem";

const campaignId =
  "0x1000000000000000000000000000000000000000000000000000000000000001";
const attentionEventId =
  "0x2000000000000000000000000000000000000000000000000000000000000002";
const anotherAttentionEventId =
  "0x2000000000000000000000000000000000000000000000000000000000000003";
const policyHash =
  "0x3000000000000000000000000000000000000000000000000000000000000003";
const otherPolicyHash =
  "0x3000000000000000000000000000000000000000000000000000000000000004";
const proofHash =
  "0x4000000000000000000000000000000000000000000000000000000000000004";
const otherProofHash =
  "0x4000000000000000000000000000000000000000000000000000000000000005";
const zeroBytes32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

describe("AttentionEscrow", async function () {
  const { viem } = await network.create();
  const [owner, advertiser, otherAdvertiser, recipient] =
    await viem.getWalletClients();
  const advertiserAddress = getAddress(advertiser.account.address);
  const recipientAddress = getAddress(recipient.account.address);

  async function deployEscrow() {
    return viem.deployContract("AttentionEscrow");
  }

  async function depositFixture() {
    const escrow = await deployEscrow();
    await escrow.write.depositCampaign([campaignId, policyHash], {
      account: advertiser.account,
      value: parseEther("1"),
    });

    return escrow;
  }

  it("emits CampaignDeposited and allows same advertiser top-ups with the same policy hash", async function () {
    const escrow = await deployEscrow();

    await viem.assertions.emitWithArgs(
      escrow.write.depositCampaign([campaignId, policyHash], {
        account: advertiser.account,
        value: parseEther("1"),
      }),
      escrow,
      "CampaignDeposited",
      [campaignId, advertiserAddress, parseEther("1"), policyHash],
    );

    await escrow.write.depositCampaign([campaignId, policyHash], {
      account: advertiser.account,
      value: parseEther("0.5"),
    });

    const campaign = await escrow.read.campaignEscrows([campaignId]);
    assert.equal(campaign[0], advertiserAddress);
    assert.equal(campaign[1], parseEther("1.5"));
    assert.equal(campaign[2], policyHash);
    assert.equal(campaign[3], true);
  });

  it("rejects zero deposit and empty campaign or policy hashes", async function () {
    const escrow = await deployEscrow();

    await viem.assertions.revertWithCustomError(
      escrow.write.depositCampaign([campaignId, policyHash], {
        account: advertiser.account,
        value: 0n,
      }),
      escrow,
      "EmptyDeposit",
    );

    await viem.assertions.revertWithCustomError(
      escrow.write.depositCampaign([zeroBytes32, policyHash], {
        account: advertiser.account,
        value: parseEther("1"),
      }),
      escrow,
      "EmptyBytes32",
    );
  });

  it("prevents campaign advertiser and policy hash overwrites", async function () {
    const escrow = await depositFixture();

    await viem.assertions.revertWithCustomError(
      escrow.write.depositCampaign([campaignId, policyHash], {
        account: otherAdvertiser.account,
        value: parseEther("0.5"),
      }),
      escrow,
      "CampaignAdvertiserMismatch",
    );

    await viem.assertions.revertWithCustomError(
      escrow.write.depositCampaign([campaignId, otherPolicyHash], {
        account: advertiser.account,
        value: parseEther("0.5"),
      }),
      escrow,
      "PolicyHashMismatch",
    );
  });

  it("allows only the owner to claim settlement", async function () {
    const escrow = await depositFixture();

    await viem.assertions.revertWithCustomError(
      escrow.write.claimSettlement(
        [
          campaignId,
          attentionEventId,
          policyHash,
          proofHash,
          7500,
          6500,
          recipient.account.address,
          parseEther("0.1"),
        ],
        { account: advertiser.account },
      ),
      escrow,
      "OnlyOwner",
    );
  });

  it("rejects inactive campaigns, policy mismatch, low score, invalid payout args, and insufficient escrow", async function () {
    const escrow = await deployEscrow();

    await viem.assertions.revertWithCustomError(
      escrow.write.claimSettlement([
        campaignId,
        attentionEventId,
        policyHash,
        proofHash,
        7500,
        6500,
        recipientAddress,
        parseEther("0.1"),
      ]),
      escrow,
      "CampaignNotActive",
    );

    await escrow.write.depositCampaign([campaignId, policyHash], {
      account: advertiser.account,
      value: parseEther("0.2"),
    });

    await viem.assertions.revertWithCustomError(
      escrow.write.claimSettlement([
        campaignId,
        attentionEventId,
        otherPolicyHash,
        proofHash,
        7500,
        6500,
        recipientAddress,
        parseEther("0.1"),
      ]),
      escrow,
      "PolicyHashMismatch",
    );

    await viem.assertions.revertWithCustomError(
      escrow.write.claimSettlement([
        campaignId,
        attentionEventId,
        policyHash,
        proofHash,
        5000,
        6500,
        recipient.account.address,
        parseEther("0.1"),
      ]),
      escrow,
      "ScoreBelowThreshold",
    );

    await viem.assertions.revertWithCustomError(
      escrow.write.claimSettlement([
        campaignId,
        attentionEventId,
        policyHash,
        proofHash,
        7500,
        6500,
        "0x0000000000000000000000000000000000000000",
        parseEther("0.1"),
      ]),
      escrow,
      "InvalidRecipient",
    );

    await viem.assertions.revertWithCustomError(
      escrow.write.claimSettlement([
        campaignId,
        attentionEventId,
        policyHash,
        proofHash,
        7500,
        6500,
        recipient.account.address,
        0n,
      ]),
      escrow,
      "EmptyPayout",
    );

    await viem.assertions.revertWithCustomError(
      escrow.write.claimSettlement([
        campaignId,
        attentionEventId,
        policyHash,
        proofHash,
        7500,
        6500,
        recipient.account.address,
        parseEther("1"),
      ]),
      escrow,
      "InsufficientEscrow",
    );
  });

  it("rejects out-of-range bps values", async function () {
    const escrow = await depositFixture();

    await viem.assertions.revertWithCustomError(
      escrow.write.claimSettlement([
        campaignId,
        attentionEventId,
        policyHash,
        proofHash,
        10001,
        6500,
        recipient.account.address,
        parseEther("0.1"),
      ]),
      escrow,
      "BpsOutOfRange",
    );

    await viem.assertions.revertWithCustomError(
      escrow.write.claimSettlement([
        campaignId,
        attentionEventId,
        policyHash,
        proofHash,
        7500,
        4999,
        recipient.account.address,
        parseEther("0.1"),
      ]),
      escrow,
      "BpsOutOfRange",
    );
  });

  it("claims settlement, decreases escrow balance, and rejects duplicate proof or attention event", async function () {
    const escrow = await depositFixture();

    await viem.assertions.emitWithArgs(
      escrow.write.claimSettlement([
        campaignId,
        attentionEventId,
        policyHash,
        proofHash,
        7500,
        6500,
        recipient.account.address,
        parseEther("0.1"),
      ]),
      escrow,
      "SettlementClaimed",
      [
        campaignId,
        attentionEventId,
        proofHash,
        7500,
        6500,
        recipientAddress,
        parseEther("0.1"),
      ],
    );

    assert.equal(await escrow.read.settledProofs([proofHash]), true);
    assert.equal(
      await escrow.read.settledAttentionEvents([campaignId, attentionEventId]),
      true,
    );

    const campaign = await escrow.read.campaignEscrows([campaignId]);
    assert.equal(campaign[1], parseEther("0.9"));

    await viem.assertions.revertWithCustomError(
      escrow.write.claimSettlement([
        campaignId,
        anotherAttentionEventId,
        policyHash,
        proofHash,
        7500,
        6500,
        recipient.account.address,
        parseEther("0.1"),
      ]),
      escrow,
      "DuplicateProof",
    );

    await viem.assertions.revertWithCustomError(
      escrow.write.claimSettlement([
        campaignId,
        attentionEventId,
        policyHash,
        otherProofHash,
        7500,
        6500,
        recipient.account.address,
        parseEther("0.1"),
      ]),
      escrow,
      "DuplicateAttentionEvent",
    );
  });

  it("refunds campaign balance through the owner-mediated path", async function () {
    const escrow = await depositFixture();

    await viem.assertions.emitWithArgs(
      escrow.write.refundCampaign([
        campaignId,
        advertiser.account.address,
        parseEther("0.25"),
      ]),
      escrow,
      "CampaignRefunded",
      [campaignId, advertiserAddress, parseEther("0.25")],
    );

    const campaign = await escrow.read.campaignEscrows([campaignId]);
    assert.equal(campaign[1], parseEther("0.75"));
    assert.equal(campaign[3], true);
  });
});
