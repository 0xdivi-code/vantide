import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useWalletConnector } from "@orderly.network/hooks";
import { BigNumber, Contract, providers, utils } from "ethers";
import { abi as VAULT_ABI } from "../../../contracts/artifacts/OperatorTreasuryVault.json";
import { getRuntimeConfig } from "@/utils/runtime-config";
import { useConfigVersion } from "@/admin/useConfigVersion";
import {
  AdminButton,
  Badge,
  Card,
  Field,
  PageHeader,
  TextInput,
} from "./ui";

interface VaultSnapshot {
  owner: string;
  paused: boolean;
  nativeBalance: BigNumber;
  tokenBalance?: BigNumber;
  tokenDecimals?: number;
  tokenSymbol?: string;
}

type Action = "deposit" | "withdraw";
type Asset = "native" | "token";

function errorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const record = error as {
    message?: string;
    code?: string | number;
    error?: { message?: string };
    data?: { message?: string };
  };
  if (record.code === 4001) return "The wallet request was rejected.";
  return (
    record.error?.message ??
    record.data?.message ??
    record.message ??
    "The wallet transaction failed."
  );
}

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function validConfiguredAddress(value: string | undefined): value is string {
  return Boolean(value && utils.isAddress(value) && value !== "0x0000000000000000000000000000000000000000");
}

export function TreasuryVaultPanel() {
  useConfigVersion();
  const { wallet, connectedChain, connect, setChain } = useWalletConnector();
  const vaultAddress = getRuntimeConfig("VITE_TREASURY_VAULT_ADDRESS")?.trim() ?? "";
  const tokenAddress = getRuntimeConfig("VITE_TREASURY_TOKEN_ADDRESS")?.trim() ?? "";
  const chainId = Number(getRuntimeConfig("VITE_TREASURY_CHAIN_ID") ?? "");
  const account = wallet?.accounts[0]?.address;
  const connectedChainId = Number(connectedChain?.id ?? 0);
  const validConfig =
    validConfiguredAddress(vaultAddress) &&
    Number.isInteger(chainId) &&
    chainId > 0 &&
    (!tokenAddress || validConfiguredAddress(tokenAddress));
  const chainMatches = connectedChainId === chainId;

  const provider = useMemo(() => {
    const candidate = wallet?.provider;
    if (!candidate || !("request" in candidate) || typeof candidate.request !== "function") {
      return undefined;
    }
    return new providers.Web3Provider(candidate as never, "any");
  }, [wallet?.provider]);

  const [snapshot, setSnapshot] = useState<VaultSnapshot>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [txHash, setTxHash] = useState<string>();
  const [action, setAction] = useState<Action>("deposit");
  const [asset, setAsset] = useState<Asset>("native");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");

  useEffect(() => {
    if (account) setRecipient(account);
  }, [account]);

  useEffect(() => {
    if (!tokenAddress) setAsset("native");
  }, [tokenAddress]);

  const refresh = useCallback(async () => {
    if (!provider || !validConfig || !chainMatches) {
      setSnapshot(undefined);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const code = await provider.getCode(vaultAddress);
      if (code === "0x") {
        throw new Error(`No contract is deployed at ${vaultAddress} on chain ${chainId}.`);
      }
      const vault = new Contract(vaultAddress, VAULT_ABI, provider);
      const [owner, paused, nativeBalance] = await Promise.all([
        vault.owner() as Promise<string>,
        vault.paused() as Promise<boolean>,
        provider.getBalance(vaultAddress),
      ]);
      let tokenBalance: BigNumber | undefined;
      let tokenDecimals: number | undefined;
      let tokenSymbol: string | undefined;
      if (tokenAddress) {
        const token = new Contract(
          tokenAddress,
          [
            "function balanceOf(address) view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)",
          ],
          provider
        );
        [tokenBalance, tokenDecimals] = await Promise.all([
          token.balanceOf(vaultAddress),
          token.decimals(),
        ]);
        try {
          tokenSymbol = await token.symbol();
        } catch {
          tokenSymbol = "Token";
        }
      }
      setSnapshot({ owner, paused, nativeBalance, tokenBalance, tokenDecimals, tokenSymbol });
    } catch (nextError) {
      setSnapshot(undefined);
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [chainId, chainMatches, provider, tokenAddress, validConfig, vaultAddress]);

  useEffect(() => {
    void refresh();
    if (!provider || !validConfig || !chainMatches) return undefined;
    const timer = globalThis.setInterval(() => void refresh(), 30_000);
    return () => globalThis.clearInterval(timer);
  }, [chainMatches, provider, refresh, validConfig]);

  const signer = account && provider ? provider.getSigner(account) : undefined;
  const isOwner = Boolean(
    account && snapshot?.owner && account.toLowerCase() === snapshot.owner.toLowerCase()
  );

  const connectWallet = async () => {
    setError(undefined);
    try {
      await connect();
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  };

  const switchChain = async () => {
    setError(undefined);
    try {
      await setChain({ chainId });
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  };

  const sendTransaction = async () => {
    if (!signer || !account || !snapshot || !chainMatches) return;
    setError(undefined);
    setTxHash(undefined);
    setBusy("Preparing wallet transaction");
    try {
      const units = asset === "native"
        ? utils.parseEther(amount || "0")
        : utils.parseUnits(amount || "0", snapshot.tokenDecimals ?? 0);
      if (units.lte(0)) throw new Error("Enter an amount greater than zero.");
      const vault = new Contract(vaultAddress, VAULT_ABI, signer);
      let transaction;

      if (action === "deposit") {
        if (asset === "native") {
          setBusy("Confirm native deposit in your wallet");
          transaction = await signer.sendTransaction({ to: vaultAddress, value: units });
        } else {
          if (!tokenAddress) throw new Error("Configure the treasury ERC-20 token address first.");
          const token = new Contract(
            tokenAddress,
            [
              "function allowance(address,address) view returns (uint256)",
              "function approve(address,uint256) returns (bool)",
            ],
            signer
          );
          const allowance: BigNumber = await token.allowance(account, vaultAddress);
          if (allowance.lt(units)) {
            if (!allowance.isZero()) {
              setBusy("Resetting the previous token allowance");
              const reset = await token.approve(vaultAddress, 0);
              await reset.wait(1);
            }
            setBusy("Confirm the exact token allowance in your wallet");
            const approval = await token.approve(vaultAddress, units);
            await approval.wait(1);
          }
          setBusy("Confirm the vault token deposit in your wallet");
          transaction = await vault.depositToken(tokenAddress, units);
        }
      } else {
        if (!isOwner) throw new Error("Only the current vault owner can withdraw treasury assets.");
        if (!validConfiguredAddress(recipient.trim())) {
          throw new Error("Enter a valid non-zero recipient address.");
        }
        if (recipient.trim().toLowerCase() === vaultAddress.toLowerCase()) {
          throw new Error("Choose a recipient other than the vault itself.");
        }
        setBusy("Confirm the owner withdrawal in your wallet");
        transaction = asset === "native"
          ? await vault.withdrawNative(utils.getAddress(recipient.trim()), units)
          : await vault.withdrawToken(tokenAddress, utils.getAddress(recipient.trim()), units);
      }

      setBusy(`Waiting for confirmation ${transaction.hash}`);
      const receipt = await transaction.wait(1);
      if (receipt.status !== 1) throw new Error("The transaction reverted on-chain.");
      setTxHash(transaction.hash);
      setAmount("");
      await refresh();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(undefined);
    }
  };

  const togglePause = async () => {
    if (!signer || !snapshot || !isOwner) return;
    setError(undefined);
    setTxHash(undefined);
    setBusy(snapshot.paused ? "Confirm unpause in your wallet" : "Confirm pause in your wallet");
    try {
      const vault = new Contract(vaultAddress, VAULT_ABI, signer);
      const transaction = snapshot.paused ? await vault.unpause() : await vault.pause();
      const receipt = await transaction.wait(1);
      if (receipt.status !== 1) throw new Error("The transaction reverted on-chain.");
      setTxHash(transaction.hash);
      await refresh();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Operator treasury"
        description="Real EVM vault balances and wallet-signed transactions. MongoDB records below are separate administrative data and never move funds."
        actions={
          <AdminButton onClick={() => void refresh()} disabled={loading || !provider || !chainMatches}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh chain data
          </AdminButton>
        }
      />

      <div className="rounded-lg border border-[rgba(var(--oui-color-primary),0.3)] bg-[rgba(var(--oui-color-primary),0.07)] px-4 py-3 text-xs leading-relaxed text-white/60">
        This vault is for operator funds and protocol revenue only. It cannot pull Orderly broker fees by itself; revenue routing requires a supported Orderly/broker configuration or an explicit transfer. User trading collateral remains in Orderly&apos;s non-custodial infrastructure.
      </div>

      {!validConfig ? (
        <Card title="Vault activation required" subtitle="No on-chain controls are shown until the deployed contract is configured">
          <div className="space-y-2 text-sm text-white/55">
            <p>Set these deployment-controlled, browser-safe values in <code>public/config.js</code>:</p>
            <pre className="overflow-x-auto rounded-lg bg-black/25 p-3 text-xs text-white/70">{`VITE_TREASURY_CHAIN_ID: "56",
VITE_TREASURY_VAULT_ADDRESS: "0x…",
VITE_TREASURY_TOKEN_ADDRESS: "0x…" // optional ERC-20`}</pre>
            <p className="text-xs text-white/40">Run <code>yarn deploy:treasury</code> only after reviewing docs/treasury-vault.md and supplying production owner/deployer inputs.</p>
          </div>
        </Card>
      ) : !wallet || !provider || !account ? (
        <Card title="Connect the operator wallet" subtitle="Reads and transactions use the same Orderly wallet connection as the DEX">
          <div className="space-y-3">
            {error && <div className="text-sm text-[rgb(var(--oui-color-danger))]">{error}</div>}
            <AdminButton variant="primary" onClick={() => void connectWallet()}>
              <Wallet size={15} /> Connect wallet
            </AdminButton>
          </div>
        </Card>
      ) : !chainMatches ? (
        <Card title="Wrong wallet chain" subtitle={`The configured vault is on chain ${chainId}; the wallet is on ${connectedChainId || "an unknown chain"}.`}>
          <div className="space-y-3">
            {error && <div className="text-sm text-[rgb(var(--oui-color-danger))]">{error}</div>}
            <AdminButton variant="primary" onClick={() => void switchChain()}>
              Switch to chain {chainId}
            </AdminButton>
          </div>
        </Card>
      ) : (
        <>
          <Card
            title="On-chain vault"
            subtitle={`${vaultAddress} · chain ${chainId}`}
            actions={
              <Badge tone={!snapshot ? "neutral" : snapshot.paused ? "warning" : "success"}>
                {!snapshot ? (loading ? "Checking chain…" : "Unverified") : snapshot.paused ? "Paused on-chain" : "Active on-chain"}
              </Badge>
            }
          >
            {error && !snapshot ? (
              <div className="text-sm text-[rgb(var(--oui-color-danger))]">{error}</div>
            ) : loading && !snapshot ? (
              <div className="text-sm text-white/45">Reading contract code, owner and balances…</div>
            ) : snapshot ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-wide text-white/35">Native balance</div>
                    <div className="mt-1 text-lg font-semibold text-white/85">{utils.formatEther(snapshot.nativeBalance)}</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-wide text-white/35">{snapshot.tokenSymbol ?? "ERC-20"} balance</div>
                    <div className="mt-1 text-lg font-semibold text-white/85">
                      {snapshot.tokenBalance && snapshot.tokenDecimals !== undefined
                        ? utils.formatUnits(snapshot.tokenBalance, snapshot.tokenDecimals)
                        : "Not configured"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-wide text-white/35">Contract owner</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-white/80" title={snapshot.owner}>
                      <ShieldCheck size={15} /> {shortAddress(snapshot.owner)}
                    </div>
                    <div className="mt-1 text-[11px] text-white/35">{isOwner ? "Connected wallet is owner" : "Connected wallet is not owner"}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <div className="text-xs text-white/45">Connected: <span title={account}>{shortAddress(account)}</span></div>
                  <AdminButton onClick={() => void togglePause()} disabled={!isOwner || Boolean(busy)} title={isOwner ? "Wallet-signed owner action" : "Only the contract owner can pause"}>
                    {snapshot.paused ? <Play size={14} /> : <Pause size={14} />}
                    {snapshot.paused ? "Unpause vault" : "Pause vault"}
                  </AdminButton>
                </div>
              </div>
            ) : null}
          </Card>

          {snapshot && (
            <Card title="Fund or withdraw" subtitle="Every action requires a real wallet signature and one on-chain confirmation">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <AdminButton variant={action === "deposit" ? "primary" : "secondary"} onClick={() => setAction("deposit")}>
                    <ArrowDownToLine size={14} /> Deposit
                  </AdminButton>
                  <AdminButton variant={action === "withdraw" ? "primary" : "secondary"} onClick={() => setAction("withdraw")} disabled={!isOwner} title={isOwner ? "Owner-only withdrawal" : "Only the current contract owner can withdraw"}>
                    <ArrowUpFromLine size={14} /> Withdraw
                  </AdminButton>
                  <div className="mx-1 w-px bg-white/10" />
                  <AdminButton variant={asset === "native" ? "primary" : "secondary"} onClick={() => setAsset("native")}>Native asset</AdminButton>
                  <AdminButton variant={asset === "token" ? "primary" : "secondary"} onClick={() => setAsset("token")} disabled={!tokenAddress}>ERC-20</AdminButton>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={`Amount ${asset === "token" ? `(${snapshot.tokenSymbol ?? "token"})` : "(native asset)"}`} hint={asset === "native" ? "18 decimals" : `${snapshot.tokenDecimals ?? 0} decimals`}>
                    <TextInput value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.0" inputMode="decimal" disabled={Boolean(busy) || snapshot.paused} />
                  </Field>
                  {action === "withdraw" && (
                    <Field label="Recipient" hint="Verify this address carefully; confirmed transfers are irreversible">
                      <TextInput value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="0x…" disabled={Boolean(busy) || snapshot.paused} />
                    </Field>
                  )}
                </div>

                {snapshot.paused && <div className="text-xs text-[rgb(var(--oui-color-warning))]">The vault is paused on-chain. The owner must unpause it before funding or withdrawals.</div>}
                {busy && <div className="text-xs text-[rgb(var(--oui-color-primary-light))]">{busy}…</div>}
                {error && <div className="text-sm text-[rgb(var(--oui-color-danger))]">{error}</div>}
                {txHash && (
                  <div className="flex items-start gap-2 rounded-lg border border-[rgba(var(--oui-color-success),0.25)] bg-[rgba(var(--oui-color-success),0.07)] p-3 text-xs text-[rgb(var(--oui-color-success))]">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                    <span className="break-all">Confirmed transaction: {txHash}</span>
                  </div>
                )}

                <AdminButton
                  variant="primary"
                  onClick={() => void sendTransaction()}
                  disabled={Boolean(busy) || snapshot.paused || !amount || (action === "withdraw" && !isOwner)}
                >
                  {action === "deposit" ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
                  {action === "deposit" ? "Sign deposit" : "Sign owner withdrawal"}
                </AdminButton>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
