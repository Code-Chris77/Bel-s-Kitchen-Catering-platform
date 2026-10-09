import { adminUnauthorizedResponse, hasAdminSession } from "@/lib/admin-auth";
import { logError } from "@/lib/log";
import { STAFF_PASSWORD_MAX, STAFF_PASSWORD_MIN, createStaff, listStaff, updateStaff } from "@/lib/staff";

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= STAFF_PASSWORD_MIN && value.length <= STAFF_PASSWORD_MAX;
}

const PASSWORD_ERROR = `Use a password between ${STAFF_PASSWORD_MIN} and ${STAFF_PASSWORD_MAX} characters.`;

export async function GET(request: Request) {
  if (!(await hasAdminSession(request))) return adminUnauthorizedResponse();
  try {
    return Response.json({ staff: await listStaff() });
  } catch (error) {
    logError("admin_staff_list_failed", error);
    return Response.json({ error: "Staff could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await hasAdminSession(request))) return adminUnauthorizedResponse();
  try {
    const payload = (await request.json()) as { name?: string; password?: string };
    const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 60) : "";
    if (!name) return Response.json({ error: "Enter the staff member's name." }, { status: 400 });
    if (!validPassword(payload.password)) return Response.json({ error: PASSWORD_ERROR }, { status: 400 });

    const existing = await listStaff();
    if (existing.some((member) => member.name.toLowerCase() === name.toLowerCase())) {
      return Response.json({ error: "A staff member with that name already exists." }, { status: 409 });
    }
    return Response.json({ staff: await createStaff(name, payload.password) }, { status: 201 });
  } catch (error) {
    logError("admin_staff_create_failed", error);
    return Response.json({ error: "The staff account could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await hasAdminSession(request))) return adminUnauthorizedResponse();
  try {
    const payload = (await request.json()) as { id?: number; active?: boolean; password?: string };
    if (!Number.isInteger(payload.id)) return Response.json({ error: "Choose a staff member." }, { status: 400 });
    if (payload.password !== undefined && !validPassword(payload.password)) {
      return Response.json({ error: PASSWORD_ERROR }, { status: 400 });
    }
    const updated = await updateStaff(payload.id as number, {
      active: typeof payload.active === "boolean" ? payload.active : undefined,
      password: payload.password,
    });
    if (!updated) return Response.json({ error: "Nothing to update." }, { status: 400 });
    return Response.json({ staff: updated });
  } catch (error) {
    logError("admin_staff_update_failed", error);
    return Response.json({ error: "The staff account could not be updated." }, { status: 500 });
  }
}
