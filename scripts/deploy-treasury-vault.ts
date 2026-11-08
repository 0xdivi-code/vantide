/**
 * Deploy the compiled vault with an explicitly supplied server-side key.
 *
 * Required:
 *   TREASURY_RPC_URL=https://...
 *   TREASURY_CHAIN_ID=56
 *   TREASURY_OWNER_ADDRESS=0x...       preferably an audited multisig
 *   TREASURY_DEPLOYER_PRIVATE_KEY=0x...
 *   TREASURY_DEPLOY_CONFIRM=DEPLOY_56  must match the RPC chain
 *
 * No deployment is attempted unless every value is present and validated.
 */
import { readFileSync } from "node:fs";
import { Contract, ContractFactory, Wallet, providers, utils } from "ethers";
import { loadDotEnv } from "../server/admin/env";
import type { CompiledContract } from "./solidity";

loadDotEnv();

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. See docs/treasury-vault.md.`);
  return value;
}

async function main() {
  const rpcUrl = required("TREASURY_RPC_URL");
  const chainId = Number(required("TREASURY_CHAIN_ID"));
  const ownerAddress = required("TREASURY_OWNER_ADDRESS");
  const privateKey = required("TREASURY_DEPLOYER_PRIVATE_KEY");
  const confirmation = required("TREASURY_DEPLOY_CONFIRM");

  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("TREASURY_CHAIN_ID must be a positive integer.");
  }
  if (!utils.isAddress(ownerAddress) || utils.getAddress(ownerAddress) === "0x0000000000000000000000000000000000000000") {
    throw new Error("TREASURY_OWNER_ADDRESS must be a valid non-zero EVM address.");
  }
  if (confirmation !== `DEPLOY_${chainId}`) {
    throw new Error(`Refusing deployment. Set TREASURY_DEPLOY_CONFIRM=DEPLOY_${chainId} after reviewing all inputs.`);
  }

  const provider = new providers.JsonRpcProvider(rpcUrl, chainId);
  const network = await provider.getNetwork();
  if (network.chainId !== chainId) {
    throw new Error(`RPC chain ${network.chainId} does not match TREASURY_CHAIN_ID=${chainId}.`);
  }
  const deployer = new Wallet(privateKey, provider);
  const artifact = JSON.parse(
    readFileSync(new URL("../contracts/artifacts/OperatorTreasuryVault.json", import.meta.url), "utf8")
  ) as CompiledContract;
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const deployTransaction = factory.getDeployTransaction(utils.getAddress(ownerAddress));
  const [estimatedGas, balance] = await Promise.all([
    provider.estimateGas(deployTransaction),
    provider.getBalance(deployer.address),
  ]);

  console.log(`Chain ID: ${network.chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Initial owner: ${utils.getAddress(ownerAddress)}`);
  console.log(`Estimated deployment gas: ${estimatedGas.toString()}`);
  console.log(`Deployer native balance: ${utils.formatEther(balance)}`);

  const vault = await factory.deploy(utils.getAddress(ownerAddress));
  console.log(`Deployment transaction: ${vault.deployTransaction.hash}`);
  const confirmations = Number(process.env.TREASURY_DEPLOY_CONFIRMATIONS ?? 2);
  await vault.deployTransaction.wait(
    Number.isInteger(confirmations) && confirmations > 0 ? Math.min(confirmations, 24) : 2
  );

  const [code, actualOwner] = await Promise.all([
    provider.getCode(vault.address),
    new Contract(vault.address, artifact.abi, provider).owner(),
  ]);
  if (code === "0x" || actualOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error("Post-deployment verification failed: code or owner does not match.");
  }

  console.log(`Vault deployed and verified: ${vault.address}`);
  console.log("Browser-safe deployment configuration (review before publishing):");
  console.log(`VITE_TREASURY_CHAIN_ID: "${network.chainId}",`);
  console.log(`VITE_TREASURY_VAULT_ADDRESS: "${utils.getAddress(vault.address)}",`);
}

main().catch((error) => {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of [process.env.TREASURY_DEPLOYER_PRIVATE_KEY, process.env.TREASURY_RPC_URL]) {
    if (secret) message = message.split(secret).join("[redacted]");
  }
  console.error(`Treasury deployment failed: ${message}`);
  process.exitCode = 1;
});
