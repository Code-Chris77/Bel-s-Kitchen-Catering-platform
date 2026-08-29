import { getD1 } from "@/db";
import { hasKitchenSession, kitchenUnauthorizedResponse } from "@/lib/kitchen-auth";

const MENU = {
  fried: "Fried Rice",
  jollof: "Jollof Rice",
  mixed: "The Mix",
} as const;

const VALID_PRICES = new Set([35, 40, 50]);
const DELIVERY_FEES = {
  accra: 30,
  tema: 50,
  outside: 80,
} as const;

const PAYMENT_METHODS = new Set(["mtn", "telecel", "at", "card"]);

type MealId = keyof typeof MENU;
type DeliveryZone = keyof typeof DELIVERY_FEES;

type IncomingItem = {
  mealId?: string;
  price?: number;
  quantity?: number;
};

type OrderRow = {
  id: number;
  order_type: "delivery" | "dine_in";
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

function createTrackingCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

async function hashTrackingCode(code: string) {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
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
        WHERE created_at >= datetime('now', '-2 days')
        ORDER BY id DESC
        LIMIT 120`,
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
  let savedOrderId: number | null = null;

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

    const orderType = payload.orderType;
    const customerName = cleanText(payload.customerName, 80);
    const customerPhone = cleanText(payload.customerPhone, 30);
    const phoneDigits = customerPhone.replace(/\D/g, "");
    const paymentMethod = cleanText(payload.paymentMethod, 20);

    if (orderType !== "delivery" && orderType !== "dine_in") {
      return Response.json({ error: "Choose delivery or order at restaurant." }, { status: 400 });
    }
    if (!customerName || phoneDigits.length < 9) {
      return Response.json({ error: "Add your name and a valid phone number." }, { status: 400 });
    }
    if (!PAYMENT_METHODS.has(paymentMethod)) {
      return Response.json({ error: "Choose a valid payment method." }, { status: 400 });
    }

    const items = (Array.isArray(payload.items) ? payload.items : []).map((item) => ({
      mealId: cleanText(item.mealId, 20) as MealId,
      price: Number(item.price),
      quantity: Number(item.quantity),
    }));
    const validItems = items.filter(
      (item) =>
        item.mealId in MENU &&
        VALID_PRICES.has(item.price) &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= 20,
    );

    if (validItems.length === 0 || validItems.length !== items.length) {
      return Response.json({ error: "Your order contains an invalid menu item." }, { status: 400 });
    }

    const deliveryZone =
      orderType === "delivery" ? (cleanText(payload.deliveryZone, 20) as DeliveryZone) : null;
    const deliveryLocation =
      orderType === "delivery" ? cleanText(payload.deliveryLocation, 220) : "";

    if (
      orderType === "delivery" &&
      (!deliveryZone || !(deliveryZone in DELIVERY_FEES) || !deliveryLocation)
    ) {
      return Response.json(
        { error: "Choose your delivery area and enter a delivery location." },
        { status: 400 },
      );
    }

    const deliveryFee = deliveryZone ? DELIVERY_FEES[deliveryZone] : 0;
    const subtotal = validItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const total = subtotal + deliveryFee;
    const db = getD1();
    const trackingCode = createTrackingCode();
    const trackingCodeHash = await hashTrackingCode(trackingCode);

    const order = await db
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
      )
      .first<OrderRow>();

    if (!order) {
      throw new Error("Order insert returned no row");
    }

    savedOrderId = order.id;
    const itemStatements = validItems.map((item) =>
      db
        .prepare(
          `INSERT INTO order_items (order_id, meal_id, meal_name, unit_price, quantity)
          VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(order.id, item.mealId, MENU[item.mealId], item.price, item.quantity),
    );
    await db.batch(itemStatements);

    const responseItems = validItems.map((item, index) => ({
      id: index + 1,
      order_id: order.id,
      meal_id: item.mealId,
      meal_name: MENU[item.mealId],
      unit_price: item.price,
      quantity: item.quantity,
    }));
    const trackingUrl = new URL(`/track?order=${order.id}`, request.url).toString();
    const smsMessage = `Bel's Kitchen Catering Service: ${customerName}, payment for order #${order.id} is confirmed. Your tracking password is ${trackingCode}. Follow your food: ${trackingUrl}`;

    return Response.json(
      {
        order: {
          ...publicOrder(order, responseItems),
          trackingCode,
          smsMessage,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (savedOrderId) {
      try {
        await getD1().prepare("DELETE FROM orders WHERE id = ?").bind(savedOrderId).run();
      } catch {
        // Leave the original error as the customer-facing failure.
      }
    }
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
