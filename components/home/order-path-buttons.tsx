"use client";

import { Bike, QrCode } from "lucide-react";

import { useCart, type MenuZone } from "@/components/cart/cart-provider";
import { formatCedis } from "@/lib/format";

export function OrderPathButtons({ zones }: { zones: MenuZone[] }) {
  const { startOrder } = useCart();

  return (
    <div className="order-path-grid">
      <button type="button" className="order-path-card" onClick={() => startOrder("delivery")}>
        <span className="path-icon"><Bike /></span>
        <span className="path-copy"><small>OUTSIDE THE RESTAURANT</small><strong>Deliver to me</strong><span>Enter your name, phone, area and exact location. Your fee appears before payment.</span></span>
        <span className="path-fees">{zones.map((zone) => `${zone.label} ${formatCedis(zone.fee)}`).join(" · ")}</span>
      </button>
      <button type="button" className="order-path-card dine-in" onClick={() => startOrder("dine_in")}>
        <span className="path-icon"><QrCode /></span>
        <span className="path-copy"><small>AT THE RESTAURANT</small><strong>Scan, order, collect</strong><span>Skip the receptionist. Pay online, receive a number, then collect when your number is called.</span></span>
        <span className="path-fees">No delivery fee · No waiting at reception</span>
      </button>
    </div>
  );
}
