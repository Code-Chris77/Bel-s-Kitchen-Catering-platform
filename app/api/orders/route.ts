import { desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { deliveryZones, orderItems, orders } from "@/db/schema";
import {
  ACTIVE_STATUSES,
  MAX_QUANTITY_PER_ITEM,
  ORDER_TYPES,
  isPaymentMethod,
  type OrderType,
} from "@/lib/domain";
import { normalizeGhanaPhone } from "@/lib/format";
import { getKitchenSession, kitchenUnauthorizedResponse } from "@/lib/kitchen-auth";
import { logError } from "@/lib/log";
import { getMenu } from "@/lib/menu";
import { ORDER_LIMIT, allowRequest, tooManyRequests } from "@/lib/rate-limit";
import { createTrackingCode, hashTrackingCode } from "@/lib/tracking";

const MAX_LINES_PER_ORDER = 20;

type IncomingItem = {
  mealId?: string;
  price?: number;
  quantity?: number;
};

type OrderRow = typeof orders.$inferSelect;
type ItemRow = typeof orderItems.$inferSelect;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function publicOrder(row: OrderRow, items: ItemRow[] = [], zoneLabel: string | null = null) {
  return {
    id: row.id,
    orderNumber: row.id,
    orderType: row.orderType,
    status: row.status,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    deliveryZone: row.deliveryZone,
    deliveryZoneLabel: zoneLabel,
    deliveryLocation: row.deliveryLocation,
    deliveryFee: row.deliveryFee,
    subtotal: row.subtotal,
    total: row.total,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    customerSmsStatus: row.customerSmsStatus,
    chefSmsStatus: row.chefSmsStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: items.map((item) => ({
      id: item.id,
      mealId: item.mealId,
      mealName: item.mealName,
      price: item.unitPrice,
      quantity: item.quantity,
    })),
  };
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "The order database is being prepared. Please try again shortly.";
  }
  return "The order could not be saved. Please try again.";
}

export async function GET(request: Request) {
  if (!(await getKitchenSession(request))) return kitchenUnauthorizedResponse();

  try {
    const db = getDb();
    const rows = await db
      .select({ order: orders, zoneLabel: deliveryZones.label })
      .from(orders)
      .leftJoin(deliveryZones, eq(orders.deliveryZone, deliveryZones.id))
      .where(
        or(
          inArray(orders.status, [...ACTIVE_STATUSES]),
          gte(orders.createdAt, sql`datetime('now', '-2 days')`),
        ),
      )
      .orderBy(desc(orders.id))
      .limit(200);

    if (rows.length === 0) {
      return Response.json({ orders: [] });
    }

    // D1 allows at most 100 bound parameters per query, so fetch the items for the
    // whole id range with one parameter instead of one per order.
    const oldestId = rows[rows.length - 1].order.id;
    const items = await db
      .select()
      .from(orderItems)
      .where(gte(orderItems.orderId, oldestId))
      .orderBy(orderItems.id);

    return Response.json({
      orders: rows.map(({ order, zoneLabel }) =>
        publicOrder(
          order,
          items.filter((item) => item.orderId === order.id),
          zoneLabel,
        ),
      ),
    });
  } catch (error) {
    logError("orders_list_failed", error);
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await allowRequest(request, ORDER_LIMIT))) return tooManyRequests(ORDER_LIMIT);

  try {
    const payload = (await request.json()) as {
      orderType?: string;
      customerName?: string;
      customerPhone?: string;
      deliveryZone?: string;
      deliveryLocation?: string;
      paymentMethod?: string;
      items?: IncomingItem[];
    };

    const orderType = (ORDER_TYPES as readonly (string | undefined)[]).includes(payload.orderType)
      ? (payload.orderType as OrderType)
      : null;
    const customerName = cleanText(payload.customerName, 80);
    const customerPhone = normalizeGhanaPhone(cleanText(payload.customerPhone, 30));
    const paymentMethod = cleanText(payload.paymentMethod, 20);

    if (!orderType) {
      return Response.json({ error: "Choose delivery or order at restaurant." }, { status: 400 });
    }
    if (!customerName || !customerPhone) {
      return Response.json({ error: "Add your name and a valid Ghana phone number." }, { status: 400 });
    }
    if (!isPaymentMethod(paymentMethod)) {
      return Response.json({ error: "Choose a valid payment method." }, { status: 400 });
    }

    // Prices, meals and delivery fees always come from the database, never from the browser.
    const menu = await getMenu();
    const meals = new Map(menu.items.map((item) => [item.id, item.name]));

    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const validItems = rawItems.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const mealId = cleanText(item.mealId, 40);
      const price = Number(item.price);
      const quantity = Number(item.quantity);
      return meals.has(mealId) &&
        menu.prices.includes(price) &&
        Number.isInteger(quantity) &&
        quantity >= 1 &&
        quantity <= MAX_QUANTITY_PER_ITEM
        ? [{ mealId, mealName: meals.get(mealId) as string, price, quantity }]
        : [];
    });

    if (
      validItems.length === 0 ||
      validItems.length !== rawItems.length ||
      validItems.length > MAX_LINES_PER_ORDER
    ) {
      return Response.json({ error: "Your order contains an invalid menu item." }, { status: 400 });
    }

    const zone =
      orderType === "delivery"
        ? menu.zones.find((candidate) => candidate.id === cleanText(payload.deliveryZone, 40))
        : undefined;
    const deliveryLocation =
      orderType === "delivery" ? cleanText(payload.deliveryLocation, 220) : "";

    if (orderType === "delivery" && (!zone || !deliveryLocation)) {
      return Response.json(
        { error: "Choose your delivery area and enter a delivery location." },
        { status: 400 },
      );
    }

    const deliveryFee = zone?.fee ?? 0;
    const subtotal = validItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal + deliveryFee;
    const db = getDb();
    const trackingCode = createTrackingCode();
    const trackingCodeHash = await hashTrackingCode(trackingCode);

    // One batch = one transaction: the order and all its items are saved
    // together or not at all. Inside a batch nothing else can write, so the
    // sequence value is the id of the order inserted by the first statement.
    const newOrderId = sql`(SELECT seq FROM sqlite_sequence WHERE name = 'orders')`;
    const [orderResult, , itemResult] = await db.batch([
      db
        .insert(orders)
        .values({
          orderType,
          customerName,
          customerPhone,
          deliveryZone: zone?.id ?? null,
          deliveryLocation: deliveryLocation || null,
          deliveryFee,
          subtotal,
          total,
          paymentMethod,
          trackingCodeHash,
        })
        .returning(),
      db.insert(orderItems).values(
        validItems.map((item) => ({
          orderId: newOrderId as unknown as number,
          mealId: item.mealId,
          mealName: item.mealName,
          unitPrice: item.price,
          quantity: item.quantity,
        })),
      ),
      db.select().from(orderItems).where(eq(orderItems.orderId, newOrderId)).orderBy(orderItems.id),
    ]);

    const order = orderResult[0];
    if (!order) {
      throw new Error("Order insert returned no row");
    }

    const trackingUrl = new URL(`/track?order=${order.id}`, request.url).toString();
    const smsMessage = `Bel's Kitchen Catering Service: ${customerName}, payment for order #${order.id} is confirmed. Your tracking password is ${trackingCode}. Follow your food: ${trackingUrl}`;

    return Response.json(
      {
        order: {
          ...publicOrder(order, itemResult, zone?.label ?? null),
          trackingCode,
          smsMessage,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logError("order_create_failed", error);
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
