import { ChangeEvent, DragEvent, useRef, useState } from "react";
import {
  Upload,
  RotateCcw,
  Link2,
  Image as ImageIcon,
  Download,
  MonitorSmartphone,
  Star,
} from "lucide-react";
import {
  getAdminOverrideValue,
  getSharedAdminOverrides,
  removeAdminOverride,
  setAdminOverride,
  generateConfigJs,
} from "@/admin/adminStore";
import { applySharedRuntimeConfig, getRuntimeConfig } from "@/utils/runtime-config";
import {
  getAdminApiBaseUrl,
  publishSharedRuntimeConfig,
} from "@/admin/api/client";
import {
  isSharedRuntimeConfigKey,
  validateSharedRuntimeConfigValue,
  type SharedRuntimeConfigChanges,
} from "../../../shared/runtime-config";
import { withBasePath } from "@/utils/base-path";
import { useConfigVersion } from "@/admin/useConfigVersion";
import {
  Card,
  Badge,
  AdminButton,
  PageHeader,
  TextInput,
  FlashBanner,
  useFlashMessage,
  FlashMessage,
} from "@/admin/components/ui";
import { ThemeEditor } from "@/admin/components/ThemeEditor";

const MAX_FILE_BYTES = 1.5 * 1024 * 1024; // hard limit for localStorage
const WARN_FILE_BYTES = 250 * 1024;
const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

interface LogoSlotDef {
  configKey: string;
  title: string;
  description: string;
  /** preview box height class */
  previewHeight: string;
  /** default image shown when nothing custom/static is set */
  defaultSrc: () => string | null;
  /** effective image used by the app right now */
  effectiveSrc: () => string | null;
  recommended: string;
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function LogoSlot({
  def,
  onFlash,
  icon: Icon,
}: {
  def: LogoSlotDef;
  onFlash: (type: FlashMessage["type"], text: string) => void;
  icon: typeof ImageIcon;
}) {
  // re-render on override changes
  useConfigVersion();

  const inputRef = useRef<HTMLInputElement>(null);
  const [urlValue, setUrlValue] = useState("");
  const [dragging, setDragging] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const override = getAdminOverrideValue(def.configKey);
  const sharedValue = getSharedAdminOverrides()[def.configKey];
  const sharedApiAvailable = Boolean(getAdminApiBaseUrl());
  const effective = def.effectiveSrc();
  const fallback = def.defaultSrc();
  const shown = effective || fallback;

  const publishCurrent = async () => {
    if (publishing || !isSharedRuntimeConfigKey(def.configKey)) return;
    const value = getRuntimeConfig(def.configKey);
    if (!value) {
      onFlash("error", `Set a custom ${def.title.toLowerCase()} before publishing.`);
      return;
    }
    setPublishing(true);
    const changes: SharedRuntimeConfigChanges = { [def.configKey]: value };
    try {
      const state = await publishSharedRuntimeConfig(changes);
      removeAdminOverride(def.configKey);
      applySharedRuntimeConfig(state.values);
      onFlash("success", `${def.title} published for visitors on their next page load.`);
    } catch (error) {
      onFlash("error", error instanceof Error ? error.message : `Could not publish ${def.title}.`);
    } finally {
      setPublishing(false);
    }
  };

  const clearShared = async () => {
    if (publishing || !isSharedRuntimeConfigKey(def.configKey)) return;
    setPublishing(true);
    const changes: SharedRuntimeConfigChanges = { [def.configKey]: null };
    try {
      const state = await publishSharedRuntimeConfig(changes);
      removeAdminOverride(def.configKey);
      applySharedRuntimeConfig(state.values);
      onFlash("success", `${def.title} shared override removed; the deployed default is active.`);
    } catch (error) {
      onFlash("error", error instanceof Error ? error.message : `Could not clear shared ${def.title}.`);
    } finally {
      setPublishing(false);
    }
  };

  const applyDataUrl = (dataUrl: string, sizeLabel: string) => {
    const result = setAdminOverride(def.configKey, dataUrl);
    if (result.ok) {
      onFlash(
        "success",
        `${def.title} local preview updated (${sizeLabel}). Publish it to share with visitors.`
      );
    } else {
      onFlash("error", result.error);
    }
  };

  const handleFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      onFlash("error", "Unsupported file type. Use PNG, JPG, WebP, GIF or SVG.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      onFlash(
        "error",
        `File is ${(file.size / 1024 / 1024).toFixed(2)} MB — the limit is 1.5 MB because it is stored in the browser. Export a URL-based logo instead, or use a smaller file.`
      );
      return;
    }
    const sizeLabel = `${Math.round(file.size / 1024)} KB`;
    const largeNote =
      file.size > WARN_FILE_BYTES
        ? " Consider hosting the file and using its URL for production."
        : "";
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        applyDataUrl(reader.result, `${sizeLabel}.${largeNote}`);
      }
    };
    reader.onerror = () => onFlash("error", "Could not read that file.");
    reader.readAsDataURL(file);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const applyUrl = () => {
    const url = urlValue.trim();
    if (!url) return;
    if (!isSharedRuntimeConfigKey(def.configKey)) return;
    const validationError = validateSharedRuntimeConfigValue(def.configKey, url);
    if (validationError) {
      onFlash("error", validationError);
      return;
    }
    const result = setAdminOverride(def.configKey, url);
    if (result.ok) {
      setUrlValue("");
      onFlash("success", `${def.title} local preview updated. Publish it to share with visitors.`);
    } else {
      onFlash("error", result.error);
    }
  };

  const reset = () => {
    removeAdminOverride(def.configKey);
    onFlash("success", `${def.title} local preview cleared; shared or deployed branding is restored.`);
  };

  return (
    <Card
      title={def.title}
      subtitle={def.description}
      actions={
        <Badge tone={override || sharedValue !== undefined ? "primary" : "neutral"}>
          {override ? "Local preview" : sharedValue !== undefined ? "Shared" : "Default"}
        </Badge>
      }
    >
      <div className="space-y-4">
        {/* Preview */}
        <div
          className={`flex ${def.previewHeight} items-center justify-center rounded-lg border border-dashed border-white/15 bg-[rgb(var(--oui-color-base-9))] px-4`}
        >
          {shown ? (
            <img
              src={shown}
              alt={`${def.title} preview`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-white/30">
              <Icon size={22} />
              <span className="text-xs">No logo set</span>
            </div>
          )}
        </div>
        <p className="text-[11px] text-white/35">Recommended: {def.recommended}</p>

        {/* Upload */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3 transition-colors ${
            dragging
              ? "border-[rgba(var(--oui-color-primary),0.7)] bg-[rgba(var(--oui-color-primary),0.1)]"
              : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <div className="text-xs text-white/50">
            <span className="font-medium text-white/75">Upload an image</span>
            <br />
            Drag & drop or browse — PNG, JPG, WebP, GIF, SVG up to 1.5 MB.
          </div>
          <AdminButton onClick={() => inputRef.current?.click()}>
            <Upload size={14} />
            Browse
          </AdminButton>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={onInputChange}
          />
        </div>

        {/* URL */}
        <div className="flex items-center gap-2">
          <TextInput
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="…or paste an image URL (https://…)"
            onKeyDown={(e) => {
              if (e.key === "Enter") applyUrl();
            }}
          />
          <AdminButton onClick={applyUrl} disabled={!urlValue.trim()}>
            <Link2 size={14} />
            Apply
          </AdminButton>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <AdminButton
            variant="primary"
            onClick={publishCurrent}
            disabled={publishing || !sharedApiAvailable || !getRuntimeConfig(def.configKey)}
            title={sharedApiAvailable ? "Publish the current custom image" : "Configure VITE_ADMIN_API_URL to publish"}
          >
            <Upload size={14} />
            {publishing ? "Publishing…" : "Publish current"}
          </AdminButton>
          {sharedValue !== undefined && (
            <AdminButton onClick={clearShared} disabled={publishing}>
              <RotateCcw size={14} />
              Clear shared
            </AdminButton>
          )}
        </div>

        {override && (
          <AdminButton variant="danger" className="w-full" onClick={reset} disabled={publishing}>
            <RotateCcw size={14} />
            Clear local preview
          </AdminButton>
        )}
      </div>
    </Card>
  );
}

export default function AdminAppearance() {
  useConfigVersion();
  const { message, show } = useFlashMessage(6000);

  const slots: LogoSlotDef[] = [
    {
      configKey: "VITE_CUSTOM_LOGO_URL",
      title: "Primary logo",
      description: "Shown in the desktop navigation header.",
      previewHeight: "h-28",
      recommended: "transparent PNG/WebP/SVG, ~200×48 px, height 42 px in the header.",
      defaultSrc: () => withBasePath("/orderly-logo.svg"),
      effectiveSrc: () => {
        const custom = getRuntimeConfig("VITE_CUSTOM_LOGO_URL");
        if (custom) return custom;
        return getRuntimeConfig("VITE_HAS_PRIMARY_LOGO") === "true"
          ? withBasePath("/logo.webp")
          : null;
      },
    },
    {
      configKey: "VITE_CUSTOM_SECONDARY_LOGO_URL",
      title: "Secondary logo",
      description: "Used on the mobile header and on wallet/connect screens.",
      previewHeight: "h-28",
      recommended: "square or wide image, height 32 px on mobile.",
      defaultSrc: () => withBasePath("/orderly-logo-secondary.svg"),
      effectiveSrc: () => {
        const custom = getRuntimeConfig("VITE_CUSTOM_SECONDARY_LOGO_URL");
        if (custom) return custom;
        return getRuntimeConfig("VITE_HAS_SECONDARY_LOGO") === "true"
          ? withBasePath("/logo-secondary.webp")
          : null;
      },
    },
    {
      configKey: "VITE_CUSTOM_FAVICON_URL",
      title: "Favicon",
      description: "Browser tab icon.",
      previewHeight: "h-20",
      recommended: "square, at least 64×64 px.",
      defaultSrc: () => withBasePath("/favicon.webp"),
      effectiveSrc: () => getRuntimeConfig("VITE_CUSTOM_FAVICON_URL") || null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appearance"
        description="Preview branding privately, publish it through the audited admin API, or export config.js for static hosting."
        actions={
          <AdminButton onClick={() => downloadFile("config.js", generateConfigJs())}>
            <Download size={15} />
            Export config.js
          </AdminButton>
        }
      />

      <FlashBanner message={message} />

      <ThemeEditor />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LogoSlot def={slots[0]} onFlash={show} icon={MonitorSmartphone} />
        <LogoSlot def={slots[1]} onFlash={show} icon={ImageIcon} />
        <div className="lg:col-span-2">
          <LogoSlot def={slots[2]} onFlash={show} icon={Star} />
        </div>
      </div>

      <Card title="Publishing and static fallback">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-white/60">
          <li>Upload or link an image to create an instant local preview.</li>
          <li>
            Click <span className="font-medium text-white">Publish current</span> to store the safe URL/data value through the authenticated admin API. The change is audited and reaches visitors on their next page load.
          </li>
          <li>
            On static-only hosting, click <span className="font-medium text-white">Export config.js</span> and replace <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">public/config.js</code> in the deployment instead.
          </li>
        </ol>
        <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-white/40">
          Note: uploaded images are stored as data URLs in localStorage and in
          the exported config.js. For production, hosting the image file (e.g.
          as /logo.webp) and pasting its URL is more efficient.
        </p>
      </Card>
    </div>
  );
}
