// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AttentionEscrow {
    uint16 public constant MIN_THRESHOLD_BPS = 5000;
    uint16 public constant MAX_THRESHOLD_BPS = 9000;
    uint16 public constant MAX_SCORE_BPS = 10000;

    address public owner;

    struct CampaignEscrow {
        address advertiser;
        uint256 balance;
        bytes32 policyHash;
        bool active;
    }

    mapping(bytes32 => CampaignEscrow) public campaignEscrows;
    mapping(bytes32 => bool) public settledProofs;
    mapping(bytes32 => mapping(bytes32 => bool)) public settledAttentionEvents;

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

    event CampaignRefunded(
        bytes32 indexed campaignId,
        address indexed recipient,
        uint256 amount
    );

    error OnlyOwner();
    error EmptyBytes32();
    error EmptyDeposit();
    error CampaignAdvertiserMismatch();
    error CampaignNotActive();
    error PolicyHashMismatch();
    error BpsOutOfRange();
    error ScoreBelowThreshold();
    error DuplicateProof();
    error DuplicateAttentionEvent();
    error InsufficientEscrow();
    error EmptyPayout();
    error InvalidRecipient();
    error PayoutTransferFailed();

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
        if (campaignId == bytes32(0) || policyHash == bytes32(0)) {
            revert EmptyBytes32();
        }

        if (msg.value == 0) {
            revert EmptyDeposit();
        }

        CampaignEscrow storage escrow = campaignEscrows[campaignId];

        if (escrow.active) {
            if (escrow.advertiser != msg.sender) {
                revert CampaignAdvertiserMismatch();
            }

            if (escrow.policyHash != policyHash) {
                revert PolicyHashMismatch();
            }
        } else {
            escrow.advertiser = msg.sender;
            escrow.policyHash = policyHash;
            escrow.active = true;
        }

        escrow.balance += msg.value;

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
        if (
            campaignId == bytes32(0) ||
            attentionEventId == bytes32(0) ||
            policyHash == bytes32(0) ||
            proofHash == bytes32(0)
        ) {
            revert EmptyBytes32();
        }

        if (recipient == address(0)) {
            revert InvalidRecipient();
        }

        if (payoutAmount == 0) {
            revert EmptyPayout();
        }

        if (
            scoreBps > MAX_SCORE_BPS ||
            thresholdBps < MIN_THRESHOLD_BPS ||
            thresholdBps > MAX_THRESHOLD_BPS
        ) {
            revert BpsOutOfRange();
        }

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

        if (settledAttentionEvents[campaignId][attentionEventId]) {
            revert DuplicateAttentionEvent();
        }

        if (escrow.balance < payoutAmount) {
            revert InsufficientEscrow();
        }

        settledProofs[proofHash] = true;
        settledAttentionEvents[campaignId][attentionEventId] = true;
        escrow.balance -= payoutAmount;

        (bool success, ) = recipient.call{value: payoutAmount}("");
        if (!success) {
            revert PayoutTransferFailed();
        }

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

    function refundCampaign(
        bytes32 campaignId,
        address payable recipient,
        uint256 amount
    ) external onlyOwner {
        if (campaignId == bytes32(0)) {
            revert EmptyBytes32();
        }

        if (recipient == address(0)) {
            revert InvalidRecipient();
        }

        if (amount == 0) {
            revert EmptyPayout();
        }

        CampaignEscrow storage escrow = campaignEscrows[campaignId];

        if (!escrow.active) {
            revert CampaignNotActive();
        }

        if (escrow.balance < amount) {
            revert InsufficientEscrow();
        }

        escrow.balance -= amount;
        if (escrow.balance == 0) {
            escrow.active = false;
        }

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert PayoutTransferFailed();
        }

        emit CampaignRefunded(campaignId, recipient, amount);
    }
}
