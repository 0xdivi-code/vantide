import { useMemo, useRef, useState, useEffect } from "react";
import { Headset, Send, CircleDot, UserCog } from "lucide-react";
import { db } from "@/admin/mock/db";
import { bumpApiVersion, matches, useMockApiVersion } from "@/admin/mock/api";
import { shortHash, timeAgo } from "@/admin/mock/rng";
import type { SupportTicket } from "@/admin/mock/types";
import { PageHeader, Badge, AdminButton, StatCard, Select } from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { FilterBar, useSavedFilters } from "@/admin/components/FilterBar";
import { Drawer, useToast } from "@/admin/components/feedback";

const STATUS_TONE: Record<SupportTicket["status"], "warning" | "primary" | "success" | "neutral"> = {
  open: "warning",
  pending: "primary",
  resolved: "success",
  closed: "neutral",
};

const PRIO_TONE: Record<SupportTicket["priority"], "neutral" | "primary" | "warning" | "danger"> = {
  low: "neutral",
  normal: "primary",
  high: "warning",
  urgent: "danger",
};

const ASSIGNEES = ["unassigned", "support.1", "support.2", "support.3"];

export default function AdminSupport() {
  useMockApiVersion();
  const toast = useToast();
  const [filters, patch] = useSavedFilters("support", { q: "", status: "", priority: "", category: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const threadEnd = useRef<HTMLDivElement>(null);

  const rows = useMemo(
    () =>
      db.tickets
        .all()
        .filter(
          (t) =>
            matches([t.id, t.subject, t.user, t.wallet, t.category], filters.q) &&
            (!filters.status || t.status === filters.status) &&
            (!filters.priority || t.priority === filters.priority) &&
            (!filters.category || t.category === filters.category)
        ),
    [filters]
  );

  const selected = selectedId ? db.tickets.get(selectedId) : null;

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length]);

  const all = db.tickets.all();
  const stats = {
    open: all.filter((t) => t.status === "open").length,
    pending: all.filter((t) => t.status === "pending").length,
    urgent: all.filter((t) => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed").length,
    resolvedToday: all.filter((t) => t.status === "resolved" && t.updatedAt > Date.now() - 86_400_000).length,
  };

  const update = (id: string, p: Partial<SupportTicket>, msg?: string) => {
    db.tickets.update(id, { ...p, updatedAt: Date.now() });
    bumpApiVersion();
    if (msg) toast.success(msg);
  };

  const sendReply = () => {
    if (!selected || !reply.trim()) return;
    const msgs = [...selected.messages, { from: "agent" as const, text: reply.trim(), ts: Date.now() }];
    db.tickets.update(selected.id, { messages: msgs, status: "pending", updatedAt: Date.now() });
    bumpApiVersion();
    setReply("");
    toast.success("Reply sent — ticket moved to pending.");
  };

  const cols: Column<SupportTicket>[] = [
    { key: "id", label: "Ticket", sortValue: (t) => t.id, render: (t) => <span className="font-mono text-xs text-white/55">{t.id}</span>, csvValue: (t) => t.id },
    { key: "subject", label: "Subject", sortValue: (t) => t.subject, render: (t) => <div><div className="max-w-[280px] truncate font-medium text-white">{t.subject}</div><div className="font-mono text-[10px] text-white/30">{shortHash(t.wallet)} · {t.category}</div></div> },
    { key: "prio", label: "Priority", sortValue: (t) => t.priority, render: (t) => <Badge tone={PRIO_TONE[t.priority]}>{t.priority}</Badge>, csvValue: (t) => t.priority },
    { key: "status", label: "Status", sortValue: (t) => t.status, render: (t) => <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>, csvValue: (t) => t.status },
    { key: "assignee", label: "Assignee", sortValue: (t) => t.assignee, render: (t) => <span className={t.assignee === "unassigned" ? "text-white/25" : "text-white/60"}>{t.assignee}</span> },
    { key: "updated", label: "Updated", sortValue: (t) => t.updatedAt, render: (t) => <span className="text-white/45">{timeAgo(t.updatedAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Support Center" description="Tickets, live conversations, assignment, and SLA tracking." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={CircleDot} label="Open tickets" value={stats.open} accent="warning" />
        <StatCard icon={CircleDot} label="Pending reply" value={stats.pending} />
        <StatCard icon={Headset} label="Urgent" value={stats.urgent} accent="danger" />
        <StatCard icon={Headset} label="Resolved today" value={stats.resolvedToday} accent="success" hint="Avg response 42m" />
      </div>

      <FilterBar
        search={filters.q}
        onSearch={(v) => patch({ q: v })}
        searchPlaceholder="Search tickets, users, wallet…"
        selects={[
          { key: "status", label: "All statuses", options: ["open", "pending", "resolved", "closed"].map((s) => ({ value: s, label: s })) },
          { key: "priority", label: "All priorities", options: ["low", "normal", "high", "urgent"].map((s) => ({ value: s, label: s })) },
          { key: "category", label: "All categories", options: ["Deposit", "Withdrawal", "Trading", "KYC", "Account", "API", "Other"].map((s) => ({ value: s, label: s })) },
        ]}
        values={filters}
        onSelect={(k, v) => patch({ [k]: v } as Partial<typeof filters>)}
      />

      <DataTable
        tableKey="tickets"
        columns={cols}
        rows={rows}
        onRowClick={(t) => setSelectedId(t.id)}
        emptyTitle="No tickets match"
        bulkActions={(sel, clear) => (
          <>
            <AdminButton variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => { sel.forEach((t) => db.tickets.update(t.id, { assignee: "support.1", status: "pending" })); bumpApiVersion(); toast.success(`${sel.length} tickets assigned to support.1.`); clear(); }}>
              <UserCog size={13} /> Assign to support.1
            </AdminButton>
            <AdminButton variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => { sel.forEach((t) => db.tickets.update(t.id, { status: "resolved" })); bumpApiVersion(); toast.success(`${sel.length} tickets resolved.`); clear(); }}>
              Resolve
            </AdminButton>
          </>
        )}
      />

      {/* Ticket conversation drawer */}
      <Drawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected?.subject ?? ""}
        subtitle={selected ? `${selected.id} · ${selected.user} · ${selected.category}` : undefined}
        width={520}
        footer={
          selected ? (
            <div className="flex w-full flex-col gap-2.5">
              <div className="flex gap-2">
                <Select
                  value={selected.assignee}
                  onChange={(e) => update(selected.id, { assignee: e.target.value }, `Assigned to ${e.target.value}.`)}
                  className="!w-36"
                >
                  {ASSIGNEES.map((a) => <option key={a}>{a}</option>)}
                </Select>
                <Select
                  value={selected.status}
                  onChange={(e) => update(selected.id, { status: e.target.value as SupportTicket["status"] }, `Status → ${e.target.value}.`)}
                  className="!w-32"
                >
                  {["open", "pending", "resolved", "closed"].map((s) => <option key={s}>{s}</option>)}
                </Select>
                <Select
                  value={selected.priority}
                  onChange={(e) => update(selected.id, { priority: e.target.value as SupportTicket["priority"] }, `Priority → ${e.target.value}.`)}
                  className="!w-28"
                >
                  {["low", "normal", "high", "urgent"].map((s) => <option key={s}>{s}</option>)}
                </Select>
              </div>
              <div className="flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }}
                  placeholder="Write a reply to the user…"
                  className="flex-1 rounded-lg border border-white/10 bg-[rgb(var(--oui-color-base-9))] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-[rgba(var(--oui-color-primary),0.6)]"
                />
                <AdminButton variant="primary" onClick={sendReply} disabled={!reply.trim()}>
                  <Send size={14} />
                </AdminButton>
              </div>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone={PRIO_TONE[selected.priority]}>{selected.priority} priority</Badge>
              <Badge tone={STATUS_TONE[selected.status]}>{selected.status}</Badge>
              <Badge tone="neutral">{selected.category}</Badge>
            </div>
            <div className="space-y-2.5">
              {selected.messages.map((m, i) => (
                <div key={i} className={`flex ${m.from === "agent" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      m.from === "agent"
                        ? "rounded-br-md bg-[rgb(var(--oui-color-primary))] text-white"
                        : "rounded-bl-md bg-white/[0.06] text-white/80"
                    }`}
                  >
                    {m.text}
                    <div className={`mt-1 text-[10px] ${m.from === "agent" ? "text-white/60" : "text-white/30"}`}>
                      {m.from === "agent" ? "Support" : "User"} · {timeAgo(m.ts)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={threadEnd} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
