"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock3,
  LogOut,
  Phone,
  Printer,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KitchenLogin } from "@/components/kitchen/kitchen-login";
import { timeLabel, type KitchenOrder } from "@/components/kitchen/kitchen-order";
import { OrderTicket } from "@/components/kitchen/order-ticket";
import { SiteBrand } from "@/components/site-brand";
import { usePolling } from "@/hooks/use-polling";
import {
  ACTIVE_STATUSES,
  nextStatus,
  type OrderStatus,
} from "@/lib/domain";

import "../kitchen.css";

const columns: Array<{
  status: OrderStatus;
  title: string;
  note: string;
}> = [
  { status: "received", title: "New orders", note: "Start these next" },
  { status: "preparing", title: "Preparing", note: "On the fire now" },
  { status: "ready", title: "Ready", note: "Call the number" },
];

const actionLabels: Record<string, string> = {
  preparing: "Start preparing",
  ready: "Mark ready",
  collected: "Collected",
  out_for_delivery: "Send for delivery",
  delivered: "Mark delivered",
};

function nextAction(order: KitchenOrder) {
  const status = nextStatus(order.status, order.orderType);
  return status ? { status, label: actionLabels[status] } : null;
}

/** A short two-tone beep so a busy kitchen notices new tickets. */
function playNewOrderChime() {
  try {
    const context = new AudioContext();
    [880, 1175].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.15;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + index * 0.18);
      oscillator.stop(context.currentTime + index * 0.18 + 0.15);
    });
    window.setTimeout(() => void context.close(), 800);
  } catch {
    // Audio is optional (blocked by the browser or unsupported).
  }
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [access, setAccess] = useState<"checking" | "granted" | "locked">("checking");
  const [staffName, setStaffName] = useState("");
  const [staffRequired, setStaffRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const knownOrderIds = useRef<Set<number> | null>(null);

  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = (await response.json()) as { orders?: KitchenOrder[]; error?: string };
      if (response.status === 401) {
        const status = (await (await fetch("/api/kitchen-auth", { cache: "no-store" })).json()) as {
          staffRequired?: boolean;
        };
        setStaffRequired(Boolean(status.staffRequired));
        setAccess("locked");
        setOrders([]);
        setError("");
        return;
      }
      if (!response.ok || !data.orders) {
        throw new Error(data.error || "The kitchen queue could not load.");
      }
      setAccess("granted");
      const known = knownOrderIds.current;
      if (known && data.orders.some((order) => !known.has(order.id))) {
        playNewOrderChime();
        toast.info("New order received");
      }
      knownOrderIds.current = new Set(data.orders.map((order) => order.id));
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

  usePolling(() => void loadOrders(true), 7000, access === "granted");

  const activeOrders = useMemo(
    () =>
      orders.filter((order) =>
        (ACTIVE_STATUSES as readonly string[]).includes(order.status),
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
        body: JSON.stringify({ name: staffName, password }),
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

        <KitchenLogin
          checking={access === "checking"}
          staffRequired={staffRequired}
          staffName={staffName}
          onStaffName={setStaffName}
          password={password}
          onPassword={setPassword}
          signingIn={signingIn}
          error={loginError}
          onSubmit={submitLogin}
        />
      </main>
    );
  }

  return (
    <main className="kitchen-page">
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
                      <OrderTicket
                        key={order.id}
                        order={order}
                        action={action}
                        updating={updatingId === order.id}
                        onUpdate={(status) => void updateStatus(order, status)}
                      />
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
