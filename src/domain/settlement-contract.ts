import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEventLogs,
  type Hex,
  type Log,
  type TransactionReceipt
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ATTENTION_ESCROW_ABI,
  deterministicEscrowDepositGateway,
  deterministicTestnetSettlementGateway,
  type EscrowDepositGateway,
  type SettlementContractReceipt,
  type SettlementTransactionGateway
} from "./settlement";
import {
  assertPrivacySafeContractArgs,
  depositToContractArgs,
  normalizeAddress,
  settlementProofToContractArgs
} from "./settlement-encoding";

const attentionEscrowAbi = parseAbi([...ATTENTION_ESCROW_ABI]);

export type SettlementRuntimeMode = "simulated" | "testnet";

export type TestnetEscrowRuntimeConfig = {
  mode: SettlementRuntimeMode;
  chainId?: number;
  rpcUrl?: string;
  contractAddress?: `0x${string}`;
  settlementSignerPrivateKey?: `0x${string}`;
  advertiserDepositPrivateKey?: `0x${string}`;
};

export function readSettlementRuntimeConfig(
  env: Record<string, string | undefined> = process.env
): TestnetEscrowRuntimeConfig {
  const mode = (env.SETTLEMENT_MODE ?? "simulated") as SettlementRuntimeMode;

  if (mode !== "simulated" && mode !== "testnet") {
    throw new Error("SETTLEMENT_MODE must be either simulated or testnet.");
  }

  if (mode === "simulated") {
    return { mode };
  }

  const required = [
    "CHAIN_ID",
    "CHAIN_RPC_URL",
    "ESCROW_CONTRACT_ADDRESS",
    "SETTLEMENT_SIGNER_PRIVATE_KEY"
  ] as const;
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing testnet settlement env vars: ${missing.join(", ")}`);
  }

  const chainId = Number(env.CHAIN_ID);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("CHAIN_ID must be a positive integer.");
  }

  return {
    mode,
    chainId,
    rpcUrl: env.CHAIN_RPC_URL!,
    contractAddress: normalizeAddress(env.ESCROW_CONTRACT_ADDRESS!) as `0x${string}`,
    settlementSignerPrivateKey: normalizePrivateKey(env.SETTLEMENT_SIGNER_PRIVATE_KEY!),
    advertiserDepositPrivateKey: env.ADVERTISER_DEPOSIT_PRIVATE_KEY
      ? normalizePrivateKey(env.ADVERTISER_DEPOSIT_PRIVATE_KEY)
      : undefined
  };
}

export function createViemSettlementGateway(input: {
  rpcUrl: string;
  privateKey: `0x${string}`;
}): SettlementTransactionGateway {
  const account = privateKeyToAccount(input.privateKey);
  const publicClient = createPublicClient({
    transport: http(input.rpcUrl)
  });
  const walletClient = createWalletClient({
    account,
    transport: http(input.rpcUrl)
  });

  return {
    async submitSettlementProof(settlementInput) {
      if (!settlementInput.recipientAddress || !settlementInput.payoutAmountWei) {
        throw new Error("Live settlement gateway requires recipientAddress and payoutAmountWei.");
      }

      const args = settlementProofToContractArgs({
        proof: settlementInput.proof,
        recipientAddress: settlementInput.recipientAddress,
        payoutAmountWei: settlementInput.payoutAmountWei
      });
      assertPrivacySafeContractArgs(args);

      const txHash = await walletClient.writeContract({
        address: settlementInput.contractAddress as `0x${string}`,
        abi: attentionEscrowAbi,
        functionName: "claimSettlement",
        chain: null,
        args
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      return {
        txHash,
        chainId: settlementInput.chainId,
        contractAddress: settlementInput.contractAddress,
        submittedAt: settlementInput.submittedAt
      };
    }
  };
}

export function createSettlementGatewayFromRuntimeConfig(
  config: TestnetEscrowRuntimeConfig
): SettlementTransactionGateway {
  if (config.mode === "simulated") {
    return deterministicTestnetSettlementGateway;
  }

  if (!config.rpcUrl || !config.settlementSignerPrivateKey) {
    throw new Error("Testnet settlement gateway requires RPC URL and settlement signer key.");
  }

  return createViemSettlementGateway({
    rpcUrl: config.rpcUrl,
    privateKey: config.settlementSignerPrivateKey
  });
}

export function createViemEscrowDepositGateway(input: {
  rpcUrl: string;
  privateKey: `0x${string}`;
}): EscrowDepositGateway {
  const account = privateKeyToAccount(input.privateKey);
  const publicClient = createPublicClient({
    transport: http(input.rpcUrl)
  });
  const walletClient = createWalletClient({
    account,
    transport: http(input.rpcUrl)
  });

  return {
    async depositCampaign(depositInput) {
      if (depositInput.depositAmountWei <= 0n) {
        throw new Error("Deposit amount must be greater than zero.");
      }

      const args = depositToContractArgs({
        campaignId: depositInput.campaignId,
        policyHash: depositInput.policyHash
      });
      assertPrivacySafeContractArgs(args);

      const txHash = await walletClient.writeContract({
        address: depositInput.contractAddress as `0x${string}`,
        abi: attentionEscrowAbi,
        functionName: "depositCampaign",
        chain: null,
        args,
        value: depositInput.depositAmountWei
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      return {
        txHash,
        chainId: depositInput.chainId,
        contractAddress: depositInput.contractAddress,
        submittedAt: depositInput.depositedAt
      };
    }
  };
}

export function createEscrowDepositGatewayFromRuntimeConfig(
  config: TestnetEscrowRuntimeConfig
): EscrowDepositGateway {
  if (config.mode === "simulated") {
    return deterministicEscrowDepositGateway;
  }

  if (!config.rpcUrl || !config.advertiserDepositPrivateKey) {
    throw new Error("Testnet deposit gateway requires RPC URL and advertiser deposit private key.");
  }

  return createViemEscrowDepositGateway({
    rpcUrl: config.rpcUrl,
    privateKey: config.advertiserDepositPrivateKey
  });
}

export function viemReceiptToSettlementContractReceipt(input: {
  receipt: Pick<TransactionReceipt, "transactionHash" | "status" | "blockNumber" | "logs">;
  chainId: number;
  contractAddress: string;
}): SettlementContractReceipt {
  const logs = parseAttentionEscrowLogs(input.receipt.logs);

  return {
    txHash: input.receipt.transactionHash,
    chainId: input.chainId,
    contractAddress: input.contractAddress,
    status: input.receipt.status === "success" ? "confirmed" : "failed",
    blockNumber: Number(input.receipt.blockNumber),
    logs
  };
}

function parseAttentionEscrowLogs(logs: readonly Log[]) {
  const parsedLogs = parseEventLogs({
    abi: attentionEscrowAbi,
    logs: [...logs],
    strict: false
  });

  return parsedLogs.map((log) => ({
    eventName: log.eventName,
    args: Object.fromEntries(
      Object.entries(log.args ?? {}).map(([key, value]) => [
        key,
        normalizeLogValue(value)
      ])
    )
  }));
}

function normalizeLogValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }

  return value;
}

function normalizePrivateKey(value: string): Hex {
  const normalized = value.startsWith("0x") ? value : `0x${value}`;

  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error("Expected a 32-byte EVM private key.");
  }

  return normalized as Hex;
}
