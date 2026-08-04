import { useMemo, useState } from "react";
import { BellRing, Send, Eye, Mail, MessageSquare, Smartphone, Globe2, AlertOctagon } from "lucide-react";
import { db } from "@/admin/mock/db";
import { bumpApiVersion, matches, useMockApiVersion } from "@/admin/mock/api";
import { uid } from "@/admin/mock/engine";
import { fmtNum, fmtTime, timeAgo } from "@/admin/mock/rng";
import type { AdminNotification } from "@/admin/mock/types";
import { PageHeader, Badge, AdminButton, Card, Field, TextInput, TextArea, Select } from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { FilterBar, useSavedFilters } from "@/admin/components/FilterBar";
import { Modal, useToast } from "@/admin/components/feedback";

const TYPE_META: Record<AdminNotification["type"], { label: string; tone: "primary" | "success" | "warning" | "danger" | "neutral"; icon: React.ComponentType<{ size?: number | string; className?: string }> }> = {
  global: { label: "Global notification", tone: "primary", icon: Globe2 },
  user: { label: "Direct to user", tone: "neutral", icon: BellRing },
  email: { label: "Email", tone: "primary", icon: Mail },
  sms: { label: "SMS", tone: "warning", icon: MessageSquare },
  push: { label: "Push", tone: "primary", icon: Smartphone },
  banner: { label: "System banner", tone: "warning", icon: Globe2 },
  maintenance: { label: "Maintenance notice", tone: "warning", icon: AlertOctagon },
  trading_alert: { label: "Trading alert", tone: "danger", icon: BellRing },
  emergency: { label: "Emergency alert", tone: "danger", icon: AlertOctagon },
};

export default function AdminNotifications() {
  useMockApiVersion();
  const toast = useToast();
  const [filters, patch] = useSavedFilters("notifications", { q: "", type: "" });
  const [form, setForm] = useState({ type: "global" as AdminNotification["type"], audience: "All users", target: "", title: "", message: "", schedule: "now" });
  const [preview, setPreview] = useState(false);

  const rows = useMemo(
    () =>
      db.notifications
        .all()
        .filter((n) => matches([n.title, n.message, n.audience], filters.q) && (!filters.type || n.type === filters.type)),
    [filters]
  );

  const send = (asDraft = false) => {
    if (!form.title.trim() || !form.message.trim()) {
      toast.error("Title and message are required.");
      return;
    }
    if (form.type === "user" && !form.target.trim()) {
      toast.error("Enter the target user's email or wallet for direct notification.");
      return;
    }
    if (form.type === "emergency") {
      if (!preview) {
        setPreview(true);
        toast.info("Emergency alerts require review — confirm in the preview.");
        return;
      }
    }
    const scheduled = form.schedule === "schedule";
    db.notifications.insert({
      id: uid("ntf"),
      type: form.type,
      audience: form.type === "user" ? form.target.trim() : form.audience,
      title: form.title.trim(),
      message: form.message.trim(),
      status: asDraft ? "draft" : scheduled ? "scheduled" : "sent",
      sentAt: Date.now(),
      recipients: asDraft ? 0 : form.type === "user" ? 1 : Math.floor(Math.random() * 60000) + 12000,
    });
    bumpApiVersion();
    setForm({ ...form, title: "", message: "" });
    setPreview(false);
    toast.success(asDraft ? "Saved as draft." : scheduled ? "Notification scheduled." : `${TYPE_META[form.type].label} sent to ${form.audience.toLowerCase()}.`);
  };

  const cols: Column<AdminNotification>[] = [
    {
      key: "type", label: "Type", sortValue: (n) => n.type,
      render: (n) => {
        const meta = TYPE_META[n.type];
        return (
          <span className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              meta.tone === "danger" ? "bg-[rgba(var(--oui-color-danger),0.15)] text-[rgb(var(--oui-color-danger-light))]"
              : meta.tone === "warning" ? "bg-[rgba(var(--oui-color-warning),0.15)] text-[rgb(var(--oui-color-warning))]"
              : "bg-[rgba(var(--oui-color-primary),0.15)] text-[rgb(var(--oui-color-primary-light))]"
            }`}>
              <meta.icon size={12} />
            </span>
            <span className="text-white/70">{meta.label}</span>
          </span>
        );
      },
    },
    { key: "title", label: "Title", sortValue: (n) => n.title, render: (n) => <div><div className="max-w-[260px] truncate font-medium text-white">{n.title}</div><div className="max-w-[260px] truncate text-[11px] text-white/35">{n.message}</div></div>, csvValue: (n) => n.title },
    { key: "aud", label: "Audience", sortValue: (n) => n.audience, render: (n) => <span className="text-white/55">{n.audience}</span> },
    { key: "recip", label: "Recipients", align: "right", sortValue: (n) => n.recipients, render: (n) => fmtNum(n.recipients) },
    { key: "status", label: "Status", sortValue: (n) => n.status, render: (n) => <Badge tone={n.status === "sent" ? "success" : n.status === "scheduled" ? "warning" : "neutral"}>{n.status}</Badge>, csvValue: (n) => n.status },
    { key: "ts", label: "Time", sortValue: (n) => n.sentAt, render: (n) => <span className="text-white/45">{timeAgo(n.sentAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Notification Center" description="Broadcast to all users, target individuals, or schedule banners and alerts across channels." />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Compose */}
        <Card title="Compose" subtitle="Send or schedule a notification" className="xl:col-span-1">
          <div className="space-y-4">
            <Field label="Channel">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AdminNotification["type"] })}>
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
            {form.type === "user" ? (
              <Field label="Target user" hint="Email or wallet address.">
                <TextInput value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="trader@example.com or 0x…" />
              </Field>
            ) : (
              <Field label="Audience">
                <Select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                  {["All users", "VIP users", "Active traders", "KYC pending", "Nigeria", "Dormant 30d+"].map((a) => <option key={a}>{a}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Title">
              <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Scheduled maintenance — Aug 10" />
            </Field>
            <Field label="Message">
              <TextArea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Trading will be paused 02:00–03:30 UTC for a system upgrade…" />
            </Field>
            <Field label="Delivery">
              <Select value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })}>
                <option value="now">Send immediately</option>
                <option value="schedule">Schedule for later</option>
              </Select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <AdminButton variant="primary" className="flex-1" onClick={() => send(false)}>
                <Send size={14} /> {form.schedule === "schedule" ? "Schedule" : "Send"}
              </AdminButton>
              <AdminButton onClick={() => setPreview(true)}>
                <Eye size={14} /> Preview
              </AdminButton>
              <AdminButton variant="ghost" onClick={() => send(true)}>Save draft</AdminButton>
            </div>
            {form.type === "emergency" && (
              <div className="rounded-lg border border-[rgba(var(--oui-color-danger),0.35)] bg-[rgba(var(--oui-color-danger),0.08)] px-3 py-2 text-xs text-[rgb(var(--oui-color-danger-light))]">
                Emergency alerts bypass user preferences and are pushed to every device. Review required.
              </div>
            )}
          </div>
        </Card>

        {/* History */}
        <div className="space-y-3 xl:col-span-2">
          <FilterBar
            search={filters.q}
            onSearch={(v) => patch({ q: v })}
            searchPlaceholder="Search title, message, audience…"
            selects={[{ key: "type", label: "All channels", options: Object.entries(TYPE_META).map(([k, v]) => ({ value: k, label: v.label })) }]}
            values={filters}
            onSelect={(k, v) => patch({ [k]: v } as Partial<typeof filters>)}
          />
          <DataTable tableKey="notifications" columns={cols} rows={rows} emptyTitle="No notifications yet" emptyHint="Compose your first broadcast on the left." />
        </div>
      </div>

      {/* Preview */}
      <Modal open={preview} onClose={() => setPreview(false)} title="Notification preview" subtitle={TYPE_META[form.type].label}
        footer={
          <>
            <AdminButton onClick={() => setPreview(false)}>Close</AdminButton>
            <AdminButton variant="primary" onClick={() => send(false)}><Send size={14} /> Send now</AdminButton>
          </>
        }
      >
        <div className="rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-9))] p-4">
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Badge tone={TYPE_META[form.type].tone}>{TYPE_META[form.type].label}</Badge>
            <span>to {form.type === "user" ? form.target || "(no target)" : form.audience}</span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-white">{form.title || "(no title)"}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-white/65">{form.message || "(no message)"}</p>
          <p className="mt-3 text-[10px] text-white/30">{fmtTime(Date.now())} · Vantide Exchange</p>
        </div>
      </Modal>
    </div>
  );
}
