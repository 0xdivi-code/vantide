import { useMemo, useState } from "react";
import {
  ShieldAlert, Scale, Landmark, AlertTriangle, Gauge, Settings2,
} from "lucide-react";
import { db } from "@/admin/mock/db";
import { bumpApiVersion, useMockApiVersion } from "@/admin/mock/api";
import { fmtUsd, timeAgo, evmAddress } from "@/admin/mock/rng";
import {
  PageHeader, Badge, AdminButton, Card, StatCard, Field, TextInput, Toggle, Select,
} from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { DonutChart, RankedBars } from "@/admin/components/Charts";
import { useToast, useMockLoading, Skeleton } from "@/admin/components/feedback";

interface RiskSettings {
  insuranceFundAddress: string;
  autoLiqEnabled: boolean;
  partialLiqEnabled: boolean;
  liqFeePercent: string;
  marginCallThreshold: string;
  maxAccountLeverage: string;
  maxPositionPerUser: string;
  maxPositionPerPair: string;
  fundingClamp: string;
  priceBandPercent: string;
}

const RISK_KEY = "vantide-risk-settings";

function loadRiskSettings(): RiskSettings {
  const defaults: RiskSettings = {
    insuranceFundAddress: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    autoLiqEnabled: true,
    partialLiqEnabled: true,
    liqFeePercent: "1.0",
    marginCallThreshold: "3.0",
    maxAccountLeverage: "50",
    maxPositionPerUser: "5000000",
    maxPositionPerPair: "20000000",
    fundingClamp: "0.75",
    priceBandPercent: "5",
  };
  try {
    const raw = localStorage.getItem(RISK_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaults;
}

export default function AdminRisk() {
  useMockApiVersion();
  const toast = useToast();
  const loading = useMockLoading(420);
  const [settings, setSettings] = useState<RiskSettings>(loadRiskSettings);

  const positions = useMemo(() => db.positions.all(), []);
  const largest = positions.slice(0, 12);

  const exposure = useMemo(() => {
    const long = positions.filter((p) => p.side === "long");
    const short = positions.filter((p) => p.side === "short");
    const longUsd = long.reduce((s, p) => s + p.size, 0);
    const shortUsd = short.reduce((s, p) => s + p.size, 0);
    const net = longUsd - shortUsd;
    const insurance = db.wallets.all().find((w) => w.name === "Insurance Fund")?.balance ?? 0;
    return { longUsd, shortUsd, net, insurance };
  }, [positions]);

  const byPair = useMemo(() => {
    const m = new Map<string, number>();
    positions.forEach((p) => m.set(p.pair, (m.get(p.pair) || 0) + p.size));
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [positions]);

  const set = (p: Partial<RiskSettings>) => setSettings((s) => ({ ...s, ...p }));

  const saveSettings = () => {
    try {
      localStorage.setItem(RISK_KEY, JSON.stringify(settings));
      toast.success("Risk engine settings saved.");
      bumpApiVersion();
    } catch {
      toast.error("Could not persist settings.");
    }
  };

  const randomizeFund = () => {
    set({ insuranceFundAddress: evmAddress(Math.random) });
  };

  const posCols: Column<(typeof largest)[number]>[] = [
    { key: "wallet", label: "Account", render: (p) => <span className="font-mono text-xs text-white/60">{p.wallet.slice(0, 8)}…{p.wallet.slice(-4)}</span> },
    { key: "pair", label: "Pair", sortValue: (p) => p.pair, render: (p) => <span className="font-medium text-white">{p.pair}</span> },
    { key: "side", label: "Side", render: (p) => <Badge tone={p.side === "long" ? "success" : "danger"}>{p.side}</Badge> },
    { key: "size", label: "Size", align: "right", sortValue: (p) => p.size, render: (p) => fmtUsd(p.size), csvValue: (p) => String(p.size) },
    { key: "lev", label: "Lev", align: "right", sortValue: (p) => p.leverage, render: (p) => `${p.leverage}x` },
    {
      key: "mr", label: "Margin ratio", align: "right", sortValue: (p) => p.marginRatio,
      render: (p) => (
        <span className={p.marginRatio < 2 ? "font-semibold text-[rgb(var(--oui-color-danger-light))]" : p.marginRatio < 5 ? "text-[rgb(var(--oui-color-warning))]" : "text-white/60"}>
          {p.marginRatio}%
        </span>
      ),
    },
    { key: "age", label: "Opened", render: (p) => <span className="text-white/40">{timeAgo(p.ts)}</span>, defaultHidden: true },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-72" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[76px]" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const fundHealth = Math.min(100, Math.round((exposure.insurance / (Math.abs(exposure.net) || 1)) * 100 * 4));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Risk Engine"
        description="Venue exposure, insurance fund health, largest positions, and liquidation controls."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Scale} label="Net venue exposure" value={fmtUsd(exposure.net)} hint={exposure.net >= 0 ? "Long-biased" : "Short-biased"} accent="primary" />
        <StatCard icon={ShieldAlert} label="Exchange exposure" value={fmtUsd(exposure.longUsd + exposure.shortUsd)} hint="Gross open interest" accent="warning" />
        <StatCard icon={Landmark} label="Insurance fund" value={fmtUsd(exposure.insurance)} hint={`Health score ${fundHealth}/100`} accent={fundHealth > 40 ? "success" : "danger"} />
        <StatCard icon={Gauge} label="Avg margin ratio" value="8.4%" hint="Healthy above 3%" accent="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Long / Short Ratio" subtitle="Share of open interest">
          <DonutChart
            segments={[
              { label: `Longs · ${fmtUsd(exposure.longUsd)}`, value: exposure.longUsd, color: "rgb(var(--oui-color-success))" },
              { label: `Shorts · ${fmtUsd(exposure.shortUsd)}`, value: exposure.shortUsd, color: "rgb(var(--oui-color-danger))" },
            ]}
            centerValue={`${Math.round((exposure.longUsd / (exposure.longUsd + exposure.shortUsd || 1)) * 100)}%`}
            centerLabel="long"
          />
        </Card>
        <Card title="Exposure by pair" subtitle="Largest concentration">
          <RankedBars items={byPair} formatValue={(v) => fmtUsd(v)} />
        </Card>
        <Card title="Insurance Fund" subtitle="Backstop wallet for liquidation shortfalls">
          <div className="space-y-3">
            <Field label="Fund contract address" hint="Reads balance & health from this address (mock).">
              <div className="flex gap-2">
                <TextInput
                  value={settings.insuranceFundAddress}
                  onChange={(e) => set({ insuranceFundAddress: e.target.value })}
                  className="font-mono text-xs"
                />
                <AdminButton onClick={randomizeFund} className="shrink-0">Random</AdminButton>
              </div>
            </Field>
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span className="text-white/55">Fund balance</span>
              <span className="font-semibold text-white">{fmtUsd(exposure.insurance)}</span>
            </div>
            <div className="rounded-lg bg-white/5 px-3 py-2">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-white/55">Health</span>
                <Badge tone={fundHealth > 60 ? "success" : fundHealth > 30 ? "warning" : "danger"}>
                  {fundHealth > 60 ? "Strong" : fundHealth > 30 ? "Watch" : "Weak"}
                </Badge>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${fundHealth > 60 ? "bg-[rgb(var(--oui-color-success))]" : fundHealth > 30 ? "bg-[rgb(var(--oui-color-warning))]" : "bg-[rgb(var(--oui-color-danger))]"}`}
                  style={{ width: `${fundHealth}%` }}
                />
              </div>
            </div>
            <div className="text-[11px] text-white/35">
              24h inflows: +$184K fees · Outflows: $12K liquidation shortfall
            </div>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
          <AlertTriangle size={15} className="text-[rgb(var(--oui-color-warning))]" />
          Largest positions (top 12 by size)
        </h2>
        <DataTable tableKey="risk-largest" columns={posCols} rows={largest} pageSize={10} emptyTitle="No open positions" />
      </div>

      {/* Risk alerts */}
      <Card title="Risk alerts" subtitle="Automated rule triggers from the risk engine">
        <ul className="divide-y divide-white/5">
          {[
            { sev: "high" as const, text: "PEPE/USDT funding at 0.08% — approaching clamp", t: "22m ago" },
            { sev: "medium" as const, text: "Account 0x7f3a…92be margin ratio 1.2% — partial liquidation scheduled", t: "48m ago" },
            { sev: "medium" as const, text: "SOL/USDT OI up 31% in 4h — review leverage caps", t: "2h ago" },
            { sev: "low" as const, text: "Insurance fund weekly report generated", t: "9h ago" },
          ].map((a, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <Badge tone={a.sev === "high" ? "danger" : a.sev === "medium" ? "warning" : "neutral"}>{a.sev}</Badge>
              <span className="flex-1 text-sm text-white/75">{a.text}</span>
              <span className="text-[11px] text-white/30">{a.t}</span>
              <AdminButton variant="ghost" className="!px-2 !py-1 text-[11px]" onClick={() => toast.success("Alert acknowledged.")}>
                Acknowledge
              </AdminButton>
            </li>
          ))}
        </ul>
      </Card>

      {/* Auto liquidation settings + limits */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Auto-liquidation settings" subtitle="Engine behavior during margin events">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-white/10 p-3.5">
              <div>
                <div className="text-sm text-white/80">Auto liquidation</div>
                <div className="text-[11px] text-white/35">Liquidate accounts that breach maintenance margin.</div>
              </div>
              <Toggle checked={settings.autoLiqEnabled} onChange={(v) => set({ autoLiqEnabled: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 p-3.5">
              <div>
                <div className="text-sm text-white/80">Partial liquidation first</div>
                <div className="text-[11px] text-white/35">Reduce 50% before full liquidation when possible.</div>
              </div>
              <Toggle checked={settings.partialLiqEnabled} onChange={(v) => set({ partialLiqEnabled: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Liquidation fee (%)">
                <TextInput type="number" step="0.1" value={settings.liqFeePercent} onChange={(e) => set({ liqFeePercent: e.target.value })} />
              </Field>
              <Field label="Margin call threshold (%)">
                <TextInput type="number" step="0.5" value={settings.marginCallThreshold} onChange={(e) => set({ marginCallThreshold: e.target.value })} />
              </Field>
            </div>
            <Field label="Funding rate clamp (%)">
              <TextInput type="number" step="0.05" value={settings.fundingClamp} onChange={(e) => set({ fundingClamp: e.target.value })} />
            </Field>
            <Field label="Execution price band (%)">
              <TextInput type="number" value={settings.priceBandPercent} onChange={(e) => set({ priceBandPercent: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Position limits & leverage caps" subtitle="Venue-wide ceilings">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max account leverage">
                <Select value={settings.maxAccountLeverage} onChange={(e) => set({ maxAccountLeverage: e.target.value })}>
                  {[10, 20, 25, 50, 75, 100].map((l) => <option key={l} value={l}>{l}x</option>)}
                </Select>
              </Field>
              <Field label="Max position / user ($)">
                <TextInput type="number" step="500000" value={settings.maxPositionPerUser} onChange={(e) => set({ maxPositionPerUser: e.target.value })} />
              </Field>
            </div>
            <Field label="Max position / pair ($)">
              <TextInput type="number" step="1000000" value={settings.maxPositionPerPair} onChange={(e) => set({ maxPositionPerPair: e.target.value })} />
            </Field>
            <div className="rounded-lg bg-white/5 px-3 py-2.5 text-xs leading-relaxed text-white/45">
              Per-pair overrides (leverage caps, min order size, position limits) are
              configured per market in{" "}
              <span className="text-white/70">Trading Pairs → Edit pair</span>.
            </div>
            <AdminButton variant="primary" onClick={saveSettings} className="w-full">
              <Settings2 size={15} /> Save risk settings
            </AdminButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
