import { useMemo, useState } from "react";
import { UserCheck, Check, X, FileText, Download, Flag } from "lucide-react";
import { db } from "@/admin/mock/db";
import { bumpApiVersion, useMockApiVersion } from "@/admin/mock/api";
import { fmtNum, shortHash, timeAgo } from "@/admin/mock/rng";
import type { KycSubmission } from "@/admin/mock/types";
import { PageHeader, Badge, AdminButton, StatCard } from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { FilterBar, useSavedFilters } from "@/admin/components/FilterBar";
import { Drawer, useToast, ConfirmDialog } from "@/admin/components/feedback";

const STATUS_TONE: Record<KycSubmission["status"], "success" | "warning" | "danger" | "primary"> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
  review: "primary",
};

export default function AdminKyc() {
  useMockApiVersion();
  const toast = useToast();
  const [filters, patch] = useSavedFilters("kyc", { q: "", status: "", risk: "" });
  const [selected, setSelected] = useState<KycSubmission | null>(null);
  const [confirm, setConfirm] = useState<{ k: KycSubmission; action: "approved" | "rejected" } | null>(null);

  const rows = useMemo(
    () =>
      db.kyc
        .all()
        .filter(
          (k) =>
            (k.user.toLowerCase().includes(filters.q.toLowerCase()) ||
              k.wallet.toLowerCase().includes(filters.q.toLowerCase()) ||
              k.country.toLowerCase().includes(filters.q.toLowerCase())) &&
            (!filters.status || k.status === filters.status) &&
            (!filters.risk ||
              (filters.risk === "high" ? k.riskScore >= 70 : filters.risk === "medium" ? k.riskScore >= 35 && k.riskScore < 70 : k.riskScore < 35))
        ),
    [filters]
  );

  const all = db.kyc.all();
  const stats = {
    pending: all.filter((k) => k.status === "pending").length,
    approved: all.filter((k) => k.status === "approved").length,
    rejected: all.filter((k) => k.status === "rejected").length,
    review: all.filter((k) => k.status === "review").length,
    aml: all.filter((k) => k.amlFlag).length,
  };

  const review = (k: KycSubmission, action: KycSubmission["status"], note?: string) => {
    db.kyc.update(k.id, { status: action, reviewedBy: "you", note });
    const linkedUser = db.users.get(k.user);
    if (linkedUser) {
      db.users.update(k.user, { kyc: action === "approved" ? "verified" : action === "rejected" ? "rejected" : "review" });
    }
    bumpApiVersion();
    setSelected(null);
    toast.success(`KYC ${k.id} ${action}.`);
  };

  const cols: Column<KycSubmission>[] = [
    { key: "id", label: "Case", sortValue: (k) => k.id, render: (k) => <span className="font-mono text-xs text-white/55">{k.id}</span> },
    { key: "user", label: "User", render: (k) => <div><div className="font-mono text-xs text-white/70">{k.user}</div><div className="font-mono text-[10px] text-white/30">{shortHash(k.wallet)}</div></div> },
    { key: "country", label: "Country", sortValue: (k) => k.country },
    { key: "doc", label: "Document", sortValue: (k) => k.docType, render: (k) => <span className="flex items-center gap-1.5 text-white/70"><FileText size={12} className="text-white/35" />{k.docType}</span> },
    {
      key: "risk", label: "Risk score", align: "right", sortValue: (k) => k.riskScore,
      render: (k) => (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          k.riskScore >= 70 ? "bg-[rgba(var(--oui-color-danger),0.15)] text-[rgb(var(--oui-color-danger-light))]"
          : k.riskScore >= 35 ? "bg-[rgba(var(--oui-color-warning),0.15)] text-[rgb(var(--oui-color-warning))]"
          : "bg-[rgba(var(--oui-color-success),0.15)] text-[rgb(var(--oui-color-success))]"
        }`}>
          {k.riskScore}
        </span>
      ),
    },
    { key: "aml", label: "AML", render: (k) => k.amlFlag ? <Badge tone="danger"><Flag size={10} /> flagged</Badge> : <span className="text-white/25">—</span> },
    { key: "status", label: "Status", sortValue: (k) => k.status, render: (k) => <Badge tone={STATUS_TONE[k.status]}>{k.status}</Badge>, csvValue: (k) => k.status },
    { key: "ts", label: "Submitted", sortValue: (k) => k.submittedAt, render: (k) => <span className="text-white/45">{timeAgo(k.submittedAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="KYC Management" description="Verification queue, documents, AML flags, and audit trail." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={UserCheck} label="Pending" value={fmtNum(stats.pending)} accent="warning" />
        <StatCard icon={Check} label="Approved" value={fmtNum(stats.approved)} accent="success" />
        <StatCard icon={X} label="Rejected" value={fmtNum(stats.rejected)} accent="danger" />
        <StatCard icon={FileText} label="Manual review" value={fmtNum(stats.review)} />
        <StatCard icon={Flag} label="AML flags" value={fmtNum(stats.aml)} accent="danger" />
      </div>

      <FilterBar
        search={filters.q}
        onSearch={(v) => patch({ q: v })}
        searchPlaceholder="Search user, wallet, country…"
        selects={[
          { key: "status", label: "All statuses", options: ["pending", "approved", "rejected", "review"].map((s) => ({ value: s, label: s })) },
          { key: "risk", label: "All risk levels", options: [{ value: "high", label: "High (70+)" }, { value: "medium", label: "Medium (35-69)" }, { value: "low", label: "Low (<35)" }] },
        ]}
        values={filters}
        onSelect={(k, v) => patch({ [k]: v } as Partial<typeof filters>)}
      />

      <DataTable
        tableKey="kyc"
        columns={cols}
        rows={rows}
        onRowClick={setSelected}
        emptyTitle="No KYC cases match"
        bulkActions={(sel, clear) => (
          <>
            <AdminButton variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => {
              sel.filter((k) => k.status === "pending" || k.status === "review").forEach((k) => review(k, "approved"));
              toast.success(`${sel.length} cases approved.`);
              clear();
            }}>
              <Check size={13} /> Approve
            </AdminButton>
            <AdminButton variant="danger" className="!px-2.5 !py-1 text-xs" onClick={() => {
              sel.filter((k) => k.status === "pending" || k.status === "review").forEach((k) => review(k, "rejected", "Bulk rejection"));
              clear();
            }}>
              <X size={13} /> Reject
            </AdminButton>
          </>
        )}
      />

      {/* Review drawer */}
      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={`KYC case ${selected?.id ?? ""}`}
        subtitle={selected ? `${selected.user} · ${selected.country}` : undefined}
        width={480}
        footer={
          selected && (selected.status === "pending" || selected.status === "review") ? (
            <>
              <AdminButton variant="danger" onClick={() => selected && setConfirm({ k: selected, action: "rejected" })}>
                <X size={14} /> Reject
              </AdminButton>
              <AdminButton onClick={() => selected && review(selected, "review", "Sent to manual review")}>
                Request review
              </AdminButton>
              <AdminButton variant="primary" onClick={() => selected && setConfirm({ k: selected, action: "approved" })}>
                <Check size={14} /> Approve
              </AdminButton>
            </>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Status", <Badge key="s" tone={STATUS_TONE[selected.status]}>{selected.status}</Badge>],
                ["Document", selected.docType],
                ["Country", selected.country],
                ["Risk score", `${selected.riskScore}/100`],
                ["AML screening", selected.amlFlag ? "FLAGGED" : "Clear"],
                ["Submitted", timeAgo(selected.submittedAt)],
              ].map(([label, value], i) => (
                <div key={i} className="rounded-lg bg-white/[0.04] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-white/30">{label}</div>
                  <div className="mt-0.5 text-white/85">{value}</div>
                </div>
              ))}
            </div>

            {selected.note && (
              <div className="rounded-lg border border-[rgba(var(--oui-color-danger),0.3)] bg-[rgba(var(--oui-color-danger),0.07)] px-3 py-2 text-xs text-[rgb(var(--oui-color-danger-light))]">
                {selected.note}
              </div>
            )}

            <div>
              <div className="mb-2 text-xs font-medium text-white/60">Documents</div>
              <div className="grid grid-cols-2 gap-2">
                {["ID front", "ID back", "Selfie + ID", "Proof of address"].map((doc) => (
                  <div key={doc} className="rounded-lg border border-white/10 bg-[rgb(var(--oui-color-base-9))] p-3">
                    <div className="flex h-20 items-center justify-center rounded-md bg-white/5">
                      <FileText size={22} className="text-white/20" />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-white/55">{doc}</span>
                      <button
                        onClick={() => toast.success(`${doc} downloaded .`)}
                        className="rounded-md p-1 text-white/35 hover:bg-white/10 hover:text-white/70"
                        title="Download"
                      >
                        <Download size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-white/60">Audit history</div>
              <ul className="space-y-2 text-xs">
                <li className="flex justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                  <span className="text-white/60">Submitted by user</span>
                  <span className="text-white/35">{timeAgo(selected.submittedAt)}</span>
                </li>
                <li className="flex justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                  <span className="text-white/60">Automated screening complete</span>
                  <span className="text-white/35">{timeAgo(selected.submittedAt + 300_000)}</span>
                </li>
                {selected.reviewedBy && (
                  <li className="flex justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                    <span className="text-white/60">Reviewed by {selected.reviewedBy}</span>
                    <span className="text-white/35">{timeAgo(selected.submittedAt + 3_600_000)}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          review(confirm.k, confirm.action, confirm.action === "rejected" ? "Documents could not be verified" : undefined);
        }}
        title={`${confirm?.action === "approved" ? "Approve" : "Reject"} KYC ${confirm?.k.id}?`}
        message={
          confirm?.action === "approved"
            ? "The user's account will be marked KYC-verified and withdrawal limits lifted."
            : "The user will be asked to resubmit their documents."
        }
        confirmLabel={confirm?.action === "approved" ? "Approve" : "Reject"}
        danger={confirm?.action === "rejected"}
      />
    </div>
  );
}
