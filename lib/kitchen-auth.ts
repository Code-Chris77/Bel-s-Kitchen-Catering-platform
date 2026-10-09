import { env } from "cloudflare:workers";
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
import { findStaffById, hasActiveStaff, verifyStaff } from "@/lib/staff";
import { getSetting, setSetting } from "@/lib/settings";

const COOKIE_NAME = "bels_kitchen_session";
const SESSION_SECONDS = 8 * 60 * 60;
const PASSWORD_RECORD_KEY = "kitchen_password_record";

/** Who is signed in to the kitchen: a named staff member, or the shared password. */
export type KitchenSession = { actor: string; staffId: number | null };

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
  const value = await getSetting(PASSWORD_RECORD_KEY);
  if (!value) return null;

  try {
    const record = JSON.parse(value) as KitchenPasswordRecord;
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

async function checkSharedPassword(candidate: string) {
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

/** True once the admin has created staff accounts; the shared password then stops working. */
export function kitchenRequiresStaffLogin() {
  return hasActiveStaff();
}

/** Signs a kitchen user in, returning their session identity or null when the details are wrong. */
export async function signInKitchen(name: string, password: string): Promise<KitchenSession | null> {
  if (await kitchenRequiresStaffLogin()) {
    const member = name ? await verifyStaff(name, password) : null;
    return member ? { actor: member.name, staffId: member.id } : null;
  }
  return (await checkSharedPassword(password)) ? { actor: "kitchen", staffId: null } : null;
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
  await setSetting(PASSWORD_RECORD_KEY, JSON.stringify(record));
}

async function sharedPasswordVersion() {
  return (await kitchenPasswordRecord())?.version ?? "environment-v1";
}

export async function createKitchenSessionCookie(session: KitchenSession) {
  const secret = env.KITCHEN_SESSION_SECRET;
  if (!secret) throw new Error("Kitchen session secret is not configured");

  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  let payload: string;
  if (session.staffId !== null) {
    const member = await findStaffById(session.staffId);
    if (!member) throw new Error("Staff account not found");
    payload = `v3.${expires}.${member.id}.${member.sessionVersion}`;
  } else {
    payload = `v2.${expires}.${await sharedPasswordVersion()}`;
  }
  const signature = await hmacSign(payload, secret);
  return `${COOKIE_NAME}=${payload}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`;
}

export function clearKitchenSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/** The signed-in kitchen user for this request, or null. */
export async function getKitchenSession(request: Request): Promise<KitchenSession | null> {
  try {
    const secret = env.KITCHEN_SESSION_SECRET;
    if (!secret) return null;

    const parts = cookieValue(request, COOKIE_NAME).split(".");
    const [version, expiresText] = parts;
    const expires = Number(expiresText);
    if (!Number.isInteger(expires) || expires <= Math.floor(Date.now() / 1000)) return null;

    const signature = parts[parts.length - 1];
    const payload = parts.slice(0, -1).join(".");
    if (!signature || !(await hmacVerify(payload, signature, secret))) return null;

    if (version === "v3" && parts.length === 5) {
      const member = await findStaffById(Number(parts[2]));
      if (!member || !member.active || member.sessionVersion !== parts[3]) return null;
      return { actor: member.name, staffId: member.id };
    }

    if (version === "v2" && parts.length === 4) {
      // Shared-password sessions end as soon as staff accounts exist or the password changes.
      if (parts[2] !== (await sharedPasswordVersion()) || (await kitchenRequiresStaffLogin())) return null;
      return { actor: "kitchen", staffId: null };
    }
    return null;
  } catch {
    return null;
  }
}

export async function hasKitchenSession(request: Request) {
  return (await getKitchenSession(request)) !== null;
}

export function kitchenUnauthorizedResponse() {
  return Response.json(
    { error: "Enter the kitchen password to view and update the queue." },
    { status: 401 },
  );
}
