"use client";

import { Bike, MapPin, Phone, ShoppingBag } from "lucide-react";

import { timeLabel, type KitchenOrder } from "@/components/kitchen/kitchen-order";
import { Button } from "@/components/ui/button";
import { canCancel } from "@/lib/domain";

type OrderTicketProps = {
  order: KitchenOrder;
  action: { status: string; label: string } | null;
  updating: boolean;
  onUpdate: (status: string) => void;
};

export function OrderTicket({ order, action, updating, onUpdate }: OrderTicketProps) {
  return (
      <article className="order-ticket">
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
            <span><strong>{order.deliveryZoneLabel ?? "Delivery"}</strong>{order.deliveryLocation}</span>
          </div>
        )}
        <div className="ticket-total"><span>{timeLabel(order.createdAt)}</span><strong>GH₵{order.total}</strong></div>
        <div className="ticket-sms"><Phone /> SMS demo prepared for customer</div>
        {action && (
          <Button
            className="ticket-action"
            disabled={updating}
            onClick={() => onUpdate(action.status)}
          >
            {updating ? "Updating..." : action.label}
          </Button>
        )}
        {canCancel(order.status) && (
          <Button
            variant="outline"
            className="ticket-cancel"
            disabled={updating}
            onClick={() => {
              if (window.confirm(`Cancel order #${order.orderNumber}? This cannot be undone.`)) {
                onUpdate("cancelled");
              }
            }}
          >
            Cancel order
          </Button>
        )}
      </article>
  );
}
