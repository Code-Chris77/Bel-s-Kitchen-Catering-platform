import { env } from "cloudflare:workers";
import { getD1 } from "@/db";

const COOKIE_NAME = "bels_kitchen_session";
const SESSION_SECONDS = 8 * 60 * 60;

type KitchenEnvironment = {
  KITCHEN_PASSWORD?: string;
  KITCHEN_SESSION_SECRET?: string;
};

type KitchenPasswordRecord = {
  salt: string;
  hash: string;
  version: string;
  algorithm: "hmac-sha256-v1";
};

function kitchenEnvironment(): KitchenEnvironment {
  const e = (env as unknown as KitchenEnvironment) || {};
  const p = typeof process !== "undefined" ? (process.env as unknown as KitchenEnvironment) : {};

  return {
    KITCHEN_PASSWORD: e.KITCHEN_PASSWORD || p.KITCHEN_PASSWORD,
    KITCHEN_SESSION_SECRET: e.KITCHEN_SESSION_SECRET || p.KITCHEN_SESSION_SECRET,
  };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(value: string, secret: string) {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

async function sameText(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all(
    [left, right].map((value) =>
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  );
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function hashKitchenPassword(password: string, salt: Uint8Array) {
  const secret = kitchenEnvironment().KITCHEN_SESSION_SECRET;
  if (!secret) throw new Error("Kitchen session secret is not configured");
  const saltText = bytesToBase64Url(salt);
  return sign(`${saltText}:${password}`, secret);
}

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
      record.algorithm !== "hmac-sha256-v1"
    ) return null;
    return record;
  } catch {
    return null;
  }
}

function randomToken(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function getKitchenDatabase() {
  const database = getD1() as unknown as {
    prepare: (query: string) => {
      bind: (...args: unknown[]) => {
        first: <T>() => Promise<T | null>;
        run: () => Promise<unknown>;
      };
    };
  };

  if (typeof database.prepare !== "function") {
    throw new Error("Kitchen database is not configured");
  }

  return database;
}

function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

export async function checkKitchenPassword(candidate: string) {
  const record = await kitchenPasswordRecord();
  if (record) {
    const candidateHash = await hashKitchenPassword(candidate, base64UrlToBytes(record.salt));
    return sameText(candidateHash, record.hash);
  }

  const password = kitchenEnvironment().KITCHEN_PASSWORD;
  if (!password) throw new Error("Kitchen password is not configured");
  return sameText(candidate, password);
}

export async function setKitchenPassword(password: string) {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const record: KitchenPasswordRecord = {
    salt: bytesToBase64Url(saltBytes),
    hash: await hashKitchenPassword(password, saltBytes),
    version: randomToken(12),
    algorithm: "hmac-sha256-v1",
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
  const secret = kitchenEnvironment().KITCHEN_SESSION_SECRET;
  if (!secret) throw new Error("Kitchen session secret is not configured");

  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const passwordVersion = await kitchenPasswordVersion();
  const payload = `v2.${expires}.${passwordVersion}`;
  const signature = await sign(payload, secret);
  return `${COOKIE_NAME}=${payload}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`;
}

export function clearKitchenSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function hasKitchenSession(request: Request) {
  try {
    const secret = kitchenEnvironment().KITCHEN_SESSION_SECRET;
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

    const payload = `${version}.${expiresText}.${passwordVersion}`;
    return crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      base64UrlToBytes(signature),
      new TextEncoder().encode(payload),
    );
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
