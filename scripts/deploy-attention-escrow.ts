import { network } from "hardhat";

const { viem } = await network.create();
const contract = await viem.deployContract("AttentionEscrow");
const publicClient = await viem.getPublicClient();
const blockNumber = await publicClient.getBlockNumber();

console.log(JSON.stringify({
  contract: "AttentionEscrow",
  address: contract.address,
  blockNumber: blockNumber.toString(),
}, null, 2));
