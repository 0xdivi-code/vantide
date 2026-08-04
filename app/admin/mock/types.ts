/** Shared types for the mock backend collections. */

export type UserStatus = "active" | "suspended" | "frozen" | "banned";
export type KycStatus = "verified" | "pending" | "rejected" | "review" | "none";
export type UserTier = "VIP 0" | "VIP 1" | "VIP 2" | "VIP 3" | "VIP 4" | "VIP 5";

export interface MockUser {
  id: string;
  wallet: string;
  email: string;
  country: string;
  tier: UserTier;
  kyc: KycStatus;
  status: UserStatus;
  tradingEnabled: boolean;
  balance: number;
  equity: number;
  pnl30d: number;
  totalVolume: number;
  totalTrades: number;
  referralCount: number;
  lastLoginAt: number;
  createdAt: number;
  ip: string;
}

export type PairStatus = "active" | "halted" | "maintenance" | "disabled";

export interface TradingPair {
  id: string;
  symbol: string; // BASE/QUOTE
  base: string;
  quote: "USDT" | "USDC";
  contractAddress: string;
  chain: string;
  price: number;
  change24h: number;
  volume24h: number;
  openInterest: number;
  status: PairStatus;
  visible: boolean;
  featured: boolean;
  makerFee: number; // %
  takerFee: number; // %
  minOrderSize: number; // USD
  maxLeverage: number;
  maxPositionSize: number; // USD
  tradingHours: string; // "24/7" or "01:00-23:00 UTC"
  createdAt: number;
}

export interface MockTrade {
  id: string;
  user: string;
  wallet: string;
  pair: string;
  side: "long" | "short";
  size: number;
  price: number;
  fee: number;
  pnl: number;
  ts: number;
}

export interface MockOrder {
  id: string;
  user: string;
  wallet: string;
  pair: string;
  side: "buy" | "sell";
  type: "limit" | "market" | "stop";
  size: number;
  price: number;
  status: "filled" | "open" | "cancelled" | "partial";
  ts: number;
}

export interface MockPosition {
  id: string;
  user: string;
  wallet: string;
  pair: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  margin: number;
  marginRatio: number;
  unrealizedPnl: number;
  ts: number;
}

export interface MockLiquidation {
  id: string;
  wallet: string;
  pair: string;
  side: "long" | "short";
  size: number;
  price: number;
  loss: number;
  ts: number;
}

export interface MockFunding {
  id: string;
  pair: string;
  rate: number;
  paid: number;
  ts: number;
}

export type WalletKind =
  | "Hot Wallet"
  | "Cold Wallet"
  | "Treasury Wallet"
  | "Insurance Fund"
  | "Revenue Wallet"
  | "Reserve Wallet";

export interface TreasuryWallet {
  id: string;
  name: WalletKind;
  address: string;
  chain: string;
  balance: number;
  assets: { symbol: string; amount: number; value: number }[];
  updatedAt: number;
}

export type TransferStatus = "pending" | "approved" | "rejected" | "completed";

export interface TreasuryTransfer {
  id: string;
  from: WalletKind;
  to: WalletKind;
  asset: string;
  amount: number;
  status: TransferStatus;
  requestedBy: string;
  ts: number;
  note?: string;
}

export type TxStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "failed";

export interface MockDeposit {
  id: string;
  user: string;
  wallet: string;
  asset: string;
  amount: number;
  chain: string;
  txid: string;
  confirmations: number;
  requiredConfirmations: number;
  status: "pending" | "completed" | "failed";
  ts: number;
}

export interface MockWithdrawal {
  id: string;
  user: string;
  wallet: string;
  asset: string;
  amount: number;
  chain: string;
  destination: string;
  txid?: string;
  confirmations?: number;
  requiredConfirmations: number;
  status: TxStatus;
  ts: number;
}

export interface MockAffiliate {
  id: string;
  user: string;
  wallet: string;
  code: string;
  level: "Standard" | "Bronze" | "Silver" | "Gold" | "Partner";
  referrals: number;
  volume: number;
  earned: number;
  pendingPayout: number;
  status: "active" | "paused";
  createdAt: number;
}

export interface MockCommission {
  id: string;
  affiliate: string;
  fromUser: string;
  pair: string;
  fee: number;
  rebate: number;
  ts: number;
}

export interface RewardCampaign {
  id: string;
  name: string;
  type:
    | "Trading Competition"
    | "Deposit Campaign"
    | "Referral Bonus"
    | "Trading Rebate"
    | "VIP Reward";
  pool: number;
  distributed: number;
  startAt: number;
  endAt: number;
  status: "draft" | "active" | "ended" | "paused";
  rules: string;
}

export interface RewardDistribution {
  id: string;
  campaign: string;
  user: string;
  amount: number;
  ts: number;
}

export interface KycSubmission {
  id: string;
  user: string;
  wallet: string;
  country: string;
  docType: "Passport" | "National ID" | "Driver License";
  status: "pending" | "approved" | "rejected" | "review";
  riskScore: number; // 0-100
  amlFlag: boolean;
  submittedAt: number;
  reviewedBy?: string;
  note?: string;
}

export interface AdminNotification {
  id: string;
  type:
    | "global"
    | "user"
    | "email"
    | "sms"
    | "push"
    | "banner"
    | "maintenance"
    | "trading_alert"
    | "emergency";
  audience: string;
  title: string;
  message: string;
  status: "sent" | "scheduled" | "draft";
  sentAt: number;
  recipients: number;
}

export interface CmsItem {
  id: string;
  kind: "announcement" | "popup" | "news" | "faq" | "page";
  title: string;
  body: string;
  status: "published" | "draft";
  updatedAt: number;
}

export interface LoginRecord {
  id: string;
  user: string;
  ip: string;
  country: string;
  device: string;
  success: boolean;
  ts: number;
}

export interface BlockedIp {
  id: string;
  ip: string;
  reason: string;
  ts: number;
}

export interface SecurityAlert {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  ts: number;
  resolved: boolean;
}

export interface SupportTicket {
  id: string;
  user: string;
  wallet: string;
  subject: string;
  category: "Deposit" | "Withdrawal" | "Trading" | "KYC" | "Account" | "API" | "Other";
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "pending" | "resolved" | "closed";
  assignee: string;
  updatedAt: number;
  createdAt: number;
  messages: { from: "user" | "agent"; text: string; ts: number }[];
}

export interface ActivityEvent {
  id: string;
  kind:
    | "new_user"
    | "new_position"
    | "liquidation"
    | "deposit"
    | "withdrawal"
    | "alert";
  text: string;
  amount?: number;
  ts: number;
}

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: "Super Admin" | "Risk" | "Support" | "Finance" | "Compliance";
}
