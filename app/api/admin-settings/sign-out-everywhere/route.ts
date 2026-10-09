import { adminUnauthorizedResponse, clearAdminSessionCookie, hasAdminSession, signOutAllAdminSessions } from "@/lib/admin-auth";
import { logError } from "@/lib/log";

/** Ends every admin session on every device, including this one. */
export async function POST(request: Request) {
  if (!(await hasAdminSession(request))) return adminUnauthorizedResponse();
  try {
    await signOutAllAdminSessions();
    return new Response(JSON.stringify({ signedOut: true }), {
      headers: { "Content-Type": "application/json", "Set-Cookie": clearAdminSessionCookie() },
    });
  } catch (error) {
    logError("admin_sign_out_all_failed", error);
    return Response.json({ error: "Sessions could not be ended. Please try again." }, { status: 500 });
  }
}
