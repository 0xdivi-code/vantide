import { useMemo, useState } from "react";
import { FileText, Plus, Pencil, Trash2, Globe, EyeOff } from "lucide-react";
import { db } from "@/admin/mock/db";
import { bumpApiVersion, matches, useMockApiVersion } from "@/admin/mock/api";
import { uid } from "@/admin/mock/engine";
import { timeAgo } from "@/admin/mock/rng";
import type { CmsItem } from "@/admin/mock/types";
import { PageHeader, Badge, AdminButton, Field, TextInput, TextArea, Select } from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { FilterBar, useSavedFilters } from "@/admin/components/FilterBar";
import { Modal, ConfirmDialog, useToast } from "@/admin/components/feedback";

const KINDS: { id: CmsItem["kind"]; label: string }[] = [
  { id: "announcement", label: "Announcements" },
  { id: "popup", label: "Popups" },
  { id: "news", label: "News & Blog" },
  { id: "faq", label: "FAQ" },
  { id: "page", label: "Legal Pages" },
];

export default function AdminCms() {
  useMockApiVersion();
  const toast = useToast();
  const [kind, setKind] = useState<CmsItem["kind"]>("announcement");
  const [filters, patch] = useSavedFilters("cms", { q: "", status: "" });
  const [editing, setEditing] = useState<CmsItem | null | "new">(null);
  const [toDelete, setToDelete] = useState<CmsItem | null>(null);

  const rows = useMemo(
    () =>
      db.cms
        .all()
        .filter(
          (c) =>
            c.kind === kind &&
            matches([c.title, c.body], filters.q) &&
            (!filters.status || c.status === filters.status)
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [kind, filters]
  );

  const counts = useMemo(() => {
    const m = new Map<CmsItem["kind"], number>();
    db.cms.all().forEach((c) => m.set(c.kind, (m.get(c.kind) || 0) + 1));
    return m;
  }, []);

  const save = () => {
    if (!editing || editing === "new") return;
    if (!editing.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    db.cms.update(editing.id, { ...editing, updatedAt: Date.now() });
    bumpApiVersion();
    setEditing(null);
    toast.success("Content saved.");
  };

  const create = () => {
    const id = uid("cms");
    db.cms.insert({
      id,
      kind,
      title: kind === "faq" ? "New FAQ question" : kind === "popup" ? "New popup" : kind === "page" ? "New legal page" : "New announcement",
      body: "",
      status: "draft",
      updatedAt: Date.now(),
    });
    bumpApiVersion();
    setEditing(db.cms.get(id) ?? null);
  };

  const togglePublish = (c: CmsItem) => {
    db.cms.update(c.id, { status: c.status === "published" ? "draft" : "published", updatedAt: Date.now() });
    bumpApiVersion();
    toast.success(c.status === "published" ? `"${c.title}" unpublished.` : `"${c.title}" is now live.`);
  };

  const cols: Column<CmsItem>[] = [
    { key: "title", label: "Title", sortValue: (c) => c.title, render: (c) => <div><div className="max-w-[320px] truncate font-medium text-white">{c.title}</div><div className="max-w-[320px] truncate text-[11px] text-white/30">{c.body || "No content yet"}</div></div>, csvValue: (c) => c.title },
    { key: "status", label: "Status", sortValue: (c) => c.status, render: (c) => <Badge tone={c.status === "published" ? "success" : "neutral"}>{c.status}</Badge>, csvValue: (c) => c.status },
    { key: "updated", label: "Updated", sortValue: (c) => c.updatedAt, render: (c) => <span className="text-white/45">{timeAgo(c.updatedAt)}</span> },
    {
      key: "act", label: "",
      render: (c) => (
        <div className="flex gap-0.5">
          <button onClick={() => togglePublish(c)} className={`rounded-md p-1.5 hover:bg-white/10 ${c.status === "published" ? "text-[rgb(var(--oui-color-success))]" : "text-white/35"}`} title={c.status === "published" ? "Unpublish" : "Publish"}>
            {c.status === "published" ? <Globe size={13} /> : <EyeOff size={13} />}
          </button>
          <button onClick={() => setEditing({ ...c })} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white" title="Edit"><Pencil size={13} /></button>
          <button onClick={() => setToDelete(c)} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-[rgb(var(--oui-color-danger-light))]" title="Delete"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Content Management"
        description="Announcements, popups, news, FAQs, help center, and legal pages."
        actions={
          <AdminButton variant="primary" onClick={create}>
            <Plus size={15} /> New {KINDS.find((k) => k.id === kind)?.label.replace(/s$/, "") ?? "item"}
          </AdminButton>
        }
      />

      {/* Kind tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-9))] p-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
              kind === k.id
                ? "bg-[rgba(var(--oui-color-primary),0.18)] text-[rgb(var(--oui-color-primary-light))]"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <FileText size={13} />
            {k.label}
            <span className="rounded-full bg-white/10 px-1.5 text-[10px]">{counts.get(k.id) ?? 0}</span>
          </button>
        ))}
      </div>

      <FilterBar
        search={filters.q}
        onSearch={(v) => patch({ q: v })}
        searchPlaceholder="Search content…"
        selects={[{ key: "status", label: "Published & drafts", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }] }]}
        values={filters}
        onSelect={(k, v) => patch({ [k]: v } as Partial<typeof filters>)}
      />

      <DataTable
        tableKey={`cms-${kind}`}
        columns={cols}
        rows={rows}
        onRowClick={(c) => setEditing({ ...c })}
        emptyTitle={`No ${KINDS.find((k) => k.id === kind)?.label.toLowerCase()} yet`}
        bulkActions={(sel, clear) => (
          <>
            <AdminButton variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => { sel.forEach((c) => db.cms.update(c.id, { status: "published" })); bumpApiVersion(); toast.success(`${sel.length} items published.`); clear(); }}>
              <Globe size={13} /> Publish
            </AdminButton>
            <AdminButton variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => { sel.forEach((c) => db.cms.update(c.id, { status: "draft" })); bumpApiVersion(); toast.success(`${sel.length} items unpublished.`); clear(); }}>
              <EyeOff size={13} /> Unpublish
            </AdminButton>
          </>
        )}
      />

      {/* Editor */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New content" : `Edit — ${editing?.title ?? ""}`}
        wide
        footer={
          <>
            <AdminButton onClick={() => setEditing(null)}>Cancel</AdminButton>
            {editing && editing !== "new" && (
              <AdminButton
                variant={editing.status === "published" ? "secondary" : "primary"}
                onClick={() => {
                  const next = { ...editing, status: editing.status === "published" ? "draft" as const : "published" as const };
                  db.cms.update(editing.id, { ...next, updatedAt: Date.now() });
                  bumpApiVersion();
                  setEditing(null);
                  toast.success(next.status === "published" ? "Published — now live." : "Moved back to draft.");
                }}
              >
                {editing.status === "published" ? "Save & unpublish" : "Save & publish"}
              </AdminButton>
            )}
            <AdminButton variant="primary" onClick={save}>Save draft</AdminButton>
          </>
        }
      >
        {editing && editing !== "new" && (
          <div className="space-y-4">
            <Field label="Title">
              <TextInput value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </Field>
            <Field label={editing.kind === "faq" ? "Answer" : "Body"}>
              <TextArea className="min-h-[160px]" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as CmsItem["status"] })}>
                <option value="draft">draft</option>
                <option value="published">published</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (!toDelete) return;
          db.cms.remove(toDelete.id);
          bumpApiVersion();
          toast.success(`"${toDelete.title}" deleted.`);
        }}
        title={`Delete "${toDelete?.title}"?`}
        message="The content will be removed from the mock CMS."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
