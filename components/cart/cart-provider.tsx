"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { OrderType } from "@/lib/domain";
import { formatCedis } from "@/lib/format";

export type MenuMeal = { id: string; name: string };
export type MenuZone = { id: string; label: string; fee: number };
export type CartMenu = { meals: MenuMeal[]; prices: number[]; zones: MenuZone[] };

export type CartItem = {
  key: string;
  mealId: string;
  price: number;
  quantity: number;
};

type CartContextValue = {
  menu: CartMenu;
  cart: CartItem[];
  itemCount: number;
  subtotal: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  addToCart: (mealId: string, price: number) => void;
  changeQuantity: (key: string, delta: number) => void;
  clearCart: () => void;
  startOrder: (type: OrderType) => void;
};

const CART_STORAGE_KEY = "bels-kitchen-cart";
const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>");
  return value;
}

/** Holds the cart (persisted in localStorage) and order type for every client part of the home page. */
export function CartProvider({ menu, children }: { menu: CartMenu; children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [cartLoaded, setCartLoaded] = useState(false);

  // Restore the cart after a refresh (deferred so server and client markup match).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved: unknown = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
        if (Array.isArray(saved)) {
          const restored = saved.filter(
              (item): item is CartItem =>
                typeof item?.key === "string" &&
                menu.meals.some((meal) => meal.id === item.mealId) &&
                menu.prices.includes(item.price) &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0 &&
                item.quantity <= 20,
          );
          // Never overwrite items added while the page was still loading.
          setCart((current) => (current.length > 0 ? current : restored));
        }
      } catch {
        // Storage unavailable or corrupted: start with an empty cart.
      }
      setCartLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [menu]);

  useEffect(() => {
    if (!cartLoaded) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore: the cart simply will not survive a refresh.
    }
  }, [cart, cartLoaded]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("order") === "dine_in") {
        setOrderType("dine_in");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const addToCart = useCallback(
    (mealId: string, price: number) => {
      const key = `${mealId}-${price}`;
      setCart((current) => {
        const existing = current.find((item) => item.key === key);
        if (existing) {
          return current.map((item) =>
            item.key === key ? { ...item, quantity: item.quantity + 1 } : item,
          );
        }
        return [...current, { key, mealId, price, quantity: 1 }];
      });
      toast.success("Added to your bowl", {
        description: `${menu.meals.find((meal) => meal.id === mealId)?.name} · ${formatCedis(price)}`,
      });
    },
    [menu.meals],
  );

  const changeQuantity = useCallback((key: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) => (item.key === key ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const startOrder = useCallback((type: OrderType) => {
    setOrderType(type);
    document.querySelector("#menu")?.scrollIntoView({ behavior: "smooth" });
    toast.message(type === "dine_in" ? "Restaurant order selected" : "Delivery selected", {
      description:
        type === "dine_in"
          ? "Pick your meal, pay online, then receive a collection number."
          : "Your area and exact location will be required at checkout.",
    });
  }, []);

  const value = useMemo(
    () => ({
      menu,
      cart,
      itemCount,
      subtotal,
      cartOpen,
      setCartOpen,
      orderType,
      setOrderType,
      addToCart,
      changeQuantity,
      clearCart,
      startOrder,
    }),
    [menu, cart, itemCount, subtotal, cartOpen, orderType, addToCart, changeQuantity, clearCart, startOrder],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
