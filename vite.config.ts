import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { cjsInterop } from "vite-plugin-cjs-interop";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import fs from "fs";
import path from "path";

function loadConfigTitle(): string {
  try {
    const configPath = path.join(__dirname, "public/config.js");
    if (!fs.existsSync(configPath)) {
      return "Vantide Perps";
    }

    const configText = fs.readFileSync(configPath, "utf-8");
    // config.js is a JavaScript object literal (unquoted keys, comments,
    // trailing commas) — not JSON. Evaluate it the same way the browser does.
    const sandboxWindow: Record<string, unknown> = {};
    const evaluate = new Function(
      "window",
      `"use strict";\n${configText}\nreturn window.__RUNTIME_CONFIG__ || {};`
    );
    const config = evaluate(sandboxWindow) as Record<string, string>;

    return config.VITE_ORDERLY_BROKER_NAME || "Vantide Perps";
  } catch (error) {
    console.warn("Failed to load title from config.js:", error);
    return "Vantide Perps";
  }
}

function htmlTitlePlugin(): Plugin {
  const title = loadConfigTitle();
  console.log(`Using title from config.js: ${title}`);

  return {
    name: "html-title-transform",
    transformIndexHtml(html) {
      return html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    },
  };
}

export default defineConfig(() => {
  const basePath = process.env.PUBLIC_PATH || "/";

  return {
    base: basePath,
    server: {
      // Allow Arena / e2b live-preview proxy hosts
      allowedHosts: [".e2b.app"],
    },
    preview: {
      allowedHosts: [".e2b.app"],
    },
    plugins: [
      react(),
      tsconfigPaths(),
      htmlTitlePlugin(),
      cjsInterop({
        dependencies: ["bs58", "@coral-xyz/anchor", "lodash"],
      }),
      nodePolyfills({
        include: ["buffer", "crypto", "stream"],
      }),
    ],
    build: {
      outDir: "build/client",
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom"],
    },
  };
});
