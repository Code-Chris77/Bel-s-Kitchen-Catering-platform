import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { staff } from "@/db/schema";
import {
  PBKDF2_ITERATIONS,
  base64UrlToBytes,
  bytesToBase64Url,
  pbkdf2Hash,
  randomToken,
  sameText,
} from "@/lib/crypto";

export type StaffRow = typeof staff.$inferSelect;

export const STAFF_PASSWORD_MIN = 8;
export const STAFF_PASSWORD_MAX = 80;

async function newCredentials(password: string) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return {
    salt: bytesToBase64Url(salt),
    passwordHash: await pbkdf2Hash(password, salt),
    iterations: PBKDF2_ITERATIONS,
    sessionVersion: randomToken(12),
  };
}

export async function listStaff() {
  return getDb()
    .select({ id: staff.id, name: staff.name, active: staff.active, createdAt: staff.createdAt })
    .from(staff)
    .orderBy(asc(staff.name));
}

export async function hasActiveStaff() {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(staff)
    .where(eq(staff.active, true));
  return Number(row?.count ?? 0) > 0;
}

export async function createStaff(name: string, password: string) {
  const [row] = await getDb()
    .insert(staff)
    .values({ name, ...(await newCredentials(password)) })
    .returning({ id: staff.id, name: staff.name, active: staff.active, createdAt: staff.createdAt });
  return row;
}

/** Disabling or resetting a password ends that person's open sessions. */
export async function updateStaff(id: number, changes: { active?: boolean; password?: string }) {
  const set: Partial<typeof staff.$inferInsert> = {};
  if (changes.active !== undefined) {
    set.active = changes.active;
    set.sessionVersion = randomToken(12);
  }
  if (changes.password !== undefined) Object.assign(set, await newCredentials(changes.password));
  if (Object.keys(set).length === 0) return null;
  const [row] = await getDb()
    .update(staff)
    .set(set)
    .where(eq(staff.id, id))
    .returning({ id: staff.id, name: staff.name, active: staff.active, createdAt: staff.createdAt });
  return row ?? null;
}

export async function findStaffById(id: number) {
  const [row] = await getDb().select().from(staff).where(eq(staff.id, id)).limit(1);
  return row ?? null;
}

const DUMMY_SALT = new Uint8Array(16);

/** Checks a staff name and password; spends the same time whether or not the name exists. */
export async function verifyStaff(name: string, password: string) {
  const [row] = await getDb()
    .select()
    .from(staff)
    .where(sql`lower(${staff.name}) = ${name.trim().toLowerCase()}`)
    .limit(1);
  const salt = row ? base64UrlToBytes(row.salt) : DUMMY_SALT;
  const hash = await pbkdf2Hash(password, salt, row?.iterations ?? PBKDF2_ITERATIONS);
  const matches = await sameText(hash, row?.passwordHash ?? "");
  return row && row.active && matches ? row : null;
}
