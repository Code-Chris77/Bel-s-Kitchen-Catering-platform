import { adminUnauthorizedResponse, hasAdminSession } from "@/lib/admin-auth";
import { setKitchenPassword } from "@/lib/kitchen-auth";

export async function PATCH(request: Request) {
  if (!(await hasAdminSession(request))) return adminUnauthorizedResponse();

  try {
    const payload = (await request.json()) as { password?: string };
    const password = typeof payload.password === "string" ? payload.password : "";

    if (password.length < 8 || password.length > 80) {
      return Response.json(
        { error: "Use a kitchen password between 8 and 80 characters." },
        { status: 400 },
      );
    }

    await setKitchenPassword(password);
    return Response.json({ updated: true });
  } catch (error) {
    console.error(
      "Kitchen password update failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      { error: "The kitchen password could not be securely saved. Please try again." },
      { status: 500 },
    );
  }
}
