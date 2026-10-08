import { env } from "cloudflare:workers";
import { hmacSign, sha256Hex } from "@/lib/crypto";

function trackingSecret() {
  const secret = env.TRACKING_SECRET || env.KITCHEN_SESSION_SECRET;
  if (!secret) throw new Error("Tracking secret is not configured");
  return secret;
}

export function createTrackingCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

/** Keyed hash stored with the order, so a leaked database cannot be reversed offline. */
export async function hashTrackingCode(code: string) {
  return `v2:${await hmacSign(`tracking:${code}`, trackingSecret())}`;
}

/** Hash used by orders created before keyed hashing was introduced. */
export function legacyHashTrackingCode(code: string) {
  return sha256Hex(code);
}
