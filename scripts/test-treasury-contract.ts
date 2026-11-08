/**
 * Execute the actual vault bytecode against a local Ganache EVM.
 * No production keys, RPC endpoints, tokens, or Orderly accounts are used.
 */
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ganache from "ganache";
import {
  Contract,
  ContractFactory,
  Wallet,
  providers,
  constants,
  utils,
} from "ethers";
import { compileContracts } from "./solidity";

const compiled = compileContracts();
const INITIAL_BALANCE = utils.parseEther("1000").toHexString();

interface LocalChain {
  provider: providers.Web3Provider;
  owner: Wallet;
  funder: Wallet;
  recipient: Wallet;
  nextOwner: Wallet;
}

function localChain(t: TestContext): LocalChain {
  const wallets = Array.from({ length: 4 }, () => Wallet.createRandom());
  const eip1193 = ganache.provider({
    chain: { chainId: 31337 },
    logging: { quiet: true },
    wallet: {
      accounts: wallets.map((wallet) => ({
        secretKey: wallet.privateKey,
        balance: INITIAL_BALANCE,
      })),
    },
  });
  t.after(async () => eip1193.disconnect());
  const provider = new providers.Web3Provider(eip1193 as never, "any");
  const [owner, funder, recipient, nextOwner] = wallets.map(
    (wallet) => wallet.connect(provider)
  ) as [Wallet, Wallet, Wallet, Wallet];
  return { provider, owner, funder, recipient, nextOwner };
}

async function deployVault(chain: LocalChain): Promise<Contract> {
  const factory = new ContractFactory(
    compiled.vault.abi,
    compiled.vault.bytecode,
    chain.owner
  );
  const vault = await factory.deploy(chain.owner.address);
  await vault.deployTransaction.wait();
  return vault;
}

async function deployToken(owner: Wallet): Promise<Contract> {
  const factory = new ContractFactory(compiled.token.abi, compiled.token.bytecode, owner);
  const token = await factory.deploy();
  await token.deployTransaction.wait();
  return token;
}

test("the checked-in artifact matches the tested compiler output", () => {
  const artifact = JSON.parse(
    readFileSync(
      new URL("../contracts/artifacts/OperatorTreasuryVault.json", import.meta.url),
      "utf8"
    )
  );
  assert.deepEqual(artifact, compiled.vault);
  assert.ok(compiled.vault.bytecode.length > 1_000);
  assert.ok(compiled.vault.deployedBytecode.length > 500);
});

test("native funding and owner-only withdrawal work with immutable events", async (t) => {
  const chain = localChain(t);
  const vault = await deployVault(chain);
  assert.equal(await vault.owner(), chain.owner.address);
  assert.equal(await vault.VERSION(), "1.0.0");

  const deposit = await chain.funder.sendTransaction({
    to: vault.address,
    value: utils.parseEther("2"),
  });
  await deposit.wait();
  assert.equal((await chain.provider.getBalance(vault.address)).toString(), utils.parseEther("2").toString());
  const events = await vault.queryFilter(vault.filters.NativeDeposited(chain.funder.address));
  assert.equal(events.length, 1);
  assert.equal(events[0]!.args!.amount.toString(), utils.parseEther("2").toString());

  await assert.rejects(
    vault.connect(chain.funder).withdrawNative(chain.recipient.address, utils.parseEther("1"))
  );

  const before = await chain.provider.getBalance(chain.recipient.address);
  const withdrawal = await vault.withdrawNative(chain.recipient.address, utils.parseEther("0.75"));
  await withdrawal.wait();
  const after = await chain.provider.getBalance(chain.recipient.address);
  assert.equal(after.sub(before).toString(), utils.parseEther("0.75").toString());
  assert.equal((await chain.provider.getBalance(vault.address)).toString(), utils.parseEther("1.25").toString());

  await assert.rejects(chain.funder.sendTransaction({ to: vault.address, data: "0x12345678" }));
});

test("ERC-20 approval, deposit and withdrawal use real token balances", async (t) => {
  const chain = localChain(t);
  const vault = await deployVault(chain);
  const token = await deployToken(chain.owner);
  const mintAmount = utils.parseUnits("1000", 6);
  const depositAmount = utils.parseUnits("250", 6);
  const withdrawAmount = utils.parseUnits("100", 6);

  await (await token.mint(chain.funder.address, mintAmount)).wait();
  await (await token.connect(chain.funder).approve(vault.address, depositAmount)).wait();
  await (await vault.connect(chain.funder).depositToken(token.address, depositAmount)).wait();
  assert.equal((await token.balanceOf(vault.address)).toString(), depositAmount.toString());
  assert.equal((await token.balanceOf(chain.funder.address)).toString(), mintAmount.sub(depositAmount).toString());

  await assert.rejects(
    vault.connect(chain.funder).withdrawToken(token.address, chain.recipient.address, withdrawAmount)
  );
  await (await vault.withdrawToken(token.address, chain.recipient.address, withdrawAmount)).wait();
  assert.equal((await token.balanceOf(chain.recipient.address)).toString(), withdrawAmount.toString());
  assert.equal((await token.balanceOf(vault.address)).toString(), depositAmount.sub(withdrawAmount).toString());

  const deposits = await vault.queryFilter(vault.filters.TokenDeposited(token.address, chain.funder.address));
  assert.equal(deposits[0]!.args!.receivedAmount.toString(), depositAmount.toString());
  const withdrawals = await vault.queryFilter(vault.filters.TokenWithdrawn(token.address, chain.recipient.address));
  assert.equal(withdrawals[0]!.args!.amount.toString(), withdrawAmount.toString());
});

test("pause blocks funding and withdrawals until the owner unpauses", async (t) => {
  const chain = localChain(t);
  const vault = await deployVault(chain);
  await (await chain.funder.sendTransaction({ to: vault.address, value: 1000 })).wait();
  await assert.rejects(vault.connect(chain.funder).pause());
  await (await vault.pause()).wait();
  assert.equal(await vault.paused(), true);

  await assert.rejects(chain.funder.sendTransaction({ to: vault.address, value: 1000 }));
  await assert.rejects(vault.depositNative({ value: 1000 }));
  await assert.rejects(vault.withdrawNative(chain.recipient.address, 100));
  await assert.rejects(vault.pause());

  await (await vault.unpause()).wait();
  assert.equal(await vault.paused(), false);
  await (await vault.withdrawNative(chain.recipient.address, 100)).wait();
  assert.equal((await chain.provider.getBalance(vault.address)).toString(), "900");
});

test("ownership transfer requires the pending owner and cannot be renounced", async (t) => {
  const chain = localChain(t);
  const vault = await deployVault(chain);
  await assert.rejects(vault.transferOwnership(constants.AddressZero));
  await (await vault.transferOwnership(chain.nextOwner.address)).wait();
  assert.equal(await vault.owner(), chain.owner.address);
  assert.equal(await vault.pendingOwner(), chain.nextOwner.address);

  await assert.rejects(vault.connect(chain.funder).acceptOwnership());
  await (await vault.connect(chain.nextOwner).acceptOwnership()).wait();
  assert.equal(await vault.owner(), chain.nextOwner.address);
  assert.equal(await vault.pendingOwner(), constants.AddressZero);
  await assert.rejects(vault.pause());
  await (await vault.connect(chain.nextOwner).pause()).wait();
});

test("invalid deployments, tokens and amounts are rejected", async (t) => {
  const chain = localChain(t);
  const factory = new ContractFactory(compiled.vault.abi, compiled.vault.bytecode, chain.owner);
  await assert.rejects(factory.deploy(constants.AddressZero));
  const vault = await deployVault(chain);

  await assert.rejects(vault.depositNative({ value: 0 }));
  await assert.rejects(vault.depositToken(chain.funder.address, 100));
  await assert.rejects(vault.withdrawNative(chain.recipient.address, 0));
  await assert.rejects(vault.withdrawNative(chain.recipient.address, 1));
  await assert.rejects(vault.withdrawToken(chain.funder.address, chain.recipient.address, 1));
});
