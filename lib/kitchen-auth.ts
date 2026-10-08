import { env } from "cloudflare:workers";
import { getD1 } from "@/db";
import {
  PBKDF2_ITERATIONS,
  base64UrlToBytes,
  bytesToBase64Url,
  cookieValue,
  hmacSign,
  hmacVerify,
  pbkdf2Hash,
  randomToken,
  sameText,
} from "@/lib/crypto";

const COOKIE_NAME = "bels_kitchen_session";
const SESSION_SECONDS = 8 * 60 * 60;

/**
 * `hmac-sha256-v1` records were written by earlier versions and are still
 * accepted. New passwords are stored as salted PBKDF2 (`pbkdf2-sha256-v1`),
 * which does not depend on the session secret.
 */
type KitchenPasswordRecord = {
  salt: string;
  hash: string;
  version: string;
  algorithm: "hmac-sha256-v1" | "pbkdf2-sha256-v1";
  iterations?: number;
};

async function kitchenPasswordRecord() {
  const row = await getD1()
    .prepare("SELECT value FROM restaurant_settings WHERE key = ? LIMIT 1")
    .bind("kitchen_password_record")
    .first<{ value: string }>();
  if (!row?.value) return null;

  try {
    const record = JSON.parse(row.value) as KitchenPasswordRecord;
    if (
      !record.salt ||
      !record.hash ||
      !record.version ||
      (record.algorithm !== "hmac-sha256-v1" && record.algorithm !== "pbkdf2-sha256-v1")
    ) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

async function hashLegacyKitchenPassword(password: string, salt: Uint8Array) {
  const secret = env.KITCHEN_SESSION_SECRET;
  if (!secret) throw new Error("Kitchen session secret is not configured");
  return hmacSign(`${bytesToBase64Url(salt)}:${password}`, secret);
}

export async function checkKitchenPassword(candidate: string) {
  const record = await kitchenPasswordRecord();
  if (record) {
    const salt = base64UrlToBytes(record.salt);
    const candidateHash =
      record.algorithm === "pbkdf2-sha256-v1"
        ? await pbkdf2Hash(candidate, salt, record.iterations ?? PBKDF2_ITERATIONS)
        : await hashLegacyKitchenPassword(candidate, salt);
    return sameText(candidateHash, record.hash);
  }

  const password = env.KITCHEN_PASSWORD;
  if (!password) throw new Error("Kitchen password is not configured");
  return sameText(candidate, password);
}

export async function setKitchenPassword(password: string) {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const record: KitchenPasswordRecord = {
    salt: bytesToBase64Url(saltBytes),
    hash: await pbkdf2Hash(password, saltBytes),
    version: randomToken(12),
    algorithm: "pbkdf2-sha256-v1",
    iterations: PBKDF2_ITERATIONS,
  };

  await getD1()
    .prepare(
      `INSERT INTO restaurant_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    )
    .bind("kitchen_password_record", JSON.stringify(record))
    .run();
}

async function kitchenPasswordVersion() {
  return (await kitchenPasswordRecord())?.version ?? "environment-v1";
}

export async function createKitchenSessionCookie() {
  const secret = env.KITCHEN_SESSION_SECRET;
  if (!secret) throw new Error("Kitchen session secret is not configured");

  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const passwordVersion = await kitchenPasswordVersion();
  const payload = `v2.${expires}.${passwordVersion}`;
  const signature = await hmacSign(payload, secret);
  return `${COOKIE_NAME}=${payload}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`;
}

export function clearKitchenSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function hasKitchenSession(request: Request) {
  try {
    const secret = env.KITCHEN_SESSION_SECRET;
    if (!secret) return false;

    const value = cookieValue(request, COOKIE_NAME);
    const [version, expiresText, passwordVersion, signature] = value.split(".");
    const expires = Number(expiresText);
    if (
      version !== "v2" ||
      !Number.isInteger(expires) ||
      expires <= Math.floor(Date.now() / 1000) ||
      !passwordVersion ||
      !signature ||
      passwordVersion !== (await kitchenPasswordVersion())
    ) {
      return false;
    }

    return await hmacVerify(`${version}.${expiresText}.${passwordVersion}`, signature, secret);
  } catch {
    return false;
  }
}

export function kitchenUnauthorizedResponse() {
  return Response.json(
    { error: "Enter the kitchen password to view and update the queue." },
    { status: 401 },
  );
}
