import { sql } from "drizzle-orm";
import { ORDER_STATUSES, ORDER_TYPES, PAYMENT_METHODS } from "../lib/domain";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderType: text("order_type", { enum: ORDER_TYPES }).notNull(),
  status: text("status", { enum: ORDER_STATUSES }).notNull().default("received"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  deliveryZone: text("delivery_zone"),
  deliveryLocation: text("delivery_location"),
  deliveryFee: integer("delivery_fee").notNull().default(0),
  subtotal: integer("subtotal").notNull(),
  total: integer("total").notNull(),
  paymentMethod: text("payment_method", { enum: PAYMENT_METHODS }).notNull(),
  paymentStatus: text("payment_status").notNull().default("demo_paid"),
  trackingCodeHash: text("tracking_code_hash").notNull().default(""),
  customerSmsStatus: text("customer_sms_status").notNull().default("demo"),
  chefSmsStatus: text("chef_sms_status").notNull().default("demo"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  /** Who last changed the order ("customer" when created); copied into order_events by a trigger. */
  updatedBy: text("updated_by").notNull().default("customer"),
}, (table) => [
  index("orders_created_at_idx").on(table.createdAt),
  index("orders_status_created_at_idx").on(table.status, table.createdAt),
  index("orders_payment_status_created_at_idx").on(table.paymentStatus, table.createdAt),
]);

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  mealId: text("meal_id").notNull(),
  mealName: text("meal_name").notNull(),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
}, (table) => [index("order_items_order_id_idx").on(table.orderId)]);

export const restaurantSettings = sqliteTable("restaurant_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

/** Fixed-window request counters used by lib/rate-limit.ts. */
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull().default(0),
}, (table) => [index("rate_limits_window_start_idx").on(table.windowStart)]);

/** Audit trail of every status change (who moved which order, and when). */
export const orderEvents = sqliteTable("order_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status", { enum: ORDER_STATUSES }).notNull(),
  actor: text("actor").notNull().default("kitchen"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("order_events_order_id_idx").on(table.orderId)]);

/** Meals shown on the menu. Admins can rename, describe, hide and reorder them. */
export const menuItems = sqliteTable("menu_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  note: text("note").notNull().default(""),
  accent: text("accent").notNull().default(""),
  image: text("image").notNull(),
  alt: text("alt").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

/** Plate prices (whole GH₵) offered for every meal. */
export const priceTiers = sqliteTable("price_tiers", {
  amount: integer("amount").primaryKey(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const deliveryZones = sqliteTable("delivery_zones", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  fee: integer("fee").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

/** Individual kitchen accounts (so status changes are attributable and revocable). */
export const staff = sqliteTable("staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  iterations: integer("iterations").notNull(),
  /** Changes whenever the password is reset or the account is disabled, ending open sessions. */
  sessionVersion: text("session_version").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
