import {
  checkAdminCredentials,
  clearAdminSessionCookie,
  createAdminSessionCookie,
  hasAdminSession,
} from "@/lib/admin-auth";

export async function GET(request: Request) {
  return Response.json({ authenticated: await hasAdminSession(request) });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { email?: string; password?: string };
    const email = typeof payload.email === "string" ? payload.email.slice(0, 180) : "";
    const password = typeof payload.password === "string" ? payload.password.slice(0, 200) : "";

    if (!email || !password || !(await checkAdminCredentials(email, password))) {
      return Response.json({ error: "The restaurant email or password is incorrect." }, { status: 401 });
    }

    return new Response(JSON.stringify({ authenticated: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": await createAdminSessionCookie(),
      },
    });
  } catch {
    return Response.json(
      { error: "Administrator access is unavailable. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  return new Response(JSON.stringify({ authenticated: false }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearAdminSessionCookie(),
    },
  });
}
