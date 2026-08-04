import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Save, Download, Upload, RotateCcw, Copy, Check } from "lucide-react";
import { CONFIG_FIELDS, FIELD_GROUPS, KNOWN_MENU_ITEMS } from "@/admin/fields";
import { getRuntimeConfig } from "@/utils/runtime-config";
import {
  clearAdminHistory,
  clearAdminOverrides,
  generateConfigJs,
  getAdminOverrides,
  getAdminOverrideValue,
  importAdminOverrides,
  removeAdminOverride,
  setAdminOverride,
} from "@/admin/adminStore";
import { useConfigVersion } from "@/admin/useConfigVersion";
import {
  Card,
  AdminButton,
  PageHeader,
  Field,
  TextInput,
  TextArea,
  Select,
  Toggle,
  FlashBanner,
  useFlashMessage,
} from "@/admin/components/ui";

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Best-effort parse of pasted config.js content or plain JSON. */
function parseConfigInput(input: string): Record<string, string> | null {
  let text = input.trim();
  if (!text) return null;
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  text = text.slice(firstBrace, lastBrace + 1);
  // tolerate trailing commas which are valid in JS object literals
  text = text.replace(/,\s*}/g, "}");
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === "string") out[k] = v;
        else if (v != null) out[k] = String(v);
      });
      return out;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export default function AdminSettings() {
  const configVersion = useConfigVersion();
  const { message, show } = useFlashMessage(6000);

  // Local draft values keyed by config key. Initialised from the effective
  // config; undefined means "use effective value" (not edited this session).
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [importText, setImportText] = useState("");
  const [copied, setCopied] = useState(false);

  const overrides = getAdminOverrides();

  const effectiveValue = (key: string): string =>
    getRuntimeConfig(key) ?? "";

  const valueOf = (key: string): string =>
    key in draft ? draft[key] : effectiveValue(key);

  const isDirty = (key: string): boolean =>
    key in draft && draft[key] !== effectiveValue(key);

  const dirtyKeys = useMemo(
    () => Object.keys(draft).filter((k) => isDirty(k)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, configVersion]
  );

  const setValue = (key: string, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const saveAll = () => {
    if (dirtyKeys.length === 0) return;
    for (const key of dirtyKeys) {
      const result = setAdminOverride(key, draft[key]);
      if (!result.ok) {
        show("error", `Failed to save ${key}: ${result.error}`);
        return;
      }
    }
    setDraft({});
    show(
      "success",
      `Saved ${dirtyKeys.length} setting${dirtyKeys.length > 1 ? "s" : ""}. Changes are live.`
    );
  };

  const discardAll = () => setDraft({});

  const resetField = (key: string) => {
    removeAdminOverride(key);
    setDraft((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
    show("success", `${key} reset to default.`);
  };

  const onExport = () => downloadFile("config.js", generateConfigJs());

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateConfigJs());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      show("error", "Clipboard unavailable — use Export instead.");
    }
  };

  const onImport = (mode: "merge" | "replace") => {
    const parsed = parseConfigInput(importText);
    if (!parsed) {
      show("error", "Could not parse that. Paste a JSON object or config.js content.");
      return;
    }
    const result = importAdminOverrides(parsed, mode);
    if (result.ok) {
      setImportText("");
      setDraft({});
      show("success", `Imported ${Object.keys(parsed).length} config values (${mode}).`);
    } else {
      show("error", result.error);
    }
  };

  const onResetAll = () => {
    if (
      window.confirm(
        "Remove ALL admin overrides and history on this browser? The dapp returns to the deployed configuration."
      )
    ) {
      clearAdminOverrides();
      clearAdminHistory();
      setDraft({});
      show("success", "All overrides cleared.");
    }
  };

  const renderControl = (key: string, type: string) => {
    const value = valueOf(key);
    if (key === "VITE_ENABLED_MENUS") {
      const current = value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const toggleMenu = (name: string) => {
        const set = new Set(current);
        if (set.has(name)) set.delete(name);
        else set.add(name);
        // keep canonical ordering
        if (set.size === 0) {
          setValue(key, "");
          return;
        }
        const ordered = KNOWN_MENU_ITEMS.filter((m) => set.has(m));
        // also keep unknown custom entries
        current.forEach((m) => {
          if (!KNOWN_MENU_ITEMS.includes(m) && set.has(m)) ordered.push(m);
        });
        setValue(key, ordered.join(","));
      };
      return (
        <div className="flex flex-wrap gap-2">
          {KNOWN_MENU_ITEMS.map((name) => {
            const on = current.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleMenu(name)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  on
                    ? "border-[rgba(var(--oui-color-primary),0.6)] bg-[rgba(var(--oui-color-primary),0.15)] text-[rgb(var(--oui-color-primary-light))]"
                    : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white/75"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      );
    }

    switch (type) {
      case "boolean":
        return (
          <div className="flex items-center gap-3">
            <Toggle
              checked={value === "true"}
              onChange={(v) => setValue(key, v ? "true" : "false")}
            />
            <span className="text-xs text-white/45">
              {value === "true" ? "Enabled" : "Disabled"}
            </span>
          </div>
        );
      case "select":
        return (
          <Select value={value} onChange={(e) => setValue(key, e.target.value)}>
            {CONFIG_FIELDS.find((f) => f.key === key)?.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        );
      case "textarea":
        return (
          <TextArea
            value={value}
            placeholder={CONFIG_FIELDS.find((f) => f.key === key)?.placeholder}
            onChange={(e) => setValue(key, e.target.value)}
          />
        );
      default:
        return (
          <TextInput
            value={value}
            placeholder={CONFIG_FIELDS.find((f) => f.key === key)?.placeholder}
            onChange={(e) => setValue(key, e.target.value)}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Edit the dapp's runtime configuration. Saved values are stored as admin overrides and applied live in this browser."
        actions={
          <>
            {dirtyKeys.length > 0 && (
              <AdminButton variant="ghost" onClick={discardAll}>
                Discard
              </AdminButton>
            )}
            <AdminButton
              variant="primary"
              onClick={saveAll}
              disabled={dirtyKeys.length === 0}
            >
              <Save size={15} />
              Save changes
              {dirtyKeys.length > 0 && ` (${dirtyKeys.length})`}
            </AdminButton>
          </>
        }
      />

      <FlashBanner message={message} />

      {dirtyKeys.length > 0 && (
        <div className="rounded-lg border border-[rgba(var(--oui-color-warning),0.35)] bg-[rgba(var(--oui-color-warning),0.08)] px-4 py-2.5 text-sm text-[rgb(var(--oui-color-warning))]">
          You have {dirtyKeys.length} unsaved change{dirtyKeys.length > 1 ? "s" : ""}.
        </div>
      )}

      {FIELD_GROUPS.map((group) => {
        if (group === "Branding") {
          return (
            <Card
              key={group}
              title="Branding"
              subtitle="Logos and favicon are managed visually in the Appearance tab"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-white/55">
                  {getAdminOverrideValue("VITE_CUSTOM_LOGO_URL")
                    ? "A custom primary logo is currently set."
                    : "No custom logo set — the dapp uses the default."}
                </div>
                <Link to="/admin/appearance">
                  <AdminButton variant="primary">Open Appearance</AdminButton>
                </Link>
              </div>
            </Card>
          );
        }

        const fields = CONFIG_FIELDS.filter((f) => f.group === group);
        if (fields.length === 0) return null;

        return (
          <Card key={group} title={group}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className={field.type === "textarea" ? "md:col-span-2" : ""}
                >
                  <Field
                    label={field.label}
                    hint={field.description}
                    overridden={getAdminOverrideValue(field.key) !== undefined}
                    onReset={
                      getAdminOverrideValue(field.key) !== undefined
                        ? () => resetField(field.key)
                        : undefined
                    }
                  >
                    {renderControl(field.key, field.type)}
                  </Field>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {/* Export / Import */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Export configuration"
          subtitle="Download a config.js combining the deployed config with your admin overrides"
        >
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-white/45">
              Replace <code className="rounded bg-white/10 px-1.5 py-0.5">public/config.js</code>{" "}
              in your deployment with the exported file to make your changes
              live for every visitor.
            </p>
            <div className="flex flex-wrap gap-2">
              <AdminButton variant="primary" onClick={onExport}>
                <Download size={15} />
                Download config.js
              </AdminButton>
              <AdminButton onClick={onCopy}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copied!" : "Copy to clipboard"}
              </AdminButton>
            </div>
          </div>
        </Card>

        <Card
          title="Import configuration"
          subtitle="Paste a JSON object or config.js content to apply it as overrides"
        >
          <div className="space-y-3">
            <TextArea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'window.__RUNTIME_CONFIG__ = { "VITE_APP_NAME": "My DEX", … };'}
              className="min-h-[110px]"
            />
            <div className="flex flex-wrap gap-2">
              <AdminButton
                variant="primary"
                onClick={() => onImport("merge")}
                disabled={!importText.trim()}
              >
                <Upload size={15} />
                Merge import
              </AdminButton>
              <AdminButton
                onClick={() => onImport("replace")}
                disabled={!importText.trim()}
              >
                Replace all overrides
              </AdminButton>
            </div>
          </div>
        </Card>
      </div>

      {/* Danger zone */}
      <Card title="Danger zone">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-white/80">
              Reset everything
            </div>
            <div className="text-xs text-white/40">
              Removes all {Object.keys(overrides).length} override
              {Object.keys(overrides).length === 1 ? "" : "s"} and the change
              history on this browser.
            </div>
          </div>
          <AdminButton
            variant="danger"
            onClick={onResetAll}
            disabled={Object.keys(overrides).length === 0}
          >
            <RotateCcw size={15} />
            Reset all overrides
          </AdminButton>
        </div>
      </Card>
    </div>
  );
}
