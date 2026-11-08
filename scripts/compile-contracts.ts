import { mkdirSync, writeFileSync } from "node:fs";
import { compileContracts } from "./solidity";

const { vault } = compileContracts();
const destination = new URL("../contracts/artifacts/OperatorTreasuryVault.json", import.meta.url);
mkdirSync(new URL("../contracts/artifacts/", import.meta.url), { recursive: true });
writeFileSync(destination, `${JSON.stringify(vault, null, 2)}\n`);
console.log(
  `Compiled ${vault.contractName} with solc ${vault.compiler} (${vault.evmVersion}, ${vault.optimizer.runs} optimizer runs).`
);
console.log(`Artifact: ${destination.pathname}`);
