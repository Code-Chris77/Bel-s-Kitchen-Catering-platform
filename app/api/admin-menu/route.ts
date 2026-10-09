import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deliveryZones, menuItems, priceTiers } from "@/db/schema";
import { adminUnauthorizedResponse, hasAdminSession } from "@/lib/admin-auth";
import { logError } from "@/lib/log";
import { getFullMenu } from "@/lib/menu";

type Payload = {
  items?: Array<{ id?: string; name?: string; note?: string; accent?: string; active?: boolean; sortOrder?: number }>;
  tiers?: Array<{ amount?: number; active?: boolean }>;
  zones?: Array<{ id?: string; label?: string; fee?: number; active?: boolean; sortOrder?: number }>;
};

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const wholeNumber = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;

function slug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "zone";
}

export async function GET(request: Request) {
  if (!(await hasAdminSession(request))) return adminUnauthorizedResponse();
  try {
    return Response.json(await getFullMenu());
  } catch (error) {
    logError("admin_menu_load_failed", error);
    return Response.json({ error: "The menu could not be loaded." }, { status: 500 });
  }
}

/**
 * Replaces menu text/visibility, price tiers and delivery zones. Nothing is deleted:
 * hiding an entry keeps old orders and receipts intact.
 */
export async function PUT(request: Request) {
  if (!(await hasAdminSession(request))) return adminUnauthorizedResponse();

  try {
    const payload = (await request.json()) as Payload;
    const current = await getFullMenu();
    const knownItems = new Set(current.items.map((item) => item.id));
    const knownZones = new Set(current.zones.map((zone) => zone.id));

    const items = (payload.items ?? []).map((item) => ({
      id: text(item.id, 40),
      name: text(item.name, 60),
      note: text(item.note, 160),
      accent: text(item.accent, 60),
      active: item.active !== false,
      sortOrder: wholeNumber(item.sortOrder, 0, 999) ?? 0,
    }));
    if (items.some((item) => !knownItems.has(item.id) || !item.name)) {
      return Response.json({ error: "Every meal needs a name." }, { status: 400 });
    }
    if (items.length > 0 && !items.some((item) => item.active)) {
      return Response.json({ error: "Keep at least one meal on the menu." }, { status: 400 });
    }

    const tiers = (payload.tiers ?? []).map((tier) => ({
      amount: wholeNumber(tier.amount, 1, 1000),
      active: tier.active !== false,
    }));
    if (tiers.some((tier) => tier.amount === null) || new Set(tiers.map((tier) => tier.amount)).size !== tiers.length) {
      return Response.json({ error: "Prices must be different whole numbers between 1 and 1000." }, { status: 400 });
    }
    if (payload.tiers && !tiers.some((tier) => tier.active)) {
      return Response.json({ error: "Keep at least one price available." }, { status: 400 });
    }

    const zones = (payload.zones ?? []).map((zone) => ({
      id: text(zone.id, 40),
      label: text(zone.label, 40),
      fee: wholeNumber(zone.fee, 0, 1000),
      active: zone.active !== false,
      sortOrder: wholeNumber(zone.sortOrder, 0, 999) ?? 0,
    }));
    if (zones.some((zone) => !zone.label || zone.fee === null || (zone.id && !knownZones.has(zone.id)))) {
      return Response.json({ error: "Every delivery area needs a name and a fee." }, { status: 400 });
    }

    const db = getDb();
    const taken = new Set(knownZones);
    const statements = [
      ...items.map((item) =>
        db.update(menuItems).set({ name: item.name, note: item.note, accent: item.accent, active: item.active, sortOrder: item.sortOrder }).where(eq(menuItems.id, item.id)),
      ),
      ...tiers.map((tier) =>
        db.insert(priceTiers).values({ amount: tier.amount as number, active: tier.active }).onConflictDoUpdate({ target: priceTiers.amount, set: { active: tier.active } }),
      ),
      ...zones.map((zone) => {
        let id = zone.id;
        if (!id) {
          const base = slug(zone.label);
          id = base;
          for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
          taken.add(id);
        }
        return db
          .insert(deliveryZones)
          .values({ id, label: zone.label, fee: zone.fee as number, active: zone.active, sortOrder: zone.sortOrder })
          .onConflictDoUpdate({
            target: deliveryZones.id,
            set: { label: zone.label, fee: zone.fee as number, active: zone.active, sortOrder: zone.sortOrder },
          });
      }),
    ];
    if (statements.length > 0) {
      await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
    }

    return Response.json(await getFullMenu());
  } catch (error) {
    logError("admin_menu_update_failed", error);
    return Response.json({ error: "The menu could not be saved. Please try again." }, { status: 500 });
  }
}

