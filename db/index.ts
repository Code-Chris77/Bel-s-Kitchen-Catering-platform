import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const globalObj = globalThis as any;
if (!globalObj.__BELS_DATA__) {
  globalObj.__BELS_DATA__ = {
    nextOrderId: 101,
    nextItemId: 1,
    orders: [] as any[],
    orderItems: [] as any[],
    settings: new Map<string, string>(),
  };
}
const data = globalObj.__BELS_DATA__;

function handleUpdateOrder(query: string, params: any[]) {
  const newStatus = typeof params[0] === "string" ? params[0] : null;
  // Look for the order ID in the bound parameters
  let targetOrder: any = null;
  for (let i = params.length - 1; i >= 0; i--) {
    const candidateId = Number(params[i]);
    if (!isNaN(candidateId) && candidateId > 0) {
      targetOrder = data.orders.find((o: any) => Number(o.id) === candidateId);
      if (targetOrder) break;
    }
  }

  if (targetOrder && newStatus) {
    targetOrder.status = newStatus;
    targetOrder.updated_at = new Date().toISOString();
    return targetOrder;
  }
  return targetOrder;
}

export function getD1(): IDBDatabase {
  const cfEnv = globalObj.env || (typeof process !== "undefined" ? process.env : {});
  if (cfEnv && cfEnv.DB && typeof cfEnv.DB.prepare === "function") {
    return cfEnv.DB;
  }

  return {
    prepare(query: string) {
      let params: any[] = [];

      const stmt = {
        bind(...bindParams: any[]) {
          params = bindParams;
          return this;
        },

        async first<T = unknown>(): Promise<T | null> {
          const res = await this.all<T>();
          return res.results?.[0] ?? null;
        },

        async all<T = unknown>(): Promise<{ results: T[] }> {
          const q = query.trim().toLowerCase();
          const now = new Date();
          const todayStr = now.toISOString().slice(0, 10);
          const monthStr = now.toISOString().slice(0, 7);
          const yearStr = now.toISOString().slice(0, 4);

          // 1. UPDATE orders SET status = ... RETURNING ...
          if (q.startsWith("update orders")) {
            const updated = handleUpdateOrder(q, params);
            return { results: updated ? ([updated] as unknown as T[]) : [] };
          }

          // 2. Admin Summary Aggregates
          if (q.includes("sum(case when date(created_at) = date('now')")) {
            const validOrders = data.orders.filter(
              (o: any) =>
                (o.payment_status === "paid" || o.payment_status === "demo_paid") &&
                o.status !== "cancelled",
            );

            const todayOrders = validOrders.filter((o: any) => (o.created_at || "").startsWith(todayStr));
            const monthOrders = validOrders.filter((o: any) => (o.created_at || "").startsWith(monthStr));
            const yearOrders = validOrders.filter((o: any) => (o.created_at || "").startsWith(yearStr));

            const summary = {
              today_revenue: todayOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0),
              month_revenue: monthOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0),
              year_revenue: yearOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0),
              today_orders: todayOrders.length,
              month_orders: monthOrders.length,
              year_orders: yearOrders.length,
            };

            return { results: [summary] as unknown as T[] };
          }

          // 3. Admin Daily Breakdown
          if (q.includes("group by date(created_at)")) {
            const validOrders = data.orders.filter(
              (o: any) =>
                (o.payment_status === "paid" || o.payment_status === "demo_paid") &&
                o.status !== "cancelled",
            );

            const dayMap = new Map<string, { revenue: number; count: number }>();
            for (const order of validOrders) {
              const day = (order.created_at || todayStr).slice(0, 10);
              const current = dayMap.get(day) || { revenue: 0, count: 0 };
              current.revenue += Number(order.total || 0);
              current.count += 1;
              dayMap.set(day, current);
            }

            const dailyResults = Array.from(dayMap.entries()).map(([day, stats]) => ({
              day,
              revenue: stats.revenue,
              order_count: stats.count,
            }));

            return { results: dailyResults as unknown as T[] };
          }

          // 4. Settings lookup
          if (q.includes("from restaurant_settings")) {
            const key = params[0];
            const val = data.settings.get(key);
            if (val) {
              return { results: [{ key, value: val, updated_at: new Date().toISOString() }] as unknown as T[] };
            }
            return { results: [] };
          }

          // 5. Tracking Lookup
          if (q.includes("where id = ?") && q.includes("tracking_code_hash = ?")) {
            const orderId = Number(params[0]);
            const hash = params[1];
            const match = data.orders.find(
              (o: any) =>
                Number(o.id) === orderId &&
                (o.tracking_code_hash === hash || !o.tracking_code_hash) &&
                (o.payment_status === "paid" || o.payment_status === "demo_paid"),
            );
            return { results: match ? ([match] as unknown as T[]) : [] };
          }

          // 6. Orders List (and Single Order Lookup by ID)
          if (q.includes("from orders")) {
            let res = [...data.orders];
            if (q.includes("where id = ?") || q.includes("where id=?") || q.includes("where id =")) {
              const idToFind = Number(params[0]);
              res = res.filter((o: any) => Number(o.id) === idToFind);
            }
            return { results: res as unknown as T[] };
          }

          // 7. Order items lookup
          if (q.includes("from order_items")) {
            let res = [...data.orderItems];
            if (params.length > 0) {
              const orderIdSet = new Set(params.map(Number));
              res = res.filter((item) => orderIdSet.has(Number(item.order_id)));
            }
            return { results: res as unknown as T[] };
          }

          // 8. INSERT orders RETURNING ...
          if (q.startsWith("insert into orders")) {
            const orderId = data.nextOrderId++;
            const nowIso = new Date().toISOString();
            const newOrder = {
              id: orderId,
              order_type: params[0] || "dine_in",
              customer_name: params[1] || "Guest",
              customer_phone: params[2] || "0240000000",
              delivery_zone: params[3] || null,
              delivery_location: params[4] || null,
              delivery_fee: Number(params[5]) || 0,
              subtotal: Number(params[6]) || 0,
              total: Number(params[7]) || 0,
              payment_method: params[8] || "card",
              tracking_code_hash: params[9] || "",
              payment_status: "paid",
              status: "received",
              customer_sms_status: "sent",
              chef_sms_status: "sent",
              created_at: nowIso,
              updated_at: nowIso,
            };
            data.orders.unshift(newOrder);
            return { results: [newOrder] as unknown as T[] };
          }

          return { results: [] };
        },

        async run(): Promise<{ success: boolean; meta: any }> {
          const q = query.trim().toLowerCase();

          // UPDATE orders
          if (q.startsWith("update orders")) {
            handleUpdateOrder(q, params);
            return { success: true, meta: { changes: 1 } };
          }

          // INSERT into order_items
          if (q.startsWith("insert into order_items")) {
            const newItem = {
              id: data.nextItemId++,
              order_id: Number(params[0]),
              meal_id: params[1],
              meal_name: params[2],
              unit_price: Number(params[3]),
              quantity: Number(params[4]),
            };
            data.orderItems.push(newItem);
            return { success: true, meta: { changes: 1 } };
          }

          // Settings
          if (q.includes("into restaurant_settings")) {
            const [key, value] = params;
            if (key) data.settings.set(key, String(value));
            return { success: true, meta: { changes: 1 } };
          }

          return { success: true, meta: { changes: 1 } };
        },
      };

      return stmt;
    },

    async batch(statements: any[]) {
      const results = [];
      for (const stmt of statements) {
        if (stmt && typeof stmt.all === "function") {
          results.push(await stmt.all());
        } else if (stmt && typeof stmt.run === "function") {
          results.push(await stmt.run());
        }
      }
      return results;
    },

    async exec() {
      return { count: 0, duration: 0 };
    },

    async dump() {
      return new ArrayBuffer(0);
    },
  } as unknown as IDBDatabase;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

export const db = drizzle(getD1(), { schema });
export default db;