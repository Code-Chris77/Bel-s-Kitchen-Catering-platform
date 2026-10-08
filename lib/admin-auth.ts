import { env } from "cloudflare:workers";
import { cookieValue, hmacSign, hmacVerify, sameText } from "@/lib/crypto";

const COOKIE_NAME = "bels_admin_session";
const SESSION_SECONDS = 12 * 60 * 60;

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
  const payload = `v1.${expires}`;
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

    return await hmacVerify(`${version}.${expiresText}`, signature, secret);
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
