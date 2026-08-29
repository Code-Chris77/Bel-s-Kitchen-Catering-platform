"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  Check,
  ChefHat,
  Clock3,
  KeyRound,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Progress } from "@/components/ui/progress";
import { SiteBrand } from "@/components/site-brand";

type OrderStatus =
  | "received"
  | "preparing"
  | "ready"
  | "collected"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

type TrackedOrder = {
  orderNumber: number;
  orderType: "delivery" | "dine_in";
  status: OrderStatus;
  paymentStatus: string;
  updatedAt: string;
};

type Stage = {
  status: OrderStatus;
  title: string;
  note: string;
};

const dineInStages: Stage[] = [
  { status: "received", title: "Payment confirmed", note: "Your order is secured." },
  { status: "preparing", title: "Preparing", note: "The kitchen has started your food." },
  { status: "ready", title: "Ready", note: "Your food is ready for collection." },
  { status: "collected", title: "Collected", note: "Your order has been handed over." },
];

const deliveryStages: Stage[] = [
  { status: "received", title: "Payment confirmed", note: "Your order is secured." },
  { status: "preparing", title: "Preparing", note: "The kitchen has started your food." },
  { status: "ready", title: "Ready", note: "Your food is packed and ready." },
  { status: "out_for_delivery", title: "On the way", note: "Your order has left the restaurant." },
  { status: "delivered", title: "Delivered", note: "Your order has arrived." },
];

function stageIndex(stages: Stage[], status: OrderStatus) {
  const exact = stages.findIndex((stage) => stage.status === status);
  return exact < 0 ? 0 : exact;
}

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const number = new URLSearchParams(window.location.search).get("order");
      if (number && /^\d+$/.test(number)) setOrderNumber(number);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadProgress = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, trackingCode }),
        cache: "no-store",
      });
      const data = (await response.json()) as { order?: TrackedOrder; error?: string };
      if (!response.ok || !data.order) {
        throw new Error(data.error || "Your order progress could not be loaded.");
      }
      setOrder(data.order);
      setError("");
    } catch (loadError) {
      if (!quiet) {
        setError(loadError instanceof Error ? loadError.message : "Your order progress could not be loaded.");
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [orderNumber, trackingCode]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadProgress();
  };

  useEffect(() => {
    if (!order) return;
    const interval = window.setInterval(() => void loadProgress(true), 5000);
    return () => window.clearInterval(interval);
  }, [loadProgress, order]);

  const terminal = order?.status === "collected" || order?.status === "delivered";

  useEffect(() => {
    if (!terminal) return;
    const timer = window.setTimeout(() => window.location.assign("/"), 3500);
    return () => window.clearTimeout(timer);
  }, [terminal]);

  const stages = useMemo(
    () => (order?.orderType === "delivery" ? deliveryStages : dineInStages),
    [order?.orderType],
  );
  const currentIndex = order ? stageIndex(stages, order.status) : 0;
  const currentStage = stages[currentIndex];
  const progress = stages.length > 1 ? (currentIndex / (stages.length - 1)) * 100 : 0;

  return (
    <main className="tracking-page">
      <nav className="tracking-nav">
        <SiteBrand />
        <Link className="kitchen-back" href="/"><ArrowLeft /> Main menu</Link>
      </nav>

      <section className="tracking-shell">
        {!order ? (
          <div className="tracking-login">
            <span className="tracking-icon" aria-hidden="true"><KeyRound /></span>
            <p className="eyebrow">PRIVATE ORDER PROGRESS</p>
            <h1>Track your food.</h1>
            <p>Enter the order number and 6-digit password you received after payment.</p>

            <form onSubmit={submit}>
              <label htmlFor="tracking-order-number">Order number</label>
              <div className="tracking-number-input">
                <span aria-hidden="true">#</span>
                <input
                  id="tracking-order-number"
                  value={orderNumber}
                  onChange={(event) => setOrderNumber(event.target.value.replace(/\D/g, "").slice(0, 9))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="23"
                  required
                />
              </div>

              <label htmlFor="tracking-password">Tracking password</label>
              <InputOTP
                id="tracking-password"
                maxLength={6}
                value={trackingCode}
                onChange={setTrackingCode}
                inputMode="numeric"
                containerClassName="tracking-otp"
                aria-label="Six digit tracking password"
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, index) => (
                    <InputOTPSlot index={index} key={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              {error && <p className="tracking-error" role="alert">{error}</p>}
              <Button
                className="tracking-submit"
                type="submit"
                disabled={loading || !orderNumber || trackingCode.length !== 6}
              >
                {loading ? "Opening progress..." : "View my progress"}
              </Button>
            </form>

            <p className="tracking-privacy">Only the progress for your own order will be shown.</p>
          </div>
        ) : order.status === "cancelled" ? (
          <div className="tracking-card tracking-cancelled">
            <p className="eyebrow">ORDER #{order.orderNumber}</p>
            <h1>Order cancelled.</h1>
            <p>Please speak with the restaurant team for assistance.</p>
            <Button asChild className="tracking-submit"><Link href="/">Return to main page</Link></Button>
          </div>
        ) : (
          <div className={`tracking-card ${terminal ? "tracking-complete" : ""}`} aria-live="polite">
            <div className="tracking-card-top">
              <div>
                <p className="eyebrow">YOUR ORDER</p>
                <h1>#{order.orderNumber}</h1>
              </div>
              <span className="tracking-order-type">
                {order.orderType === "delivery" ? <Bike /> : <ShoppingBag />}
                {order.orderType === "delivery" ? "Delivery" : "Restaurant"}
              </span>
            </div>

            <div className="current-status">
              <span aria-hidden="true">
                {terminal ? <PackageCheck /> : currentStage.status === "preparing" ? <ChefHat /> : <Clock3 />}
              </span>
              <div>
                <small>RIGHT NOW</small>
                <h2>{currentStage.title}</h2>
                <p>{currentStage.note}</p>
              </div>
            </div>

            <Progress value={progress} aria-label={`Order progress: ${currentStage.title}`} />

            <ol className="tracking-stages">
              {stages.map((stage, index) => {
                const reached = index <= currentIndex;
                const active = index === currentIndex;
                return (
                  <li className={`${reached ? "reached" : ""} ${active ? "active" : ""}`} key={stage.status}>
                    <span aria-hidden="true">{reached ? <Check /> : index + 1}</span>
                    <div><strong>{stage.title}</strong><small>{active ? stage.note : reached ? "Completed" : "Waiting"}</small></div>
                  </li>
                );
              })}
            </ol>

            {terminal ? (
              <p className="tracking-redirect">Returning you to the main page…</p>
            ) : (
              <p className="tracking-refresh"><Clock3 /> Progress updates automatically.</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
