import type { OrderStatus, OrderType } from "@/lib/domain";

export type KitchenOrder = {
  id: number;
  orderNumber: number;
  orderType: OrderType;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  deliveryZone: string | null;
  deliveryZoneLabel: string | null;
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

export function timeLabel(value: string) {
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
