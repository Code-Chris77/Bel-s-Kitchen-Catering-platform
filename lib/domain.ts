/**
 * Single source of truth for menu, pricing, delivery, payment and order-status
 * rules. Imported by both the API routes and the pages.
 */

export const MENU = {
  fried: "Fried Rice",
  jollof: "Jollof Rice",
  mixed: "The Mix",
} as const;
export type MealId = keyof typeof MENU;

/** Plate prices in GH₵ that the menu offers for every meal. */
export const PRICES = [35, 40, 50] as const;

export const DELIVERY_ZONES = {
  accra: { label: "Accra", fee: 30 },
  tema: { label: "Tema", fee: 50 },
  outside: { label: "Outside Accra", fee: 80 },
} as const;
export type DeliveryZone = keyof typeof DELIVERY_ZONES;

export const PAYMENT_METHODS = ["mtn", "telecel", "at", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_TYPES = ["delivery", "dine_in"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_STATUSES = [
  "received",
  "preparing",
  "ready",
  "collected",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuses the kitchen still has to act on. */
export const ACTIVE_STATUSES = ["received", "preparing", "ready", "out_for_delivery"] as const;

export const MAX_QUANTITY_PER_ITEM = 20;

/** The only status an order may move to next, or null once it is finished. */
export function nextStatus(status: string, orderType: OrderType): OrderStatus | null {
  if (status === "received") return "preparing";
  if (status === "preparing") return "ready";
  if (status === "ready") return orderType === "dine_in" ? "collected" : "out_for_delivery";
  if (status === "out_for_delivery") return "delivered";
  return null;
}

/** The kitchen may cancel an order until it has left the kitchen. */
export function canCancel(status: string) {
  return status === "received" || status === "preparing" || status === "ready";
}

export function isMealId(value: string): value is MealId {
  return Object.hasOwn(MENU, value);
}

export function isDeliveryZone(value: string): value is DeliveryZone {
  return Object.hasOwn(DELIVERY_ZONES, value);
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export function isValidPrice(value: number) {
  return (PRICES as readonly number[]).includes(value);
}
