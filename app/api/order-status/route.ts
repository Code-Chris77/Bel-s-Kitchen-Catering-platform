import { getD1 } from "@/db";

type TrackingRow = {
  id: number;
  order_type: "delivery" | "dine_in";
  status: string;
  payment_status: string;
  updated_at: string;
};

async function hashTrackingCode(code: string) {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      orderNumber?: number | string;
      trackingCode?: string;
    };
    const orderNumber = Number(payload.orderNumber);
    const trackingCode =
      typeof payload.trackingCode === "string"
        ? payload.trackingCode.replace(/\D/g, "").slice(0, 6)
        : "";

    if (!Number.isInteger(orderNumber) || orderNumber < 1 || trackingCode.length !== 6) {
      return Response.json(
        { error: "Enter a valid order number and 6-digit password." },
        { status: 400 },
      );
    }

    const trackingCodeHash = await hashTrackingCode(trackingCode);
    const order = await getD1()
      .prepare(
        `SELECT id, order_type, status, payment_status, updated_at
        FROM orders
        WHERE id = ?
          AND tracking_code_hash = ?
          AND payment_status IN ('paid', 'demo_paid')
        LIMIT 1`,
      )
      .bind(orderNumber, trackingCodeHash)
      .first<TrackingRow>();

    if (!order) {
      return Response.json(
        { error: "That order number or tracking password is incorrect." },
        { status: 404 },
      );
    }

    return Response.json({
      order: {
        orderNumber: order.id,
        orderType: order.order_type,
        status: order.status,
        paymentStatus: order.payment_status,
        updatedAt: order.updated_at,
      },
    });
  } catch {
    return Response.json(
      { error: "Your order progress could not be loaded. Please try again." },
      { status: 500 },
    );
  }
}
