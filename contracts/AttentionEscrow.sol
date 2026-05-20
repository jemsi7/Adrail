// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AttentionEscrow {
    address public owner;

    struct CampaignEscrow {
        address advertiser;
        uint256 balance;
        bytes32 policyHash;
        bool active;
    }

    mapping(bytes32 => CampaignEscrow) public campaignEscrows;
    mapping(bytes32 => bool) public settledProofs;

    event CampaignDeposited(
        bytes32 indexed campaignId,
        address indexed advertiser,
        uint256 amount,
        bytes32 policyHash
    );

    event SettlementClaimed(
        bytes32 indexed campaignId,
        bytes32 indexed attentionEventId,
        bytes32 proofHash,
        uint16 scoreBps,
        uint16 thresholdBps,
        address recipient,
        uint256 payoutAmount
    );

    error OnlyOwner();
    error EmptyDeposit();
    error CampaignNotActive();
    error PolicyHashMismatch();
    error ScoreBelowThreshold();
    error DuplicateProof();
    error InsufficientEscrow();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OnlyOwner();
        }
        _;
    }

    function depositCampaign(bytes32 campaignId, bytes32 policyHash) external payable {
        if (msg.value == 0) {
            revert EmptyDeposit();
        }

        CampaignEscrow storage escrow = campaignEscrows[campaignId];
        escrow.advertiser = msg.sender;
        escrow.balance += msg.value;
        escrow.policyHash = policyHash;
        escrow.active = true;

        emit CampaignDeposited(campaignId, msg.sender, msg.value, policyHash);
    }

    function claimSettlement(
        bytes32 campaignId,
        bytes32 attentionEventId,
        bytes32 policyHash,
        bytes32 proofHash,
        uint16 scoreBps,
        uint16 thresholdBps,
        address payable recipient,
        uint256 payoutAmount
    ) external onlyOwner {
        CampaignEscrow storage escrow = campaignEscrows[campaignId];

        if (!escrow.active) {
            revert CampaignNotActive();
        }

        if (escrow.policyHash != policyHash) {
            revert PolicyHashMismatch();
        }

        if (scoreBps < thresholdBps) {
            revert ScoreBelowThreshold();
        }

        if (settledProofs[proofHash]) {
            revert DuplicateProof();
        }

        if (escrow.balance < payoutAmount) {
            revert InsufficientEscrow();
        }

        settledProofs[proofHash] = true;
        escrow.balance -= payoutAmount;
        recipient.transfer(payoutAmount);

        emit SettlementClaimed(
            campaignId,
            attentionEventId,
            proofHash,
            scoreBps,
            thresholdBps,
            recipient,
            payoutAmount
        );
    }
}
