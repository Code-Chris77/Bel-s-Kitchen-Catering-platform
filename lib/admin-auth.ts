import { env } from "cloudflare:workers";

const COOKIE_NAME = "bels_admin_session";
const SESSION_SECONDS = 12 * 60 * 60;

type AdminEnvironment = {
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
};

function adminEnvironment(): AdminEnvironment {
  const e = (env as unknown as AdminEnvironment) || {};
  const p = typeof process !== "undefined" ? (process.env as unknown as AdminEnvironment) : {};

  return {
    ADMIN_EMAIL: e.ADMIN_EMAIL || p.ADMIN_EMAIL,
    ADMIN_PASSWORD: e.ADMIN_PASSWORD || p.ADMIN_PASSWORD,
    ADMIN_SESSION_SECRET: e.ADMIN_SESSION_SECRET || p.ADMIN_SESSION_SECRET,
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

function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

export async function checkAdminCredentials(email: string, password: string) {
  const configuredEmail = adminEnvironment().ADMIN_EMAIL;
  const configuredPassword = adminEnvironment().ADMIN_PASSWORD;
  if (!configuredEmail || !configuredPassword) {
    throw new Error("Admin credentials are not configured");
  }

  const [emailMatches, passwordMatches] = await Promise.all([
    sameText(email.trim().toLowerCase(), configuredEmail.trim().toLowerCase()),
    sameText(password, configuredPassword),
  ]);
  return emailMatches && passwordMatches;
}

export async function createAdminSessionCookie() {
  const secret = adminEnvironment().ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Admin session secret is not configured");

  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `v1.${expires}`;
  const signature = await sign(payload, secret);
  return `${COOKIE_NAME}=${payload}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`;
}

export function clearAdminSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function hasAdminSession(request: Request) {
  try {
    const secret = adminEnvironment().ADMIN_SESSION_SECRET;
    if (!secret) return false;

    const value = cookieValue(request, COOKIE_NAME);
    const [version, expiresText, signature] = value.split(".");
    const expires = Number(expiresText);
    if (
      version !== "v1" ||
      !Number.isInteger(expires) ||
      expires <= Math.floor(Date.now() / 1000) ||
      !signature
    ) {
      return false;
    }

    return crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      base64UrlToBytes(signature),
      new TextEncoder().encode(`${version}.${expiresText}`),
    );
  } catch {
    return false;
  }
}

export function adminUnauthorizedResponse() {
  return Response.json(
    { error: "Sign in with the restaurant administrator account." },
    { status: 401 },
  );
}
