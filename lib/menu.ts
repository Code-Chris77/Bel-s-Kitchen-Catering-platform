import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deliveryZones, menuItems, priceTiers } from "@/db/schema";

export type MenuItem = typeof menuItems.$inferSelect;
export type DeliveryZoneRow = typeof deliveryZones.$inferSelect;

export type MenuData = {
  items: MenuItem[];
  prices: number[];
  zones: DeliveryZoneRow[];
};

/** Everything a customer can currently order (inactive entries hidden). */
export async function getMenu(): Promise<MenuData> {
  const db = getDb();
  const [items, tiers, zones] = await db.batch([
    db.select().from(menuItems).where(eq(menuItems.active, true)).orderBy(asc(menuItems.sortOrder), asc(menuItems.id)),
    db.select().from(priceTiers).where(eq(priceTiers.active, true)).orderBy(asc(priceTiers.amount)),
    db.select().from(deliveryZones).where(eq(deliveryZones.active, true)).orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.id)),
  ]);
  return { items, prices: tiers.map((tier) => tier.amount), zones };
}

/** Everything, including hidden entries, for the admin editor. */
export async function getFullMenu() {
  const db = getDb();
  const [items, tiers, zones] = await db.batch([
    db.select().from(menuItems).orderBy(asc(menuItems.sortOrder), asc(menuItems.id)),
    db.select().from(priceTiers).orderBy(asc(priceTiers.amount)),
    db.select().from(deliveryZones).orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.id)),
  ]);
  return { items, tiers, zones };
}
