import { getD1 } from "@/db";
import {
  ACTIVE_STATUSES,
  DELIVERY_ZONES,
  MAX_QUANTITY_PER_ITEM,
  MENU,
  ORDER_TYPES,
  isDeliveryZone,
  isMealId,
  isPaymentMethod,
  isValidPrice,
  type DeliveryZone,
  type MealId,
  type OrderType,
} from "@/lib/domain";
import { hasKitchenSession, kitchenUnauthorizedResponse } from "@/lib/kitchen-auth";
import { ORDER_LIMIT, allowRequest, tooManyRequests } from "@/lib/rate-limit";
import { createTrackingCode, hashTrackingCode } from "@/lib/tracking";

type IncomingItem = {
  mealId?: string;
  price?: number;
  quantity?: number;
};

type OrderRow = {
  id: number;
  order_type: OrderType;
  status: string;
  customer_name: string;
  customer_phone: string;
  delivery_zone: DeliveryZone | null;
  delivery_location: string | null;
  delivery_fee: number;
  subtotal: number;
  total: number;
  payment_method: string;
  payment_status: string;
  tracking_code_hash?: string;
  customer_sms_status: string;
  chef_sms_status: string;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: number;
  order_id: number;
  meal_id: MealId;
  meal_name: string;
  unit_price: number;
  quantity: number;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function publicOrder(row: OrderRow, items: ItemRow[] = []) {
  return {
    id: row.id,
    orderNumber: row.id,
    orderType: row.order_type,
    status: row.status,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryZone: row.delivery_zone,
    deliveryLocation: row.delivery_location,
    deliveryFee: row.delivery_fee,
    subtotal: row.subtotal,
    total: row.total,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    customerSmsStatus: row.customer_sms_status,
    chefSmsStatus: row.chef_sms_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map((item) => ({
      id: item.id,
      mealId: item.meal_id,
      mealName: item.meal_name,
      price: item.unit_price,
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
  if (!(await hasKitchenSession(request))) return kitchenUnauthorizedResponse();

  try {
    const db = getD1();
    const orderResult = await db
      .prepare(
        `SELECT id, order_type, status, customer_name, customer_phone,
          delivery_zone, delivery_location, delivery_fee, subtotal, total,
          payment_method, payment_status, customer_sms_status, chef_sms_status,
          created_at, updated_at
        FROM orders
        WHERE status IN (${ACTIVE_STATUSES.map((status) => `'${status}'`).join(", ")})
          OR created_at >= datetime('now', '-2 days')
        ORDER BY id DESC
        LIMIT 200`,
      )
      .all<OrderRow>();

    const orders = orderResult.results ?? [];
    if (orders.length === 0) {
      return Response.json({ orders: [] });
    }

    const placeholders = orders.map(() => "?").join(", ");
    const itemResult = await db
      .prepare(
        `SELECT id, order_id, meal_id, meal_name, unit_price, quantity
        FROM order_items
        WHERE order_id IN (${placeholders})
        ORDER BY id ASC`,
      )
      .bind(...orders.map((order) => order.id))
      .all<ItemRow>();
    const items = itemResult.results ?? [];

    return Response.json({
      orders: orders.map((order) =>
        publicOrder(
          order,
          items.filter((item) => item.order_id === order.id),
        ),
      ),
    });
  } catch (error) {
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
    const customerPhone = cleanText(payload.customerPhone, 30);
    const phoneDigits = customerPhone.replace(/\D/g, "");
    const paymentMethod = cleanText(payload.paymentMethod, 20);

    if (!orderType) {
      return Response.json({ error: "Choose delivery or order at restaurant." }, { status: 400 });
    }
    if (!customerName || phoneDigits.length < 9) {
      return Response.json({ error: "Add your name and a valid phone number." }, { status: 400 });
    }
    if (!isPaymentMethod(paymentMethod)) {
      return Response.json({ error: "Choose a valid payment method." }, { status: 400 });
    }

    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const items = rawItems
      .filter((item): item is IncomingItem => typeof item === "object" && item !== null)
      .map((item) => ({
        mealId: cleanText(item.mealId, 20),
        price: Number(item.price),
        quantity: Number(item.quantity),
      }));
    const validItems = items.flatMap((item) =>
      isMealId(item.mealId) &&
      isValidPrice(item.price) &&
      Number.isInteger(item.quantity) &&
      item.quantity >= 1 &&
      item.quantity <= MAX_QUANTITY_PER_ITEM
        ? [{ mealId: item.mealId as MealId, price: item.price, quantity: item.quantity }]
        : [],
    );

    if (validItems.length === 0 || validItems.length !== rawItems.length) {
      return Response.json({ error: "Your order contains an invalid menu item." }, { status: 400 });
    }

    const zoneInput = orderType === "delivery" ? cleanText(payload.deliveryZone, 20) : "";
    const deliveryZone: DeliveryZone | null = isDeliveryZone(zoneInput) ? zoneInput : null;
    const deliveryLocation =
      orderType === "delivery" ? cleanText(payload.deliveryLocation, 220) : "";

    if (orderType === "delivery" && (!deliveryZone || !deliveryLocation)) {
      return Response.json(
        { error: "Choose your delivery area and enter a delivery location." },
        { status: 400 },
      );
    }

    const deliveryFee = deliveryZone ? DELIVERY_ZONES[deliveryZone].fee : 0;
    const subtotal = validItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const total = subtotal + deliveryFee;
    const db = getD1();
    const trackingCode = createTrackingCode();
    const trackingCodeHash = await hashTrackingCode(trackingCode);

    // One batch = one transaction: the order and all its items are saved
    // together or not at all. Inside a batch nothing else can write, so the
    // sequence value is the id of the order inserted by the first statement.
    const newOrderId = "(SELECT seq FROM sqlite_sequence WHERE name = 'orders')";
    const [orderResult, , itemResult] = await db.batch([
      db
        .prepare(
          `INSERT INTO orders (
            order_type, customer_name, customer_phone, delivery_zone,
            delivery_location, delivery_fee, subtotal, total, payment_method,
            tracking_code_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id, order_type, status, customer_name, customer_phone,
            delivery_zone, delivery_location, delivery_fee, subtotal, total,
            payment_method, payment_status, customer_sms_status, chef_sms_status,
            created_at, updated_at`,
        )
        .bind(
          orderType,
          customerName,
          customerPhone,
          deliveryZone,
          deliveryLocation || null,
          deliveryFee,
          subtotal,
          total,
          paymentMethod,
          trackingCodeHash,
        ),
      db
        .prepare(
          `INSERT INTO order_items (order_id, meal_id, meal_name, unit_price, quantity)
          SELECT ${newOrderId}, json_extract(value, '$.m'), json_extract(value, '$.n'),
            json_extract(value, '$.p'), json_extract(value, '$.q')
          FROM json_each(?)`,
        )
        .bind(
          JSON.stringify(
            validItems.map((item) => ({
              m: item.mealId,
              n: MENU[item.mealId],
              p: item.price,
              q: item.quantity,
            })),
          ),
        ),
      db.prepare(
        `SELECT id, order_id, meal_id, meal_name, unit_price, quantity
        FROM order_items
        WHERE order_id = ${newOrderId}
        ORDER BY id ASC`,
      ),
    ]);

    const order = orderResult.results?.[0] as OrderRow | undefined;
    if (!order) {
      throw new Error("Order insert returned no row");
    }

    const trackingUrl = new URL(`/track?order=${order.id}`, request.url).toString();
    const smsMessage = `Bel's Kitchen Catering Service: ${customerName}, payment for order #${order.id} is confirmed. Your tracking password is ${trackingCode}. Follow your food: ${trackingUrl}`;

    return Response.json(
      {
        order: {
          ...publicOrder(order, (itemResult.results ?? []) as ItemRow[]),
          trackingCode,
          smsMessage,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Order could not be saved", error instanceof Error ? error.message : error);
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
