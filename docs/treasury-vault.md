# Operator treasury vault

`contracts/OperatorTreasuryVault.sol` is a small, operator-owned EVM treasury for native assets and ERC-20 protocol revenue. The admin Treasury page reads this contract and sends real wallet-signed transactions through the existing Orderly EIP-1193 wallet connection.

## Security boundary

- **Operator/revenue assets only.** Do not send user trading collateral to this contract. Orderly user collateral stays in Orderly's supported non-custodial infrastructure.
- The contract **cannot pull fees from Orderly**. A registered broker and a supported Orderly fee-recipient configuration, or an explicit revenue transfer, are still required.
- Only `owner` can withdraw, pause, unpause, or start ownership transfer. Use a reviewed multisig as production owner rather than a browser EOA.
- Ownership transfer is two-step and ownership cannot be renounced. The contract is not upgradeable.
- Pause blocks native/token deposits and withdrawals. Every deposit, withdrawal, pause, and ownership change emits an event.
- Token events report actual balance deltas. Reentrancy guards protect token/native transfers. Unknown function calls and zero-value deposits revert.

This is a local implementation, not an independently audited protocol. The six Ganache tests do not replace a professional security review, chain-specific token review, multisig policy, monitoring, or incident-response plan.

## Compile and test

```bash
yarn compile:contracts
yarn test:contracts
```

The build uses pinned `solc@0.8.30`, optimizer 200 runs, and the Paris EVM target for broad EVM compatibility. `contracts/artifacts/OperatorTreasuryVault.json` contains the ABI and deployment bytecode; the tests fail if it differs from freshly compiled output.

Tests execute real deployment and transaction flows on a local EVM: native funding/withdrawal, ERC-20 approval/funding/withdrawal, unauthorized-call rejection, pause behavior, two-step ownership, invalid inputs, and event balances. No mainnet RPC or credentials are used.

## Deploy

1. Complete an independent contract review and choose the exact chain.
2. Create/fund a deployment account. Keep its private key server-side; never use a `VITE_*` variable.
3. Choose the long-term owner, preferably a multisig, and confirm it can receive native/token assets on that chain.
4. Put deployment-only values in `.env.local` (which Git ignores) and restrict its permissions:

```env
TREASURY_RPC_URL=https://your-rpc-endpoint
TREASURY_CHAIN_ID=56
TREASURY_OWNER_ADDRESS=0xYourMultisig
TREASURY_DEPLOYER_PRIVATE_KEY=0xYourServerSideDeploymentKey
TREASURY_DEPLOY_CONFIRM=DEPLOY_56
TREASURY_DEPLOY_CONFIRMATIONS=2
```

5. Run:

```bash
chmod 600 .env.local
yarn deploy:treasury
```

The script refuses missing/zero addresses, chain mismatches, and a confirmation string that does not equal `DEPLOY_<chainId>`. After deployment it checks that bytecode exists and `owner()` matches the requested owner. Errors redact the RPC URL and private key. Remove the deployer key from `.env.local` when finished. Verify the source on the chain's block explorer using the same compiler and settings before relying on explorer-based monitoring.

**No mainnet deployment has been performed by this repository work.** Actual activation needs your RPC, chain selection, owner/multisig, funded deployer, and explicit confirmation.

## Connect the admin UI

After reviewing the deployment, set the public addresses in `public/config.js`:

```js
VITE_TREASURY_CHAIN_ID: "56",
VITE_TREASURY_VAULT_ADDRESS: "0xDeployedVault",
VITE_TREASURY_TOKEN_ADDRESS: "0xApprovedRevenueToken", // optional
```

These financial routing values are intentionally excluded from shared runtime-config writes. Redeploy the frontend after changing them.

At `/admin/treasury`:

- Any connected EVM wallet can fund the configured vault; native funding is a direct transfer and ERC-20 funding uses an exact allowance followed by `depositToken`.
- Only the wallet matching `owner()` can withdraw or pause/unpause. Contract enforcement remains authoritative even if UI state is stale.
- The UI checks that contract code exists on the configured chain and waits for one confirmation before displaying a transaction hash.
- Chain mismatches require an explicit wallet switch. Recipient addresses should be independently verified; confirmed transfers are irreversible.
- MongoDB treasury rows below the on-chain panel are separate administrative records. They are not balances and cannot move funds.

Before production revenue routing, test the full flow with the actual owner/multisig and token on the selected chain, establish event/owner/balance alerts, and document withdrawal approvals and emergency pause procedures.
