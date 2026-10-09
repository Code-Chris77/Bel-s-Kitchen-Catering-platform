import {
  clearKitchenSessionCookie,
  createKitchenSessionCookie,
  getKitchenSession,
  kitchenRequiresStaffLogin,
  signInKitchen,
} from "@/lib/kitchen-auth";
import { logError } from "@/lib/log";
import { LOGIN_LIMIT, allowRequest, tooManyRequests } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await getKitchenSession(request);
  return Response.json({
    authenticated: session !== null,
    actor: session?.actor ?? null,
    staffRequired: await kitchenRequiresStaffLogin(),
  });
}

export async function POST(request: Request) {
  if (!(await allowRequest(request, LOGIN_LIMIT))) return tooManyRequests(LOGIN_LIMIT);

  try {
    const payload = (await request.json()) as { name?: string; password?: string };
    const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 60) : "";
    const password = typeof payload.password === "string" ? payload.password.slice(0, 160) : "";
    const session = password ? await signInKitchen(name, password) : null;
    if (!session) {
      return Response.json({ error: "The name or kitchen password is incorrect." }, { status: 401 });
    }

    return new Response(JSON.stringify({ authenticated: true, actor: session.actor }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": await createKitchenSessionCookie(session),
      },
    });
  } catch (error) {
    logError("kitchen_login_failed", error);
    return Response.json(
      { error: "Kitchen access is not available. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  return new Response(JSON.stringify({ authenticated: false }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearKitchenSessionCookie(),
    },
  });
}
