import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { restaurantSettings } from "@/db/schema";

export async function getSetting(key: string) {
  const [row] = await getDb()
    .select({ value: restaurantSettings.value })
    .from(restaurantSettings)
    .where(eq(restaurantSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await getDb()
    .insert(restaurantSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: restaurantSettings.key,
      set: { value, updatedAt: sql`CURRENT_TIMESTAMP` },
    });
}
