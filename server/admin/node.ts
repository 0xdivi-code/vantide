/**
 * Node `http` adapter shared by the Vite dev-server middleware and the
 * standalone server. Keeps body parsing / response writing in one place.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAdminRequest, type HandleOptions } from "./router";
import type { AdminRequest } from "./types";

const MAX_BODY_BYTES = 1_000_000;

export async function readBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return undefined;

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      // Stop draining; the response below tells the client why it failed.
      return { __tooLarge: true };
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;

  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function toAdminRequest(
  req: IncomingMessage,
  rawUrl: string,
  base: string,
  body: unknown
): AdminRequest {
  const url = new URL(rawUrl, "http://internal.local");
  const basePath = base.replace(/\/+$/, "");
  let path = url.pathname;
  if (basePath && path.toLowerCase().startsWith(basePath.toLowerCase())) {
    path = path.slice(basePath.length);
  }
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";

  const headers: Record<string, string> = {};
  Object.entries(req.headers).forEach(([key, value]) => {
    if (typeof value === "string") headers[key.toLowerCase()] = value;
    else if (Array.isArray(value)) headers[key.toLowerCase()] = value.join(", ");
  });

  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  return {
    method: (req.method ?? "GET").toUpperCase(),
    path,
    query,
    headers,
    body,
  };
}

export function writeAdminResponse(res: ServerResponse, response: {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
}): void {
  const headers = response.headers ?? {};
  const payload =
    typeof response.body === "string"
      ? response.body
      : response.body === undefined || response.body === null
        ? ""
        : JSON.stringify(response.body);

  res.statusCode = response.status;
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  if (payload && !("content-length" in headers)) {
    res.setHeader("content-length", Buffer.byteLength(payload));
  }
  res.end(payload);
}

/** Mount handler used by both Vite middleware and the standalone server. */
export async function serveNodeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  rawUrl: string,
  options: HandleOptions & { base: string }
): Promise<void> {
  const body = await readBody(req);
  const request = toAdminRequest(req, rawUrl, options.base, body);

  if ((request.body as { __tooLarge?: boolean } | undefined)?.__tooLarge) {
    writeAdminResponse(res, {
      status: 413,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: { success: false, code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds 1MB." },
    });
    return;
  }

  const response = await handleAdminRequest(request, options);
  writeAdminResponse(res, response);
}
