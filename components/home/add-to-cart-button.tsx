"use client";

import { Plus } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { formatCedis } from "@/lib/format";

export function AddToCartButton({ mealId, mealName, price }: { mealId: string; mealName: string; price: number }) {
  const { addToCart } = useCart();

  return (
    <button
      type="button"
      onClick={() => addToCart(mealId, price)}
      aria-label={`Add ${mealName}, ${formatCedis(price)} plate, to your order`}
    >
      <span>{formatCedis(price)}</span><Plus aria-hidden="true" />
    </button>
  );
}
