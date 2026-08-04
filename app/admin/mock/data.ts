/** Deterministic seed generators for every mock collection. */

import {
  mulberry32,
  int,
  float,
  pick,
  chance,
  daysAgo,
  hoursAgo,
  daysFromNow,
  evmAddress,
  txHash,
  waveSeries,
} from "./rng";
import type {
  MockUser,
  UserStatus,
  KycStatus,
  UserTier,
  TradingPair,
  MockTrade,
  MockOrder,
  MockPosition,
  MockLiquidation,
  MockFunding,
  TreasuryWallet,
  TreasuryTransfer,
  MockDeposit,
  MockWithdrawal,
  MockAffiliate,
  MockCommission,
  RewardCampaign,
  RewardDistribution,
  KycSubmission,
  AdminNotification,
  CmsItem,
  LoginRecord,
  BlockedIp,
  SecurityAlert,
  SupportTicket,
  AdminAccount,
  ActivityEvent,
} from "./types";

export const COUNTRIES = [
  "Nigeria", "United States", "United Kingdom", "Germany", "France",
  "Brazil", "India", "Vietnam", "Turkey", "Indonesia", "Japan",
  "South Korea", "Canada", "Australia", "UAE", "Singapore",
  "Netherlands", "Spain", "Italy", "Argentina", "Kenya", "Ghana",
  "South Africa", "Philippines", "Thailand", "Mexico", "Poland",
] as const;

const FIRST = [
  "ada", "chidi", "musa", "tunde", "ngozi", "emeka", "john", "sara",
  "li", "kenji", "maria", "sofia", "arjun", "mei", "omar", "lucas",
  "ivan", "elena", "pierre", "amina", "yusuf", "fatima", "david",
];
const LAST = [
  "okafor", "adebayo", "eze", "bello", "smith", "tan", "kim", "garcia",
  "kumar", "chen", "martins", "silva", "rossi", "muller", "diallo",
  "nguyen", "yilmaz", "santos", "ali", "brown", "lee", "patel",
];

const TOKENS: { sym: string; name: string; price: number }[] = [
  { sym: "BTC", name: "Bitcoin", price: 97250 },
  { sym: "ETH", name: "Ethereum", price: 3480 },
  { sym: "SOL", name: "Solana", price: 214.5 },
  { sym: "BNB", name: "BNB", price: 652.1 },
  { sym: "XRP", name: "XRP", price: 2.31 },
  { sym: "DOGE", name: "Dogecoin", price: 0.312 },
  { sym: "ADA", name: "Cardano", price: 0.95 },
  { sym: "AVAX", name: "Avalanche", price: 41.2 },
  { sym: "LINK", name: "Chainlink", price: 22.4 },
  { sym: "PEPE", name: "Pepe", price: 0.0000185 },
  { sym: "WIF", name: "dogwifhat", price: 2.14 },
  { sym: "BONK", name: "Bonk", price: 0.0000312 },
  { sym: "ARB", name: "Arbitrum", price: 0.88 },
  { sym: "OP", name: "Optimism", price: 1.94 },
  { sym: "INJ", name: "Injective", price: 24.6 },
  { sym: "TIA", name: "Celestia", price: 6.12 },
  { sym: "SUI", name: "Sui", price: 3.85 },
  { sym: "SEI", name: "Sei", price: 0.52 },
  { sym: "APT", name: "Aptos", price: 9.71 },
  { sym: "NEAR", name: "Near", price: 5.42 },
  { sym: "ATOM", name: "Cosmos", price: 8.33 },
  { sym: "FIL", name: "Filecoin", price: 5.61 },
  { sym: "LTC", name: "Litecoin", price: 102.4 },
  { sym: "UNI", name: "Uniswap", price: 12.85 },
  { sym: "AAVE", name: "Aave", price: 332.5 },
  { sym: "TRX", name: "Tron", price: 0.165 },
  { sym: "DOT", name: "Polkadot", price: 7.92 },
  { sym: "MATIC", name: "Polygon", price: 0.62 },
  { sym: "SHIB", name: "Shiba Inu", price: 0.0000225 },
  { sym: "FET", name: "Fetch.ai", price: 1.52 },
  { sym: "RNDR", name: "Render", price: 7.85 },
  { sym: "TAO", name: "Bittensor", price: 512.3 },
  { sym: "JUP", name: "Jupiter", price: 0.94 },
  { sym: "PYTH", name: "Pyth", price: 0.38 },
  { sym: "HYPE", name: "Hyperliquid", price: 24.1 },
  { sym: "ENA", name: "Ethena", price: 0.92 },
  { sym: "ONDO", name: "Ondo", price: 1.28 },
  { sym: "WLD", name: "Worldcoin", price: 2.62 },
  { sym: "STX", name: "Stacks", price: 1.83 },
  { sym: "IMX", name: "Immutable", price: 1.31 },
];

const CHAINS = ["Arbitrum", "Base", "Ethereum", "BNB Chain", "Solana", "Optimism"];
const ASSETS = ["USDC", "USDT", "ETH", "BTC", "SOL"];
const DEVICES = [
  "Chrome / macOS", "Safari / iOS", "Chrome / Android", "Firefox / Windows",
  "Chrome / Windows", "Edge / Windows", "Safari / macOS", "Mobile App / iOS",
  "Mobile App / Android",
];
const ADMIN_NAMES = ["Admin", "risk.bot", "support.1", "finance.2", "compliance.1"];

export const PAIR_TOTAL = 214;
export const USER_TOTAL = 102_438;
export const TRADE_TOTAL = 5_023_412;

/* ------------------------------------------------------------------ */
/* Users                                                              */
/* ------------------------------------------------------------------ */

export function seedUsers(): MockUser[] {
  const r = mulberry32(42001);
  const users: MockUser[] = [];
  for (let i = 0; i < 640; i++) {
    const fn = pick(r, FIRST);
    const ln = pick(r, LAST);
    const created = daysAgo(int(r, 1, 720));
    const pnl = float(r, -42000, 68000, 0);
    const bal = float(r, 0, 240_000, 0);
    const kyc: KycStatus =
      r() < 0.62 ? "verified" : pick(r, ["pending", "rejected", "review", "none"] as const);
    const status: UserStatus =
      r() < 0.9 ? "active" : pick(r, ["suspended", "frozen", "banned"] as const);
    users.push({
      id: `usr_${String(100001 + i)}`,
      wallet: evmAddress(r),
      email: `${fn}.${ln}${int(r, 1, 99)}@${pick(r, ["gmail.com", "proton.me", "outlook.com", "yahoo.com"])}`,
      country: pick(r, COUNTRIES),
      tier: pick(r, ["VIP 0", "VIP 0", "VIP 0", "VIP 1", "VIP 1", "VIP 2", "VIP 3", "VIP 4", "VIP 5"] as UserTier[]),
      kyc,
      status,
      tradingEnabled: status === "active" ? chance(r, 0.97) : false,
      balance: bal,
      equity: Math.max(0, bal + float(r, -bal * 0.3, bal * 0.5, 0)),
      pnl30d: pnl,
      totalVolume: float(r, 1_000, 18_000_000, 0),
      totalTrades: int(r, 2, 9800),
      referralCount: int(r, 0, 32),
      lastLoginAt: hoursAgo(int(r, 0, 700)),
      createdAt: created,
      ip: `${int(r, 11, 223)}.${int(r, 0, 255)}.${int(r, 0, 255)}.${int(r, 1, 254)}`,
    });
  }
  return users;
}

/* ------------------------------------------------------------------ */
/* Trading pairs                                                      */
/* ------------------------------------------------------------------ */

export function seedPairs(): TradingPair[] {
  const r = mulberry32(77007);
  const pairs: TradingPair[] = [];
  for (let i = 0; i < 128; i++) {
    const t = TOKENS[i % TOKENS.length];
    const variant = i >= TOKENS.length ? `${t.sym}${Math.floor(i / TOKENS.length)}` : t.sym;
    const quote = chance(r, 0.72) ? "USDT" : "USDC";
    const status: TradingPair["status"] =
      r() < 0.82 ? "active" : pick(r, ["halted", "maintenance", "disabled"] as const);
    pairs.push({
      id: `pair_${String(1001 + i)}`,
      symbol: `${variant}/${quote}`,
      base: variant,
      quote,
      contractAddress: evmAddress(r),
      chain: pick(r, CHAINS),
      price: t.price * float(r, 0.94, 1.06, 6),
      change24h: float(r, -14, 18, 2),
      volume24h: float(r, 40_000, 980_000_000, 0),
      openInterest: float(r, 120_000, 1_900_000_000, 0),
      status,
      visible: status !== "disabled" ? chance(r, 0.93) : false,
      featured: chance(r, 0.14),
      makerFee: pick(r, [0.01, 0.015, 0.02, 0.025, 0.03]),
      takerFee: pick(r, [0.04, 0.05, 0.055, 0.06, 0.075]),
      minOrderSize: pick(r, [5, 10, 20, 50, 100]),
      maxLeverage: pick(r, [5, 10, 20, 25, 50, 75, 100]),
      maxPositionSize: pick(r, [100_000, 500_000, 1_000_000, 5_000_000, 20_000_000]),
      tradingHours: chance(r, 0.85) ? "24/7" : "01:00-23:00 UTC",
      createdAt: daysAgo(int(r, 5, 640)),
    });
  }
  return pairs;
}

/* ------------------------------------------------------------------ */
/* Trades / Orders / Positions / Liquidations / Funding               */
/* ------------------------------------------------------------------ */

function pairPool(): string[] {
  return ["BTC/USDT", "ETH/USDT", "SOL/USDT", "PEPE/USDT", "DOGE/USDT",
    "ARB/USDT", "XRP/USDT", "LINK/USDT", "WIF/USDT", "SUI/USDT",
    "BNB/USDT", "AVAX/USDT", "INJ/USDT", "HYPE/USDT", "TAO/USDT",
    "JUP/USDT", "ONDO/USDT", "NEAR/USDT", "AAVE/USDT", "FET/USDT"];
}

export function seedTrades(): MockTrade[] {
  const r = mulberry32(88008);
  const syms = pairPool();
  const out: MockTrade[] = [];
  for (let i = 0; i < 1500; i++) {
    const size = float(r, 40, 1_200_000, 0);
    out.push({
      id: `trd_${String(9_000_000 - i * 3)}`,
      user: `usr_${100001 + int(r, 0, 639)}`,
      wallet: evmAddress(r),
      pair: pick(r, syms),
      side: chance(r, 0.52) ? "long" : "short",
      size,
      price: float(r, 0.00002, 98000, 4),
      fee: Math.max(0.01, size * 0.00055),
      pnl: float(r, -size * 0.12, size * 0.16, 0),
      ts: hoursAgo(int(r, 0, 24 * 45)),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export function seedOrders(): MockOrder[] {
  const r = mulberry32(99009);
  const syms = pairPool();
  const out: MockOrder[] = [];
  for (let i = 0; i < 320; i++) {
    out.push({
      id: `ord_${String(51_000_000 - i * 7)}`,
      user: `usr_${100001 + int(r, 0, 639)}`,
      wallet: evmAddress(r),
      pair: pick(r, syms),
      side: chance(r, 0.5) ? "buy" : "sell",
      type: pick(r, ["limit", "market", "limit", "stop"] as const),
      size: float(r, 25, 800_000, 0),
      price: float(r, 0.00002, 98000, 4),
      status: pick(r, ["filled", "filled", "filled", "open", "cancelled", "partial"] as const),
      ts: hoursAgo(int(r, 0, 30)),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export function seedPositions(): MockPosition[] {
  const r = mulberry32(11011);
  const syms = pairPool();
  const out: MockPosition[] = [];
  for (let i = 0; i < 240; i++) {
    const entry = float(r, 0.00002, 98000, 4);
    const mark = entry * float(r, 0.9, 1.12, 6);
    const lev = pick(r, [2, 3, 5, 10, 20, 25, 50]);
    const size = float(r, 500, 2_400_000, 0);
    const side = chance(r, 0.54) ? "long" : "short";
    const dir = side === "long" ? 1 : -1;
    out.push({
      id: `pos_${String(700001 + i)}`,
      user: `usr_${100001 + int(r, 0, 639)}`,
      wallet: evmAddress(r),
      pair: pick(r, syms),
      side,
      size,
      entryPrice: entry,
      markPrice: mark,
      leverage: lev,
      margin: Math.round(size / lev),
      marginRatio: float(r, 0.4, 24, 2),
      unrealizedPnl: Math.round((mark - entry) * size * dir * 0.001),
      ts: hoursAgo(int(r, 0, 24 * 20)),
    });
  }
  return out.sort((a, b) => b.size - a.size);
}

export function seedLiquidations(): MockLiquidation[] {
  const r = mulberry32(12012);
  const syms = pairPool();
  const out: MockLiquidation[] = [];
  for (let i = 0; i < 140; i++) {
    const size = float(r, 120, 980_000, 0);
    out.push({
      id: `liq_${String(300001 + i)}`,
      wallet: evmAddress(r),
      pair: pick(r, syms),
      side: chance(r, 0.5) ? "long" : "short",
      size,
      price: float(r, 0.00002, 98000, 4),
      loss: Math.round(size * float(r, 0.02, 0.11, 4)),
      ts: hoursAgo(int(r, 0, 48)),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export function seedFunding(): MockFunding[] {
  const r = mulberry32(13013);
  const syms = pairPool();
  const out: MockFunding[] = [];
  for (let i = 0; i < 220; i++) {
    out.push({
      id: `fnd_${String(90001 + i)}`,
      pair: pick(r, syms),
      rate: float(r, -0.05, 0.08, 4),
      paid: float(r, 120, 240_000, 0),
      ts: hoursAgo(int(r, 0, 24 * 14)),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

/* ------------------------------------------------------------------ */
/* Treasury / Deposits / Withdrawals                                  */
/* ------------------------------------------------------------------ */

const WALLET_DEFS: { name: TreasuryWallet["name"]; bal: number; chain: string }[] = [
  { name: "Hot Wallet", bal: 18_400_000, chain: "Arbitrum" },
  { name: "Cold Wallet", bal: 142_000_000, chain: "Ethereum" },
  { name: "Treasury Wallet", bal: 64_700_000, chain: "Ethereum" },
  { name: "Insurance Fund", bal: 21_300_000, chain: "Arbitrum" },
  { name: "Revenue Wallet", bal: 9_850_000, chain: "Base" },
  { name: "Reserve Wallet", bal: 47_200_000, chain: "BNB Chain" },
];

export function seedWallets(): TreasuryWallet[] {
  const r = mulberry32(14014);
  return WALLET_DEFS.map((w) => {
    const usdc = Math.round(w.bal * float(r, 0.6, 0.8, 3));
    const usdt = Math.round((w.bal - usdc) * float(r, 0.4, 0.75, 3));
    const rest = w.bal - usdc - usdt;
    return {
      id: `wal_${w.name.replace(/\s+/g, "_").toLowerCase()}`,
      name: w.name,
      address: evmAddress(r),
      chain: w.chain,
      balance: w.bal,
      assets: [
        { symbol: "USDC", amount: usdc, value: usdc },
        { symbol: "USDT", amount: usdt, value: usdt },
        { symbol: "ETH", amount: float(r, 200, 9000, 1), value: Math.round(rest * 0.7) },
        { symbol: "BTC", amount: float(r, 2, 140, 2), value: Math.round(rest * 0.3) },
      ],
      updatedAt: hoursAgo(int(r, 1, 40)),
    };
  });
}

export function seedTransfers(): TreasuryTransfer[] {
  const r = mulberry32(15015);
  const names = WALLET_DEFS.map((w) => w.name);
  const out: TreasuryTransfer[] = [];
  for (let i = 0; i < 42; i++) {
    const from = pick(r, names);
    const to = pick(r, names.filter((n) => n !== from));
    out.push({
      id: `trf_${String(50001 + i)}`,
      from,
      to,
      asset: pick(r, ASSETS),
      amount: float(r, 10_000, 4_000_000, 0),
      status: pick(r, ["pending", "pending", "approved", "completed", "completed", "completed", "rejected"] as const),
      requestedBy: pick(r, ADMIN_NAMES),
      ts: hoursAgo(int(r, 0, 24 * 21)),
      note: chance(r, 0.4) ? pick(r, ["Rebalancing", "Insurance top-up", "Weekly revenue sweep", "Liquidity injection"]) : undefined,
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export function seedDeposits(): MockDeposit[] {
  const r = mulberry32(16016);
  const out: MockDeposit[] = [];
  for (let i = 0; i < 190; i++) {
    const req = pick(r, [6, 12, 12, 20]);
    const status = pick(r, ["pending", "pending", "completed", "completed", "completed", "completed", "failed"] as const);
    out.push({
      id: `dep_${String(800001 + i)}`,
      user: `usr_${100001 + int(r, 0, 639)}`,
      wallet: evmAddress(r),
      asset: pick(r, ASSETS),
      amount: float(r, 20, 480_000, 0),
      chain: pick(r, CHAINS),
      txid: txHash(r),
      confirmations: status === "completed" ? req : status === "failed" ? 0 : int(r, 0, req - 1),
      requiredConfirmations: req,
      status,
      ts: hoursAgo(int(r, 0, 24 * 12)),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export function seedWithdrawals(): MockWithdrawal[] {
  const r = mulberry32(17017);
  const out: MockWithdrawal[] = [];
  for (let i = 0; i < 170; i++) {
    const status = pick(r, ["pending", "pending", "approved", "completed", "completed", "completed", "rejected"] as const);
    const req = 12;
    out.push({
      id: `wdr_${String(700001 + i)}`,
      user: `usr_${100001 + int(r, 0, 639)}`,
      wallet: evmAddress(r),
      asset: pick(r, ASSETS),
      amount: float(r, 50, 620_000, 0),
      chain: pick(r, CHAINS),
      destination: evmAddress(r),
      txid: status === "completed" ? txHash(r) : undefined,
      confirmations: status === "completed" ? req : undefined,
      requiredConfirmations: req,
      status,
      ts: hoursAgo(int(r, 0, 24 * 12)),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

/* ------------------------------------------------------------------ */
/* Referrals / Rewards                                                */
/* ------------------------------------------------------------------ */

export function seedAffiliates(): MockAffiliate[] {
  const r = mulberry32(18018);
  const out: MockAffiliate[] = [];
  for (let i = 0; i < 86; i++) {
    const refs = int(r, 1, 480);
    out.push({
      id: `aff_${String(40001 + i)}`,
      user: `usr_${100001 + int(r, 0, 639)}`,
      wallet: evmAddress(r),
      code: `${pick(r, FIRST).toUpperCase()}${int(r, 100, 999)}`,
      level: pick(r, ["Standard", "Standard", "Bronze", "Silver", "Gold", "Partner"] as const),
      referrals: refs,
      volume: float(r, 5_000, 40_000_000, 0),
      earned: float(r, 40, 96_000, 0),
      pendingPayout: float(r, 0, 4_800, 2),
      status: chance(r, 0.88) ? "active" : "paused",
      createdAt: daysAgo(int(r, 10, 700)),
    });
  }
  return out;
}

export function seedCommissions(): MockCommission[] {
  const r = mulberry32(19019);
  const syms = pairPool();
  const out: MockCommission[] = [];
  for (let i = 0; i < 240; i++) {
    const fee = float(r, 0.4, 420, 2);
    out.push({
      id: `com_${String(60001 + i)}`,
      affiliate: pick(r, FIRST).toUpperCase() + int(r, 100, 999),
      fromUser: `usr_${100001 + int(r, 0, 639)}`,
      pair: pick(r, syms),
      fee,
      rebate: Math.round(fee * float(r, 0.1, 0.45, 2) * 100) / 100,
      ts: hoursAgo(int(r, 0, 24 * 20)),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

const CAMPAIGNS: [string, RewardCampaign["type"]][] = [
  ["Summer Trading Championship", "Trading Competition"],
  ["First Deposit Boost", "Deposit Campaign"],
  ["Invite & Earn Sprint", "Referral Bonus"],
  ["VIP September Rebates", "Trading Rebate"],
  ["Whale Appreciation Week", "VIP Reward"],
  ["New Listings Blitz", "Trading Competition"],
];

export function seedCampaigns(): RewardCampaign[] {
  const r = mulberry32(20020);
  const out: RewardCampaign[] = [];
  for (let i = 0; i < 14; i++) {
    const [name, type] = CAMPAIGNS[i % CAMPAIGNS.length];
    const start = daysAgo(int(r, -10, 60));
    out.push({
      id: `cmp_${String(30001 + i)}`,
      name: i >= CAMPAIGNS.length ? `${name} #${Math.floor(i / CAMPAIGNS.length) + 1}` : name,
      type,
      pool: float(r, 5_000, 250_000, 0),
      distributed: float(r, 0, 180_000, 0),
      startAt: start,
      endAt: start + int(r, 7, 45) * 86_400_000,
      status: pick(r, ["active", "active", "ended", "paused", "draft"] as const),
      rules: "Ranked by trading volume. Min $10K volume to qualify. Rewards paid in USDC within 72h after campaign ends.",
    });
  }
  return out;
}

export function seedDistributions(): RewardDistribution[] {
  const r = mulberry32(21021);
  const names = CAMPAIGNS.map((c) => c[0]);
  const out: RewardDistribution[] = [];
  for (let i = 0; i < 160; i++) {
    out.push({
      id: `dst_${String(20001 + i)}`,
      campaign: pick(r, names),
      user: `usr_${100001 + int(r, 0, 639)}`,
      amount: float(r, 10, 4_200, 2),
      ts: hoursAgo(int(r, 0, 24 * 30)),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

/* ------------------------------------------------------------------ */
/* KYC                                                                */
/* ------------------------------------------------------------------ */

export function seedKyc(): KycSubmission[] {
  const r = mulberry32(22022);
  const out: KycSubmission[] = [];
  for (let i = 0; i < 128; i++) {
    const status = pick(r, ["pending", "pending", "pending", "approved", "approved", "rejected", "review"] as const);
    out.push({
      id: `kyc_${String(10001 + i)}`,
      user: `usr_${100001 + int(r, 0, 639)}`,
      wallet: evmAddress(r),
      country: pick(r, COUNTRIES),
      docType: pick(r, ["Passport", "National ID", "Driver License"] as const),
      status,
      riskScore: int(r, 1, 96),
      amlFlag: chance(r, 0.09),
      submittedAt: hoursAgo(int(r, 0, 24 * 25)),
      reviewedBy: status === "pending" ? undefined : pick(r, ADMIN_NAMES),
      note: status === "rejected" ? pick(r, ["Blurry document", "Expired document", "Name mismatch", "Sanctions list hit"]) : undefined,
    });
  }
  return out.sort((a, b) => b.submittedAt - a.submittedAt);
}

/* ------------------------------------------------------------------ */
/* Notifications / CMS                                                */
/* ------------------------------------------------------------------ */

export function seedNotifications(): AdminNotification[] {
  const r = mulberry32(23023);
  const samples: [AdminNotification["type"], string, string][] = [
    ["banner", "Scheduled maintenance Aug 10", "Trading will be paused 02:00-03:30 UTC for system upgrade."],
    ["global", "PEPE/USDT now listed", "Trade PEPE perpetuals with up to 25x leverage."],
    ["email", "August fee schedule update", "Maker fees reduced to 0.015% for VIP 3+ tiers."],
    ["push", "Volatility alert: BTC", "BTC funding spiked to 0.08%. Exercise caution."],
    ["maintenance", "Matching engine upgrade", "Expect 20 minutes of degraded performance."],
    ["trading_alert", "ETH margin update", "Initial margin for ETH raised to 5%."],
  ];
  const out: AdminNotification[] = [];
  for (let i = 0; i < 36; i++) {
    const [type, title, message] = samples[i % samples.length];
    out.push({
      id: `ntf_${String(9001 + i)}`,
      type,
      audience: pick(r, ["All users", "VIP users", "Nigeria", "Active traders", "KYC pending"]),
      title: i >= samples.length ? `${title} (${Math.floor(i / samples.length) + 1})` : title,
      message,
      status: pick(r, ["sent", "sent", "sent", "scheduled", "draft"] as const),
      sentAt: hoursAgo(int(r, 0, 24 * 30)),
      recipients: int(r, 40, 98000),
    });
  }
  return out.sort((a, b) => b.sentAt - a.sentAt);
}

const CMS_PAGES: [string, string][] = [
  ["Terms of Service", "These terms govern the use of the exchange..."],
  ["Privacy Policy", "We collect wallet addresses, trading activity..."],
  ["Risk Disclaimer", "Perpetual futures trading carries substantial risk..."],
  ["Help Center: Getting Started", "Connect your wallet, deposit USDC, and place..."],
];

export function seedCms(): CmsItem[] {
  const r = mulberry32(24024);
  const out: CmsItem[] = [];
  for (let i = 0; i < 26; i++) {
    if (i < 7) {
      out.push({ id: `cms_${100 + i}`, kind: "announcement", title: pick(r, ["New listing: HYPE", "System upgrade complete", "Fee promo extended", "New VIP tiers live", "Insurance fund at ATH", "Mobile app v2.4", "August trading report"]), body: "We're excited to share this update with our trading community. Read on for details about what changed and how it affects you.", status: chance(r, 0.8) ? "published" : "draft", updatedAt: hoursAgo(int(r, 0, 24 * 20)) });
    } else if (i < 10) {
      out.push({ id: `cms_${100 + i}`, kind: "popup", title: pick(r, ["Welcome bonus popup", "Maintenance notice popup", "Referral promo popup"]), body: "This popup is shown to users on login until dismissed.", status: chance(r, 0.6) ? "published" : "draft", updatedAt: hoursAgo(int(r, 0, 24 * 20)) });
    } else if (i < 14) {
      out.push({ id: `cms_${100 + i}`, kind: "news", title: pick(r, ["Exchange volume hits new high", "Partnership announced", "Quarterly transparency report", "New chains supported"]), body: "In this post we cover the latest exchange news and metrics.", status: chance(r, 0.75) ? "published" : "draft", updatedAt: hoursAgo(int(r, 0, 24 * 40)) });
    } else if (i < 22) {
      out.push({ id: `cms_${100 + i}`, kind: "faq", title: pick(r, ["How do I deposit?", "What leverage is available?", "How are liquidations triggered?", "How do referrals work?", "Which chains are supported?", "How long do withdrawals take?", "What is the insurance fund?", "How do I enable 2FA?"]), body: "Step-by-step answer with screenshots and links to related articles.", status: "published", updatedAt: hoursAgo(int(r, 0, 24 * 60)) });
    } else {
      const [t, b] = CMS_PAGES[i - 22];
      out.push({ id: `cms_${100 + i}`, kind: "page", title: t, body: b, status: "published", updatedAt: hoursAgo(int(r, 0, 24 * 90)) });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Security                                                           */
/* ------------------------------------------------------------------ */

export function seedLogins(): LoginRecord[] {
  const r = mulberry32(25025);
  const out: LoginRecord[] = [];
  for (let i = 0; i < 300; i++) {
    out.push({
      id: `lgn_${String(80001 + i)}`,
      user: `usr_${100001 + int(r, 0, 639)}`,
      ip: `${int(r, 11, 223)}.${int(r, 0, 255)}.${int(r, 0, 255)}.${int(r, 1, 254)}`,
      country: pick(r, COUNTRIES),
      device: pick(r, DEVICES),
      success: chance(r, 0.86),
      ts: hoursAgo(int(r, 0, 24 * 7)),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export function seedBlockedIps(): BlockedIp[] {
  const r = mulberry32(26026);
  const out: BlockedIp[] = [];
  for (let i = 0; i < 32; i++) {
    out.push({
      id: `bip_${String(7001 + i)}`,
      ip: `${int(r, 11, 223)}.${int(r, 0, 255)}.${int(r, 0, 255)}.${int(r, 1, 254)}`,
      reason: pick(r, ["Brute-force attempts", "Credential stuffing", "Scraping detected", "TOR exit node", "Rate-limit abuse", "Sanctioned region"]),
      ts: hoursAgo(int(r, 0, 24 * 30)),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export function seedSecurityAlerts(): SecurityAlert[] {
  const r = mulberry32(27027);
  const samples: [SecurityAlert["severity"], string, string][] = [
    ["critical", "Unusual treasury outflow", "3 withdrawals above $2M within 10 minutes from Hot Wallet."],
    ["high", "Brute-force wave detected", "4,120 failed logins from 86 unique IPs in the last hour."],
    ["medium", "New admin device", "finance.2 signed in from an unrecognized device (Lagos, NG)."],
    ["low", "Rate-limit threshold reached", "Public API hit 92% of its per-minute budget."],
    ["high", "Withdrawal whitelist bypass attempt", "usr_118822 attempted withdrawal to non-whitelisted address."],
  ];
  const out: SecurityAlert[] = [];
  for (let i = 0; i < 18; i++) {
    const [sev, title, detail] = samples[i % samples.length];
    out.push({
      id: `sal_${String(6001 + i)}`,
      severity: sev,
      title,
      detail,
      ts: hoursAgo(int(r, 0, 24 * 10)),
      resolved: chance(r, 0.55),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

/* ------------------------------------------------------------------ */
/* Support                                                            */
/* ------------------------------------------------------------------ */

export function seedTickets(): SupportTicket[] {
  const r = mulberry32(28028);
  const subjects: [string, SupportTicket["category"]][] = [
    ["Deposit not credited after 20 confirmations", "Deposit"],
    ["Withdrawal stuck in pending for 6 hours", "Withdrawal"],
    ["Position closed without my action", "Trading"],
    ["KYC rejected but my documents are valid", "KYC"],
    ["Can't log in — 2FA code not accepted", "Account"],
    ["API key stopped working", "API"],
    ["Referral commission missing", "Other"],
  ];
  const out: SupportTicket[] = [];
  for (let i = 0; i < 92; i++) {
    const [subject, category] = subjects[i % subjects.length];
    const created = hoursAgo(int(r, 0, 24 * 14));
    const status = pick(r, ["open", "open", "pending", "resolved", "closed"] as const);
    out.push({
      id: `tkt_${String(90001 + i)}`,
      user: `usr_${100001 + int(r, 0, 639)}`,
      wallet: evmAddress(r),
      subject,
      category,
      priority: pick(r, ["low", "normal", "normal", "high", "urgent"] as const),
      status,
      assignee: pick(r, ["unassigned", "support.1", "support.2", "support.3"]),
      updatedAt: created + int(r, 0, 3_600_000 * 20),
      createdAt: created,
      messages: [
        { from: "user", text: subject + ". Please help, this is urgent.", ts: created },
        ...(status !== "open"
          ? [{ from: "agent" as const, text: "Thanks for reaching out. I'm looking into this right now and will update you within the hour.", ts: created + 1_800_000 }]
          : []),
        ...(status === "resolved" || status === "closed"
          ? [{ from: "user" as const, text: "Resolved, thank you!", ts: created + 7_200_000 }]
          : []),
      ],
    });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/* ------------------------------------------------------------------ */
/* Admins                                                             */
/* ------------------------------------------------------------------ */

export function seedAdmins(): AdminAccount[] {
  return [
    { id: "adm_1", name: "Root Admin", email: "root@vantide.io", role: "Super Admin" },
    { id: "adm_2", name: "Risk Bot", email: "risk@vantide.io", role: "Risk" },
    { id: "adm_3", name: "Ada Lovelace", email: "ada.support@vantide.io", role: "Support" },
    { id: "adm_4", name: "Chidi Finance", email: "chidi.finance@vantide.io", role: "Finance" },
    { id: "adm_5", name: "Musa Compliance", email: "musa.kyc@vantide.io", role: "Compliance" },
  ];
}

/* ------------------------------------------------------------------ */
/* Live activity (session-only)                                       */
/* ------------------------------------------------------------------ */

const ACT_R = mulberry32(29029);

export function nextActivity(i: number): ActivityEvent {
  const r = ACT_R;
  const syms = pairPool();
  const kinds: ActivityEvent["kind"][] = ["new_user", "new_position", "deposit", "withdrawal", "liquidation", "alert"];
  const kind = kinds[i % kinds.length];
  const w = evmAddress(r);
  const short = `${w.slice(0, 6)}…${w.slice(-4)}`;
  switch (kind) {
    case "new_user":
      return { id: `live_${Date.now()}_${i}`, kind, text: `New user registered · ${short} · ${pick(r, COUNTRIES)}`, ts: Date.now() };
    case "new_position":
      return { id: `live_${Date.now()}_${i}`, kind, text: `${pick(r, ["Long", "Short"])} opened on ${pick(r, syms)} · ${short}`, amount: float(r, 1000, 900000, 0), ts: Date.now() };
    case "deposit":
      return { id: `live_${Date.now()}_${i}`, kind, text: `Deposit confirmed · ${short}`, amount: float(r, 200, 250000, 0), ts: Date.now() };
    case "withdrawal":
      return { id: `live_${Date.now()}_${i}`, kind, text: `Withdrawal requested · ${short}`, amount: float(r, 200, 180000, 0), ts: Date.now() };
    case "liquidation":
      return { id: `live_${Date.now()}_${i}`, kind, text: `Liquidation on ${pick(r, syms)} · ${pick(r, ["long", "short"])}`, amount: float(r, 500, 420000, 0), ts: Date.now() };
    default:
      return { id: `live_${Date.now()}_${i}`, kind, text: pick(r, ["Funding rate above threshold on BTC/USDT", "API latency spike resolved", "Oracle price deviation on PEPE/USDT"]), ts: Date.now() };
  }
}

/* ------------------------------------------------------------------ */
/* Analytics series                                                   */
/* ------------------------------------------------------------------ */

export interface AnalyticsSeries {
  labels: string[];
  volume: number[];
  revenue: number[];
  users: number[];
  openInterest: number[];
  liquidations: number[];
  fees: number[];
  funding: number[];
  trades: number[];
  leverage: number[];
  retention: number[][];
}

export function buildAnalytics(days: number): AnalyticsSeries {
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    labels.push(
      new Date(daysFromNow(-i)).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    );
  }
  // 6x6 weekly retention cohort matrix (percentages)
  const rr = mulberry32(31031);
  const retention: number[][] = [];
  for (let c = 0; c < 6; c++) {
    const row: number[] = [];
    let v = 100;
    for (let w = 0; w < 6 - c; w++) {
      row.push(Math.round(v));
      v *= float(rr, 0.55, 0.78, 3);
    }
    retention.push(row);
  }
  const vol = waveSeries(101, days, 380_000_000, 90_000_000, 1_200_000);
  return {
    labels,
    volume: vol,
    revenue: vol.map((v) => Math.round(v * 0.00052)),
    users: waveSeries(102, days, 4200, 1400, 40),
    openInterest: waveSeries(103, days, 1_450_000_000, 180_000_000, 4_000_000),
    liquidations: waveSeries(104, days, 2_400_000, 1_700_000, 0),
    fees: vol.map((v) => Math.round(v * 0.00048)),
    funding: waveSeries(105, days, 96_000, 40_000, 0),
    trades: waveSeries(106, days, 168_000, 52_000, 900),
    leverage: waveSeries(107, days, 14, 3, 0),
    retention,
  };
}
