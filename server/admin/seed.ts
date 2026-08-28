/**
 * Bundled fallback dataset.
 *
 * When Supabase credentials are not configured the API serves this store so
 * the admin panel is fully functional out of the box. Rows are generated
 * deterministically, so the numbers do not jump around between requests.
 * Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to switch every endpoint
 * to real Postgres tables (see `server/admin/supabase/schema.sql`).
 */

export type Row = Record<string, unknown>;

const DAY = 86_400_000;
/** Fixed epoch so the dataset is stable across restarts. */
const NOW = Date.parse("2026-08-28T09:00:00.000Z");

function at(daysAgo: number, hour = 9): number {
  return NOW - daysAgo * DAY + hour * 3_600_000;
}

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length];
}

const WALLETS = [
  "0x7d4f2b9c1a5e8d3f6b0c9a4e7d2f5b8c1a3e6d9f",
  "0x2b8c4f1a7e3d9b5c0f6a2e8d4b1c7f3a9e5d0b6c",
  "0x9f1e5d8c3a7b2f6e0d4c9a5b8f2e7d1c6a3b0f9e",
  "0x4c7a0e3d9b5f1c8a2e6d0b4f7c1a9e3d5b8f2c6a",
  "0x1e6d0b4f7c1a9e3d5b8f2c6a4c7a0e3d9b5f1c8a",
  "0x8f2e7d1c6a3b0f9e9f1e5d8c3a7b2f6e0d4c9a5b",
];

const NAMES = [
  "Amara Okafor", "Luis Ferreira", "Yuki Tanaka", "Sofia Rossi", "Daniel Kim",
  "Fatima Zahra", "Noah Bergström", "Chidi Nwosu", "Elena Petrova", "Omar Haddad",
  "Grace Mensah", "Tomas Novak",
];

function users(): Row[] {
  const tiers = ["VIP 0", "VIP 1", "VIP 2", "VIP 3"];
  const statuses = ["active", "active", "active", "suspended", "active", "pending"];
  return NAMES.map((name, i) => ({
    id: `usr_${(1000 + i * 7).toString(36)}${i}`,
    name,
    email: `${name.split(" ")[0]!.toLowerCase()}.${name.split(" ")[1]!.toLowerCase()}@example.com`,
    address: pick(WALLETS, i),
    status: pick(statuses, i),
    tier: pick(tiers, i),
    kyc_level: i % 4 === 3 ? 0 : (i % 3) + 1,
    equity_usdc: Math.round((12_500 + i * 8_431.77) * 100) / 100,
    volume_30d_usdc: Math.round((98_400 + i * 51_220.4) * 100) / 100,
    open_positions: i % 5,
    maker_fee_bps: 20 - (i % 4) * 2,
    taker_fee_bps: 45 - (i % 4) * 3,
    created_at: at(240 - i * 17, 8),
    updated_at: at(i % 6, 11),
  }));
}

function kyc(): Row[] {
  const states = ["pending", "approved", "rejected", "pending", "in_review", "approved", "pending", "approved"];
  return Array.from({ length: 8 }, (_, i) => ({
    id: `kyc_${2400 + i}`,
    user_id: `usr_${(1000 + i * 7).toString(36)}${i}`,
    full_name: NAMES[i]!,
    country: pick(["NG", "BR", "JP", "IT", "KR", "MA", "SE", "GH"], i),
    document_type: pick(["passport", "national_id", "drivers_license"], i),
    status: states[i]!,
    risk_score: 12 + i * 9,
    submitted_at: at(9 - i, 10),
    reviewed_at: states[i] === "pending" ? null : at(8 - i, 15),
    reviewer: states[i] === "pending" ? null : "compliance@vantide.io",
  }));
}

function treasury(): Row[] {
  return [
    { id: "wal_hot_usdc", label: "Hot wallet (USDC)", chain: "Arbitrum", address: pick(WALLETS, 0), type: "hot", balance_usdc: 4_820_113.42, threshold_usdc: 1_000_000, status: "healthy", updated_at: at(0, 8) },
    { id: "wal_cold_usdc", label: "Cold storage (USDC)", chain: "Arbitrum", address: pick(WALLETS, 1), type: "cold", balance_usdc: 38_410_992.18, threshold_usdc: 0, status: "healthy", updated_at: at(1, 6) },
    { id: "wal_insurance", label: "Insurance fund", chain: "Arbitrum", address: pick(WALLETS, 2), type: "insurance", balance_usdc: 6_204_551.09, threshold_usdc: 2_500_000, status: "healthy", updated_at: at(0, 7) },
    { id: "wal_fee_collector", label: "Fee collector", chain: "Arbitrum", address: pick(WALLETS, 3), type: "hot", balance_usdc: 312_884.66, threshold_usdc: 250_000, status: "warning", updated_at: at(0, 9) },
    { id: "wal_rewards", label: "Rewards treasury", chain: "BNB Chain", address: pick(WALLETS, 4), type: "cold", balance_usdc: 1_450_000, threshold_usdc: 500_000, status: "healthy", updated_at: at(2, 5) },
    { id: "wal_gas_reserve", label: "Gas reserve", chain: "Arbitrum", address: pick(WALLETS, 5), type: "hot", balance_usdc: 42_118.2, threshold_usdc: 60_000, status: "critical", updated_at: at(0, 9) },
  ];
}

function funding(): Row[] {
  const kinds = ["deposit", "withdrawal"];
  const states = ["confirmed", "pending", "confirmed", "rejected", "confirmed", "pending"];
  return Array.from({ length: 10 }, (_, i) => ({
    id: `txn_${90210 + i * 3}`,
    user_id: `usr_${(1000 + (i % 6) * 7).toString(36)}${i % 6}`,
    address: pick(WALLETS, i),
    type: pick(kinds, i),
    asset: "USDC",
    amount_usdc: Math.round((1_250 + i * 3_417.9) * 100) / 100,
    status: pick(states, i),
    confirmations: pick(states, i) === "confirmed" ? 12 : 2,
    tx_hash: `0x${(i + 1).toString(16).padStart(8, "0")}${"ab12cd34".repeat(6)}`.slice(0, 66),
    created_at: at(6 - (i % 6), 12 + (i % 5)),
  }));
}

function referrals(): Row[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: `aff_${500 + i}`,
    name: `${NAMES[i]!} Program`,
    email: `partner${i + 1}@example.com`,
    level: pick(["Bronze", "Silver", "Gold", "Platinum"], i),
    referees: 14 + i * 37,
    commission_rate_bps: 1_000 + i * 250,
    earned_usdc: Math.round((2_140 + i * 9_884.31) * 100) / 100,
    paid_usdc: Math.round((1_800 + i * 8_110.02) * 100) / 100,
    status: i === 5 ? "suspended" : "active",
    created_at: at(300 - i * 21, 9),
  }));
}

function rewards(): Row[] {
  return [
    { id: "cmp_aug_trading", name: "August volume race", type: "competition", budget_usdc: 250_000, distributed_usdc: 148_920.5, participants: 3_412, status: "running", starts_at: at(12, 0), ends_at: at(-6, 0) },
    { id: "cmp_new_listing", name: "New listing rewards — ZAMA", type: "airdrop", budget_usdc: 40_000, distributed_usdc: 40_000, participants: 8_120, status: "completed", starts_at: at(40, 0), ends_at: at(20, 0) },
    { id: "cmp_referral_boost", name: "2x referral commission", type: "boost", budget_usdc: 60_000, distributed_usdc: 22_410.75, participants: 611, status: "running", starts_at: at(5, 0), ends_at: at(-14, 0) },
    { id: "cmp_vip_rebate", name: "VIP maker rebate", type: "rebate", budget_usdc: 120_000, distributed_usdc: 0, participants: 0, status: "scheduled", starts_at: at(-3, 0), ends_at: at(-33, 0) },
    { id: "cmp_testnet_grad", name: "Testnet graduation bonus", type: "bonus", budget_usdc: 15_000, distributed_usdc: 15_000, participants: 1_204, status: "completed", starts_at: at(90, 0), ends_at: at(60, 0) },
    { id: "cmp_paused_launch", name: "Launch week drop", type: "airdrop", budget_usdc: 80_000, distributed_usdc: 4_200, participants: 210, status: "paused", starts_at: at(2, 0), ends_at: at(-12, 0) },
  ];
}

function notifications(): Row[] {
  const severities = ["info", "warning", "critical", "info", "info", "warning", "info", "critical"];
  const titles = [
    "Insurance fund utilisation above 60%",
    "Withdrawal queue backlog cleared",
    "Orderly DEX latency spike detected",
    "Weekly fee settlement completed",
    "New perpetual listing scheduled: XPL",
    "KYC backlog above 48h SLA",
    "Scheduled maintenance window announced",
    "Hot wallet balance below threshold",
  ];
  return titles.map((title, i) => ({
    id: `ntf_${700 + i}`,
    title,
    severity: severities[i]!,
    channel: pick(["email", "in_app", "sms", "banner"], i),
    audience: pick(["all", "vip", "kyc_verified", "affiliates"], i),
    status: i < 3 ? "unread" : pick(["unread", "read", "sent"], i),
    recipients: 120 + i * 840,
    created_at: at(i, 8 + (i % 6)),
  }));
}

function cms(): Row[] {
  return [
    { id: "cms_ann_1", type: "announcement", title: "ZAMA perpetual is live", slug: "zama-perp-live", status: "published", locale: "en", author: "growth@vantide.io", published_at: at(3, 10), updated_at: at(2, 9) },
    { id: "cms_ann_2", type: "announcement", title: "September fee schedule", slug: "september-fees", status: "draft", locale: "en", author: "ops@vantide.io", published_at: null, updated_at: at(1, 14) },
    { id: "cms_pop_1", type: "popup", title: "Refer a friend, earn 2x", slug: "refer-2x", status: "published", locale: "en", author: "growth@vantide.io", published_at: at(6, 11), updated_at: at(6, 11) },
    { id: "cms_page_1", type: "page", title: "Terms of service", slug: "terms", status: "published", locale: "en", author: "legal@vantide.io", published_at: at(120, 9), updated_at: at(18, 16) },
    { id: "cms_page_2", type: "page", title: "Privacy policy", slug: "privacy", status: "published", locale: "en", author: "legal@vantide.io", published_at: at(120, 9), updated_at: at(18, 16) },
    { id: "cms_faq_1", type: "faq", title: "How do withdrawals work?", slug: "withdrawals", status: "published", locale: "en", author: "support@vantide.io", published_at: at(60, 12), updated_at: at(9, 8) },
    { id: "cms_banner_1", type: "banner", title: "Maintenance window banner", slug: "maintenance", status: "scheduled", locale: "en", author: "ops@vantide.io", published_at: at(-2, 2), updated_at: at(0, 7) },
  ];
}

function fees(): Row[] {
  return [
    { id: "fee_vip0", name: "VIP 0", tier: 0, maker_bps: 20, taker_bps: 45, min_volume_usdc: 0, status: "active", updated_at: at(30, 9) },
    { id: "fee_vip1", name: "VIP 1", tier: 1, maker_bps: 18, taker_bps: 42, min_volume_usdc: 1_000_000, status: "active", updated_at: at(30, 9) },
    { id: "fee_vip2", name: "VIP 2", tier: 2, maker_bps: 16, taker_bps: 39, min_volume_usdc: 5_000_000, status: "active", updated_at: at(30, 9) },
    { id: "fee_vip3", name: "VIP 3", tier: 3, maker_bps: 14, taker_bps: 36, min_volume_usdc: 15_000_000, status: "active", updated_at: at(30, 9) },
    { id: "fee_promo_aug", name: "August zero-maker promo", tier: 0, maker_bps: 0, taker_bps: 35, min_volume_usdc: 0, status: "active", updated_at: at(4, 10) },
    { id: "fee_legacy", name: "Legacy 2024 schedule", tier: 0, maker_bps: 25, taker_bps: 50, min_volume_usdc: 0, status: "archived", updated_at: at(200, 9) },
  ];
}

function security(): Row[] {
  const kinds = ["login_success", "login_failed", "api_key_created", "ip_blocked", "2fa_reset", "withdrawal_whitelist_change"];
  return Array.from({ length: 10 }, (_, i) => ({
    id: `sec_${3100 + i}`,
    user_id: `usr_${(1000 + (i % 6) * 7).toString(36)}${i % 6}`,
    event_type: pick(kinds, i),
    ip_address: `102.89.${(i * 7) % 250}.${(i * 13) % 250}`,
    country: pick(["NG", "US", "DE", "BR", "JP"], i),
    user_agent: "Mozilla/5.0 (Vantide Admin)",
    severity: i % 5 === 0 ? "high" : i % 3 === 0 ? "medium" : "low",
    status: i % 4 === 0 ? "flagged" : "ok",
    created_at: at(i % 7, 6 + (i % 12)),
  }));
}

function support(): Row[] {
  const subjects = [
    "Withdrawal stuck in pending",
    "KYC document rejected twice",
    "Position liquidated unexpectedly",
    "API key permissions question",
    "Fee tier not updated",
    "Cannot connect wallet on mobile",
    "Referral commission missing",
    "Account unlock request",
  ];
  const states = ["open", "pending", "resolved", "open", "escalated", "open", "resolved", "pending"];
  return subjects.map((subject, i) => ({
    id: `tkt_${4200 + i}`,
    subject,
    user_id: `usr_${(1000 + (i % 6) * 7).toString(36)}${i % 6}`,
    email: `user${i + 1}@example.com`,
    priority: pick(["low", "medium", "high", "urgent"], i),
    status: states[i]!,
    assignee: i % 3 === 0 ? null : pick(["tunde@vantide.io", "maya@vantide.io", "sam@vantide.io"], i),
    messages: 1 + (i % 6),
    created_at: at(8 - (i % 8), 9 + (i % 4)),
    updated_at: at(i % 3, 13),
  }));
}

function systemFlags(): Row[] {
  return [
    { id: "flag_maintenance", key: "maintenance_mode", label: "Maintenance mode", value: "false", scope: "global", updated_by: "ops@vantide.io", updated_at: at(21, 9) },
    { id: "flag_withdrawals", key: "withdrawals_enabled", label: "Withdrawals enabled", value: "true", scope: "global", updated_by: "ops@vantide.io", updated_at: at(4, 11) },
    { id: "flag_deposits", key: "deposits_enabled", label: "Deposits enabled", value: "true", scope: "global", updated_by: "ops@vantide.io", updated_at: at(4, 11) },
    { id: "flag_new_listings", key: "new_listings_enabled", label: "New listings enabled", value: "true", scope: "global", updated_by: "listing@vantide.io", updated_at: at(12, 8) },
    { id: "flag_signup", key: "signups_enabled", label: "New signups enabled", value: "true", scope: "global", updated_by: "ops@vantide.io", updated_at: at(30, 9) },
    { id: "flag_api", key: "public_api_enabled", label: "Public API enabled", value: "true", scope: "global", updated_by: "platform@vantide.io", updated_at: at(45, 9) },
  ];
}

export function buildSeedData(): Record<string, Row[]> {
  return {
    users: users(),
    kyc: kyc(),
    treasury: treasury(),
    funding: funding(),
    referrals: referrals(),
    rewards: rewards(),
    notifications: notifications(),
    cms: cms(),
    fees: fees(),
    security: security(),
    support: support(),
    system: systemFlags(),
  };
}

export const SEED_NOW = NOW;
