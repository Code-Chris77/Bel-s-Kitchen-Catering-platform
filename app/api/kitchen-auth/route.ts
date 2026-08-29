import {
  checkKitchenPassword,
  clearKitchenSessionCookie,
  createKitchenSessionCookie,
  hasKitchenSession,
} from "@/lib/kitchen-auth";

export async function GET(request: Request) {
  return Response.json({ authenticated: await hasKitchenSession(request) });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { password?: string };
    const password = typeof payload.password === "string" ? payload.password.slice(0, 160) : "";
    if (!password || !(await checkKitchenPassword(password))) {
      return Response.json({ error: "The kitchen password is incorrect." }, { status: 401 });
    }

    return new Response(JSON.stringify({ authenticated: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": await createKitchenSessionCookie(),
      },
    });
  } catch {
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
