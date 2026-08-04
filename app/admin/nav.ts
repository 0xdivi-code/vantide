/** Admin navigation structure shared by the sidebar and the search palette. */

import {
  LayoutDashboard,
  BarChart3,
  Users,
  Coins,
  ShieldAlert,
  Percent,
  Vault,
  ArrowDownUp,
  Handshake,
  Gift,
  Bell,
  FileText,
  UserCheck,
  ShieldCheck,
  Headset,
  Palette,
  Settings,
  Settings2,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  end?: boolean;
  label: string;
  icon: LucideIcon;
  keywords: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard, keywords: "overview home stats volume revenue" },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3, keywords: "charts metrics retention traffic conversions" },
    ],
  },
  {
    label: "Trading",
    items: [
      { to: "/admin/users", label: "Users", icon: Users, keywords: "accounts kyc balances suspend ban freeze traders" },
      { to: "/admin/pairs", label: "Trading Pairs", icon: Coins, keywords: "listings markets symbols lever fees pepe create pair asset" },
      { to: "/admin/risk", label: "Risk Engine", icon: ShieldAlert, keywords: "exposure insurance fund liquidations margin limits" },
      { to: "/admin/fees", label: "Fee Management", icon: Percent, keywords: "maker taker vip rebates coupons discounts promotions" },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/admin/treasury", label: "Treasury", icon: Vault, keywords: "wallets hot cold insurance reserve transfer approve" },
      { to: "/admin/funding", label: "Deposits & Withdrawals", icon: ArrowDownUp, keywords: "deposits withdrawals pending confirmations whitelist limits" },
      { to: "/admin/referrals", label: "Referrals", icon: Handshake, keywords: "affiliates commission payouts partner levels leaderboard" },
    ],
  },
  {
    label: "Growth",
    items: [
      { to: "/admin/rewards", label: "Rewards", icon: Gift, keywords: "campaigns competitions bonuses rebates vip distribution" },
      { to: "/admin/notifications", label: "Notifications", icon: Bell, keywords: "send email sms push banner alert maintenance broadcast" },
      { to: "/admin/cms", label: "CMS", icon: FileText, keywords: "announcements popups news faq pages terms privacy blog content" },
    ],
  },
  {
    label: "Compliance",
    items: [
      { to: "/admin/kyc", label: "KYC", icon: UserCheck, keywords: "verification documents aml identity review approve reject" },
      { to: "/admin/security", label: "Security Center", icon: ShieldCheck, keywords: "2fa logins blocked ips firewall captcha sessions password" },
      { to: "/admin/support", label: "Support Center", icon: Headset, keywords: "tickets chat conversations priority assignee reply" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/appearance", label: "Appearance", icon: Palette, keywords: "logo branding theme colors buttons" },
      { to: "/admin/system", label: "System Settings", icon: Settings2, keywords: "exchange maintenance mode status languages timezone version currency" },
      { to: "/admin/settings", label: "Config Editor", icon: Settings, keywords: "runtime config env export import overrides menus" },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
