import { getD1 } from "@/db";
import { TRACKING_LIMIT, allowRequest, tooManyRequests } from "@/lib/rate-limit";
import { hashTrackingCode, legacyHashTrackingCode } from "@/lib/tracking";

type TrackingRow = {
  id: number;
  order_type: "delivery" | "dine_in";
  status: string;
  payment_status: string;
  updated_at: string;
};

export async function POST(request: Request) {
  if (!(await allowRequest(request, TRACKING_LIMIT))) return tooManyRequests(TRACKING_LIMIT);

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

    const [keyedHash, legacyHash] = await Promise.all([
      hashTrackingCode(trackingCode),
      legacyHashTrackingCode(trackingCode),
    ]);
    const order = await getD1()
      .prepare(
        `SELECT id, order_type, status, payment_status, updated_at
        FROM orders
        WHERE id = ?
          AND tracking_code_hash IN (?, ?)
          AND payment_status IN ('paid', 'demo_paid')
        LIMIT 1`,
      )
      .bind(orderNumber, keyedHash, legacyHash)
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
