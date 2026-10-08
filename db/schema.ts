import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderType: text("order_type").notNull(),
  status: text("status").notNull().default("received"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  deliveryZone: text("delivery_zone"),
  deliveryLocation: text("delivery_location"),
  deliveryFee: integer("delivery_fee").notNull().default(0),
  subtotal: integer("subtotal").notNull(),
  total: integer("total").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").notNull().default("demo_paid"),
  trackingCodeHash: text("tracking_code_hash").notNull().default(""),
  customerSmsStatus: text("customer_sms_status").notNull().default("demo"),
  chefSmsStatus: text("chef_sms_status").notNull().default("demo"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
