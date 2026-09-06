/**
 * Minimal JWT verification supporting both legacy HS256 and new asymmetric
 * Supabase tokens (ES256 / RS256).
 *
 * Supabase projects created before ~May 2025 sign tokens with a symmetric
 * HS256 secret (SUPABASE_JWT_SECRET). Newer projects sign with an asymmetric
 * ES256 key whose public part is published at:
 *   {SUPABASE_URL}/auth/v1/.well-known/jwks.json
 *
 * This module verifies both flavours with zero runtime dependencies, using
 * only node:crypto so it cold-starts fast on serverless.
 */

import { createHmac, timingSafeEqual, createPublicKey, verify, constants } from "node:crypto";

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

export interface Jwk {
  kty: string;
  kid?: string;
  alg?: string;
  use?: string;
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
}

export interface JwksResponse {
  keys: Jwk[];
}

function base64UrlDecode(segment: string): Buffer {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  // Pad to multiple of 4
  const padLen = (4 - (padded.length % 4)) % 4;
  const withPad = padded + "=".repeat(padLen);
  return Buffer.from(withPad, "base64");
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

/* ------------------------------------------------------------------ */
/* JOSE -> DER conversion for ECDSA                                   */
/* ------------------------------------------------------------------ */

function encodeLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  const bytes: number[] = [];
  let tmp = len;
  while (tmp > 0) {
    bytes.unshift(tmp & 0xff);
    tmp >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function encodeAsn1Integer(buf: Buffer): Buffer {
  // Strip leading zeros but keep at least one byte
  let offset = 0;
  while (offset < buf.length - 1 && buf[offset] === 0x00) offset++;
  let v = buf.subarray(offset);
  // If high bit set, prepend 0x00 to make it positive
  if (v[0] & 0x80) {
    const tmp = Buffer.alloc(v.length + 1);
    tmp[0] = 0x00;
    v.copy(tmp, 1);
    v = tmp;
  }
  const len = encodeLength(v.length);
  return Buffer.concat([Buffer.from([0x02]), len, v]);
}

function joseToDer(signature: Buffer): Buffer {
  // JOSE ECDSA signature is r || s, each half
  if (signature.length % 2 !== 0) {
    throw new JwtError("BAD_SIGNATURE", "Invalid ECDSA signature length.");
  }
  const half = signature.length / 2;
  const r = signature.subarray(0, half);
  const s = signature.subarray(half);
  const rEnc = encodeAsn1Integer(r);
  const sEnc = encodeAsn1Integer(s);
  const totalLen = rEnc.length + sEnc.length;
  const lenEnc = encodeLength(totalLen);
  return Buffer.concat([Buffer.from([0x30]), lenEnc, rEnc, sEnc]);
}

function hashAlgForJwtAlg(alg: string): string {
  if (alg.endsWith("256")) return "sha256";
  if (alg.endsWith("384")) return "sha384";
  if (alg.endsWith("512")) return "sha512";
  return "sha256";
}

/* ------------------------------------------------------------------ */
/* JWKS cache + fetch                                                 */
/* ------------------------------------------------------------------ */

interface CachedJwks {
  jwks: JwksResponse;
  expiresAt: number;
}

const jwksCache = new Map<string, CachedJwks>();
const JWKS_TTL_MS = 10 * 60 * 1000; // 10 minutes
const JWKS_FETCH_TIMEOUT_MS = 5000;

function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

async function fetchJwks(supabaseUrl: string): Promise<JwksResponse> {
  const base = normalizeSupabaseUrl(supabaseUrl);
  const cacheKey = base;
  const cached = jwksCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.jwks;
  }

  const jwksUrl = `${base}/auth/v1/.well-known/jwks.json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JWKS_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(jwksUrl, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      throw new JwtError(
        "JWKS_FETCH_FAILED",
        `Could not fetch Supabase JWKS from ${jwksUrl} (HTTP ${res.status}). ` +
          `Check SUPABASE_URL and that your project allows this server to reach it.`
      );
    }
    const text = await res.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new JwtError("JWKS_MALFORMED", `Supabase JWKS endpoint returned invalid JSON: ${jwksUrl}`);
    }
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("keys" in payload) ||
      !Array.isArray((payload as { keys: unknown }).keys)
    ) {
      throw new JwtError("JWKS_MALFORMED", `Supabase JWKS endpoint did not return a {keys:[]} object: ${jwksUrl}`);
    }
    const jwks = payload as JwksResponse;
    jwksCache.set(cacheKey, { jwks, expiresAt: Date.now() + JWKS_TTL_MS });
    return jwks;
  } catch (error) {
    if (error instanceof JwtError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new JwtError("JWKS_TIMEOUT", `Timed out fetching Supabase JWKS from ${jwksUrl}.`);
    }
    throw new JwtError(
      "JWKS_FETCH_FAILED",
      `Failed to fetch Supabase JWKS from ${jwksUrl}: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    clearTimeout(timeout);
  }
}

function findJwkCandidates(jwks: JwksResponse, header: { alg?: string; kid?: string }): Jwk[] {
  const { alg, kid } = header;
  let candidates = jwks.keys;

  if (kid) {
    const byKid = candidates.filter((k) => k.kid === kid);
    if (byKid.length > 0) return byKid;
    // If kid specified but not found, fall through to alg filtering — some
    // providers omit kid on older tokens.
  }

  if (alg) {
    // Prefer keys that declare the same alg
    const byAlg = candidates.filter((k) => !k.alg || k.alg === alg);
    if (byAlg.length > 0) return byAlg;
  }

  return candidates;
}

function verifyAsymmetricSignature(
  alg: string,
  data: string,
  signature: Buffer,
  jwk: Jwk
): boolean {
  let publicKey;
  try {
    publicKey = createPublicKey({ key: jwk as unknown as Record<string, unknown>, format: "jwk" });
  } catch (error) {
    throw new JwtError(
      "BAD_JWK",
      `Could not create public key from JWK (kid=${jwk.kid ?? "unknown"}): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const hashAlg = hashAlgForJwtAlg(alg);
  const dataBuf = Buffer.from(data);

  // ECDSA needs DER conversion
  if (alg.startsWith("ES")) {
    let der: Buffer;
    try {
      der = joseToDer(signature);
    } catch (error) {
      throw error instanceof JwtError ? error : new JwtError("BAD_SIGNATURE", "Invalid ECDSA signature encoding.");
    }
    try {
      return verify(hashAlg, dataBuf, publicKey, der);
    } catch {
      return false;
    }
  }

  if (alg.startsWith("RS")) {
    try {
      return verify(hashAlg, dataBuf, publicKey, signature);
    } catch {
      return false;
    }
  }

  if (alg.startsWith("PS")) {
    // RSA-PSS
    try {
      return verify(
        hashAlg,
        dataBuf,
        {
          key: publicKey,
          padding: constants.RSA_PKCS1_PSS_PADDING,
          saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
        },
        signature
      );
    } catch {
      // Fallback to PKCS1 if PSS fails — some libs mislabel
      try {
        return verify(hashAlg, dataBuf, publicKey, signature);
      } catch {
        return false;
      }
    }
  }

  // Unknown asymmetric alg — try generic verify
  try {
    return verify(hashAlg, dataBuf, publicKey, signature);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Core verification                                                  */
/* ------------------------------------------------------------------ */

export interface VerifyOptions {
  /** Legacy symmetric secret (HS256). */
  secret?: string;
  /** Supabase project URL, e.g. https://xyz.supabase.co — used to fetch JWKS for ES256/RS256. */
  supabaseUrl?: string;
  /** Pre-fetched JWKS to avoid a network call (useful in tests). */
  jwks?: JwksResponse;
  /** If true, skip expiry check (useful for testing). */
  ignoreExpiry?: boolean;
}

function decodeHeader(headerSegment: string): { alg?: string; kid?: string; typ?: string } {
  try {
    return JSON.parse(base64UrlDecode(headerSegment).toString("utf8"));
  } catch {
    throw new JwtError("MALFORMED", "The token header is not valid JSON.");
  }
}

function decodeClaims(payloadSegment: string): JwtClaims {
  try {
    return JSON.parse(base64UrlDecode(payloadSegment).toString("utf8")) as JwtClaims;
  } catch {
    throw new JwtError("MALFORMED", "The token payload is not valid JSON.");
  }
}

/** Verify signature + expiry. Throws `JwtError` when the token is unusable. */
export async function verifyJwt(token: string, options: VerifyOptions = {}): Promise<JwtClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwtError("MALFORMED", "The token is not a valid JWT.");
  }
  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const header = decodeHeader(headerSegment);
  const alg = header.alg ?? "HS256";

  const data = `${headerSegment}.${payloadSegment}`;
  const signature = base64UrlDecode(signatureSegment);

  if (alg === "HS256") {
    if (!options.secret) {
      throw new JwtError(
        "MISSING_SECRET",
        "The token is signed with HS256 but SUPABASE_JWT_SECRET is not set on the server. " +
          "For new Supabase projects that use ES256, set SUPABASE_URL so the server can fetch the JWKS, " +
          "or set SUPABASE_JWT_SECRET to the legacy symmetric secret if you still use it."
      );
    }
    const expected = hmac(options.secret, data);
    if (expected.length !== signature.length || !timingSafeEqual(expected, signature)) {
      throw new JwtError("BAD_SIGNATURE", "The token signature does not match this project (HS256 mismatch).");
    }
  } else if (alg === "none") {
    throw new JwtError("UNSUPPORTED_ALG", "The token uses 'none' algorithm and cannot be accepted.");
  } else if (/^(ES|RS|PS)(256|384|512)$/.test(alg)) {
    // Asymmetric path — need JWKS
    let jwks: JwksResponse | undefined = options.jwks;
    if (!jwks) {
      if (!options.supabaseUrl) {
        throw new JwtError(
          "JWKS_REQUIRED",
          `The token is signed with ${alg} but no JWKS is available. ` +
            "Set SUPABASE_URL on the server so it can fetch " +
            "{SUPABASE_URL}/auth/v1/.well-known/jwks.json, or provide SUPABASE_JWT_SECRET for legacy HS256 tokens."
        );
      }
      jwks = await fetchJwks(options.supabaseUrl);
    }

    const candidates = findJwkCandidates(jwks, header);
    if (candidates.length === 0) {
      throw new JwtError(
        "JWK_NOT_FOUND",
        `No matching JWK found for token (alg=${alg}, kid=${header.kid ?? "none"}). ` +
          "The JWKS endpoint may not contain the signing key — try waiting a minute and retrying, or check that SUPABASE_URL is correct."
      );
    }

    let verified = false;
    let lastError: unknown = undefined;
    for (const jwk of candidates) {
      try {
        if (verifyAsymmetricSignature(alg, data, signature, jwk)) {
          verified = true;
          break;
        }
      } catch (e) {
        lastError = e;
        // Try next candidate
      }
    }

    if (!verified) {
      if (lastError instanceof JwtError) throw lastError;
      throw new JwtError(
        "BAD_SIGNATURE",
        `The token signature does not match any JWK (alg=${alg}, kid=${header.kid ?? "none"}). ` +
          "The token may be from a different Supabase project, or the JWKS cache is stale."
      );
    }
  } else {
    throw new JwtError("UNSUPPORTED_ALG", `Unsupported token algorithm: ${alg}. Expected HS256, RS256, or ES256.`);
  }

  const claims = decodeClaims(payloadSegment);

  if (!options.ignoreExpiry && typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) {
    throw new JwtError("EXPIRED", "The session expired. Sign in again.");
  }

  return claims;
}

/** Synchronous HS256-only verification — kept for backwards compat and tests. */
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

/** For testing — clear the in-memory JWKS cache. */
export function clearJwksCache(): void {
  jwksCache.clear();
}
