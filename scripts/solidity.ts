import { readFileSync } from "node:fs";
import solc from "solc";
import type { ContractInterface } from "ethers";

export const VAULT_SOURCE = "contracts/OperatorTreasuryVault.sol";
export const TOKEN_SOURCE = "contracts/test/MockERC20.sol";
export const COMPILER_VERSION = "0.8.30";

interface SolcError {
  severity?: string;
  formattedMessage?: string;
  message?: string;
}

interface SolcContract {
  abi: ContractInterface;
  evm: {
    bytecode: { object: string };
    deployedBytecode: { object: string };
  };
}

interface SolcOutput {
  contracts?: Record<string, Record<string, SolcContract | undefined>>;
  errors?: SolcError[];
}

export interface CompiledContract {
  sourceName: string;
  contractName: string;
  compiler: string;
  evmVersion: "paris";
  optimizer: { enabled: true; runs: 200 };
  abi: ContractInterface;
  bytecode: string;
  deployedBytecode: string;
}

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

export function compileContracts(): {
  vault: CompiledContract;
  token: CompiledContract;
} {
  const input = {
    language: "Solidity",
    sources: {
      [VAULT_SOURCE]: { content: source(VAULT_SOURCE) },
      [TOKEN_SOURCE]: { content: source(TOKEN_SOURCE) },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input))) as SolcOutput;
  const errors = output.errors?.filter((error) => error.severity === "error") ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map((error) => error.formattedMessage ?? error.message).join("\n"));
  }

  function artifact(sourceName: string, contractName: string): CompiledContract {
    const contract = output.contracts?.[sourceName]?.[contractName];
    if (!contract || !contract.evm.bytecode.object) {
      throw new Error(`Solc did not produce deployable bytecode for ${contractName}.`);
    }
    return {
      sourceName,
      contractName,
      compiler: COMPILER_VERSION,
      evmVersion: "paris",
      optimizer: { enabled: true, runs: 200 },
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
      deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
    };
  }

  return {
    vault: artifact(VAULT_SOURCE, "OperatorTreasuryVault"),
    token: artifact(TOKEN_SOURCE, "MockERC20"),
  };
}
