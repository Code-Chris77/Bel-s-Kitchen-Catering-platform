"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  Check,
  Clock3,
  KeyRound,
  LogOut,
  MapPin,
  Phone,
  Printer,
  QrCode,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { SiteBrand } from "@/components/site-brand";

type OrderStatus =
  | "received"
  | "preparing"
  | "ready"
  | "collected"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

type KitchenOrder = {
  id: number;
  orderNumber: number;
  orderType: "delivery" | "dine_in";
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  deliveryZone: "accra" | "tema" | "outside" | null;
  deliveryLocation: string | null;
  deliveryFee: number;
  subtotal: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  customerSmsStatus: string;
  chefSmsStatus: string;
  createdAt: string;
  items: Array<{
    id: number;
    mealName: string;
    price: number;
    quantity: number;
  }>;
};

const columns: Array<{
  status: OrderStatus;
  title: string;
  note: string;
}> = [
  { status: "received", title: "New orders", note: "Start these next" },
  { status: "preparing", title: "Preparing", note: "On the fire now" },
  { status: "ready", title: "Ready", note: "Call the number" },
];

const zoneLabels = {
  accra: "Accra",
  tema: "Tema",
  outside: "Outside Accra",
};

function nextAction(order: KitchenOrder) {
  if (order.status === "received") return { status: "preparing", label: "Start preparing" };
  if (order.status === "preparing") return { status: "ready", label: "Mark ready" };
  if (order.status === "ready" && order.orderType === "dine_in") {
    return { status: "collected", label: "Collected" };
  }
  if (order.status === "ready") {
    return { status: "out_for_delivery", label: "Send for delivery" };
  }
  if (order.status === "out_for_delivery") {
    return { status: "delivered", label: "Mark delivered" };
  }
  return null;
}

function timeLabel(value: string) {
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [access, setAccess] = useState<"checking" | "granted" | "locked">("checking");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = (await response.json()) as { orders?: KitchenOrder[]; error?: string };
      if (response.status === 401) {
        setAccess("locked");
        setOrders([]);
        setError("");
        return;
      }
      if (!response.ok || !data.orders) {
        throw new Error(data.error || "The kitchen queue could not load.");
      }
      setAccess("granted");
      setOrders(data.orders);
      setError("");
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The kitchen queue could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(initial);
  }, [loadOrders]);

  useEffect(() => {
    if (access !== "granted") return;
    const interval = window.setInterval(() => void loadOrders(true), 7000);
    return () => window.clearInterval(interval);
  }, [access, loadOrders]);

  const activeOrders = useMemo(
    () =>
      orders.filter((order) =>
        ["received", "preparing", "ready", "out_for_delivery"].includes(order.status),
      ),
    [orders],
  );

  const updateStatus = async (order: KitchenOrder, status: string) => {
    setUpdatingId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as { error?: string };
      if (response.status === 401) {
        setAccess("locked");
        throw new Error("Your kitchen session ended. Enter the password again.");
      }
      if (!response.ok) throw new Error(data.error || "The order could not be updated.");
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id ? { ...item, status: status as OrderStatus } : item,
        ),
      );
      toast.success(`Order #${order.orderNumber} updated`);
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "The order could not be updated.");
    } finally {
      setUpdatingId(null);
    }
  };

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSigningIn(true);
    setLoginError("");
    try {
      const response = await fetch("/api/kitchen-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { authenticated?: boolean; error?: string };
      if (!response.ok || !data.authenticated) {
        throw new Error(data.error || "The kitchen password is incorrect.");
      }
      setPassword("");
      setAccess("granted");
      await loadOrders();
    } catch (loginFailure) {
      setLoginError(loginFailure instanceof Error ? loginFailure.message : "Kitchen access failed.");
    } finally {
      setSigningIn(false);
    }
  };

  const logout = async () => {
    await fetch("/api/kitchen-auth", { method: "DELETE" });
    setOrders([]);
    setAccess("locked");
    setLastUpdated(null);
  };

  const printQr = () => window.print();

  if (access !== "granted") {
    return (
      <main className="kitchen-page kitchen-locked-page">
        <nav className="kitchen-nav">
          <SiteBrand />
          <Link className="kitchen-back" href="/"><ArrowLeft /> Customer menu</Link>
        </nav>

        <section className="kitchen-login-shell">
          <div className="kitchen-login-card">
            <span className="tracking-icon" aria-hidden="true"><KeyRound /></span>
            <p className="eyebrow">KITCHEN STAFF ONLY</p>
            <h1>{access === "checking" ? "Opening kitchen…" : "Enter the kitchen."}</h1>
            {access === "checking" ? (
              <p>Checking your secure kitchen session.</p>
            ) : (
              <>
                <p>Enter the staff password to see paid orders and update their progress.</p>
                <form onSubmit={submitLogin}>
                  <label htmlFor="kitchen-password">Kitchen password</label>
                  <input
                    id="kitchen-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter staff password"
                    required
                    autoFocus
                  />
                  {loginError && <p className="tracking-error" role="alert">{loginError}</p>}
                  <Button type="submit" className="tracking-submit" disabled={signingIn || !password}>
                    {signingIn ? "Unlocking…" : "Open kitchen queue"}
                  </Button>
                </form>
                <small>Customer tracking passwords cannot open this staff screen.</small>
              </>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="kitchen-page">
      <Toaster position="top-center" richColors />
      <nav className="kitchen-nav">
        <SiteBrand />
        <Link className="kitchen-back" href="/"><ArrowLeft /> Customer menu</Link>
      </nav>

      <header className="kitchen-header">
        <div>
          <p className="eyebrow">KITCHEN OPERATIONS</p>
          <h1>Food queue.</h1>
          <p>New paid demo orders appear automatically. Move each ticket from received to ready.</p>
        </div>
        <div className="kitchen-summary">
          <span><strong>{activeOrders.length}</strong> active orders</span>
          <span><Clock3 /> {lastUpdated ? `Updated ${timeLabel(lastUpdated.toISOString())}` : "Connecting..."}</span>
          <Button variant="outline" onClick={() => void loadOrders()} disabled={loading}>
            <RefreshCw className={loading ? "spin" : ""} /> Refresh
          </Button>
          <Button variant="outline" onClick={() => void logout()}>
            <LogOut /> Lock kitchen
          </Button>
        </div>
      </header>

      <section className="kitchen-tools">
        <div className="qr-print-card">
          <div className="qr-copy">
            <span className="path-icon"><QrCode /></span>
            <div>
              <p className="eyebrow">TABLE QR CODE</p>
              <h2>Scan to order here.</h2>
              <p>Place this QR on tables. It opens the menu with restaurant ordering already selected.</p>
              <Button onClick={printQr} variant="outline"><Printer /> Print QR card</Button>
            </div>
          </div>
          <Image
            src="/dine-in-order-qr.png"
            alt="QR code that opens Bel's Kitchen restaurant ordering"
            width={800}
            height={800}
            unoptimized
          />
        </div>
        <div className="demo-status-card">
          <span><Check /></span>
          <div><small>WORKING NOW</small><strong>Stored chef queue</strong><p>Orders remain after refresh and update every seven seconds.</p></div>
        </div>
        <div className="demo-status-card warning">
          <span><Phone /></span>
          <div><small>DEMO MODE</small><strong>Payment and SMS</strong><p>Previewed but not sent until verified provider accounts are connected.</p></div>
        </div>
      </section>

      {error && <div className="kitchen-error">{error}</div>}

      <section className="kitchen-board" aria-live="polite">
        {columns.map((column) => {
          const columnOrders = activeOrders.filter((order) => order.status === column.status);
          return (
            <div className="kitchen-column" key={column.status}>
              <div className="column-heading">
                <div><h2>{column.title}</h2><p>{column.note}</p></div>
                <span>{columnOrders.length}</span>
              </div>
              <div className="ticket-list">
                {loading && orders.length === 0 ? (
                  <div className="ticket-empty">Loading orders...</div>
                ) : columnOrders.length === 0 ? (
                  <div className="ticket-empty">No orders here.</div>
                ) : (
                  columnOrders.map((order) => {
                    const action = nextAction(order);
                    return (
                      <article className="order-ticket" key={order.id}>
                        <div className="ticket-top">
                          <div className="ticket-number"><small>ORDER</small><strong>#{order.orderNumber}</strong></div>
                          <span className={`ticket-type ${order.orderType}`}>
                            {order.orderType === "delivery" ? <Bike /> : <ShoppingBag />}
                            {order.orderType === "delivery" ? "Delivery" : "Restaurant"}
                          </span>
                        </div>
                        <div className="ticket-customer">
                          <strong>{order.customerName}</strong>
                          <a href={`tel:${order.customerPhone}`}><Phone /> {order.customerPhone}</a>
                        </div>
                        <ul className="ticket-items">
                          {order.items.map((item) => (
                            <li key={item.id}><span>{item.quantity}× {item.mealName}</span><strong>GH₵{item.price}</strong></li>
                          ))}
                        </ul>
                        {order.orderType === "delivery" && (
                          <div className="ticket-location">
                            <MapPin />
                            <span><strong>{order.deliveryZone ? zoneLabels[order.deliveryZone] : "Delivery"}</strong>{order.deliveryLocation}</span>
                          </div>
                        )}
                        <div className="ticket-total"><span>{timeLabel(order.createdAt)}</span><strong>GH₵{order.total}</strong></div>
                        <div className="ticket-sms"><Phone /> SMS demo prepared for customer</div>
                        {action && (
                          <Button
                            className="ticket-action"
                            disabled={updatingId === order.id}
                            onClick={() => void updateStatus(order, action.status)}
                          >
                            {updatingId === order.id ? "Updating..." : action.label}
                          </Button>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </section>

      {activeOrders.some((order) => order.status === "out_for_delivery") && (
        <section className="delivery-strip">
          <h2>Out for delivery</h2>
          {activeOrders.filter((order) => order.status === "out_for_delivery").map((order) => (
            <div key={order.id}>
              <span>#{order.orderNumber} · {order.customerName}</span>
              <Button size="sm" onClick={() => void updateStatus(order, "delivered")}>Mark delivered</Button>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
