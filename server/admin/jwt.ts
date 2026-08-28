/**
 * Minimal HS256 JWT verification — the algorithm Supabase signs access
 * tokens with. Implemented on `node:crypto` so the API has zero runtime
 * dependencies and cold-starts fast on serverless.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface JwtClaims {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  email?: string;
  role?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export class JwtError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "JwtError";
    this.code = code;
  }
}

function base64UrlDecode(segment: string): Buffer {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function hmac(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

/** Verify signature + expiry. Throws `JwtError` when the token is unusable. */
export function verifyHs256(token: string, secret: string): JwtClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwtError("MALFORMED", "The token is not a valid JWT.");
  }
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(base64UrlDecode(headerSegment).toString("utf8"));
  } catch {
    throw new JwtError("MALFORMED", "The token header is not valid JSON.");
  }
  if (header.alg !== "HS256") {
    // Never accept "none" or an asymmetric algorithm with a shared secret.
    throw new JwtError("UNSUPPORTED_ALG", `Unsupported token algorithm: ${header.alg ?? "unknown"}.`);
  }

  const expected = hmac(secret, `${headerSegment}.${payloadSegment}`);
  const provided = base64UrlDecode(signatureSegment);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new JwtError("BAD_SIGNATURE", "The token signature does not match this project.");
  }

  let claims: JwtClaims;
  try {
    claims = JSON.parse(base64UrlDecode(payloadSegment).toString("utf8")) as JwtClaims;
  } catch {
    throw new JwtError("MALFORMED", "The token payload is not valid JSON.");
  }

  if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) {
    throw new JwtError("EXPIRED", "The session expired. Sign in again.");
  }
  return claims;
}

/** Sign a token. Used by the test-suite and the `scripts/admin-token.ts` helper. */
export function signHs256(
  claims: JwtClaims,
  secret: string,
  options: { expiresInSec?: number; issuedAt?: number } = {}
): string {
  const iat = options.issuedAt ?? Math.floor(Date.now() / 1000);
  const exp = iat + (options.expiresInSec ?? 3600);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({ ...claims, iat, exp }));
  const signature = base64UrlEncode(hmac(secret, `${header}.${payload}`));
  return `${header}.${payload}.${signature}`;
}
