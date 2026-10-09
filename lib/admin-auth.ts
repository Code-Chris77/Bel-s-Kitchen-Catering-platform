import { env } from "cloudflare:workers";
import { cookieValue, hmacSign, hmacVerify, randomToken, sameText } from "@/lib/crypto";
import { getSetting, setSetting } from "@/lib/settings";

const COOKIE_NAME = "bels_admin_session";
const SESSION_SECONDS = 12 * 60 * 60;
const VERSION_KEY = "admin_session_version";

async function adminSessionVersion() {
  return (await getSetting(VERSION_KEY)) ?? "1";
}

/** Ends every open admin session (all devices) by changing the version stored in each cookie. */
export async function signOutAllAdminSessions() {
  await setSetting(VERSION_KEY, randomToken(12));
}

export async function checkAdminCredentials(email: string, password: string) {
  const configuredEmail = env.ADMIN_EMAIL;
  const configuredPassword = env.ADMIN_PASSWORD;
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
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Admin session secret is not configured");

  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `v2.${expires}.${await adminSessionVersion()}`;
  const signature = await hmacSign(payload, secret);
  return `${COOKIE_NAME}=${payload}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`;
}

export function clearAdminSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function hasAdminSession(request: Request) {
  try {
    const secret = env.ADMIN_SESSION_SECRET;
    if (!secret) return false;

    const value = cookieValue(request, COOKIE_NAME);
    const [version, expiresText, sessionVersion, signature] = value.split(".");
    const expires = Number(expiresText);
    if (
      version !== "v2" ||
      !Number.isInteger(expires) ||
      expires <= Math.floor(Date.now() / 1000) ||
      !sessionVersion ||
      !signature ||
      sessionVersion !== (await adminSessionVersion())
    ) {
      return false;
    }

    return await hmacVerify(`${version}.${expiresText}.${sessionVersion}`, signature, secret);
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
