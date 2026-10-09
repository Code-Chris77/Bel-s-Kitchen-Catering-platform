"use client";

import { useState } from "react";
import Link from "next/link";
import { Bike, Check, ChevronLeft, MapPin, Minus, Plus, QrCode, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PAYMENT_METHODS, type OrderType } from "@/lib/domain";
import { normalizeGhanaPhone } from "@/lib/format";

type SavedOrder = {
  id: number;
  orderNumber: number;
  trackingCode: string;
  smsMessage: string;
  orderType: OrderType;
  customerName: string;
  deliveryFee: number;
  total: number;
  items: Array<{
    mealName: string;
    price: number;
    quantity: number;
  }>;
};

const paymentOptions: Array<{ value: (typeof PAYMENT_METHODS)[number]; label: string; detail: string }> = [
  { value: "mtn", label: "MTN MoMo", detail: "Pay with your MTN number" },
  { value: "telecel", label: "Telecel Cash", detail: "Pay with your Telecel number" },
  { value: "at", label: "AT Money", detail: "Pay with your AT number" },
  { value: "card", label: "Card", detail: "Visa or Mastercard" },
];

/** The cart button in the navigation plus the slide-out cart, checkout form and order confirmation. */
export function CartSheet() {
  const {
    menu,
    cart,
    itemCount,
    subtotal,
    cartOpen,
    setCartOpen,
    orderType,
    setOrderType,
    changeQuantity,
    clearCart,
  } = useCart();
  const zones = menu.zones;
  const [checkout, setCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("mtn");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryZone, setDeliveryZone] = useState(zones[0]?.id ?? "");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [submitted, setSubmitted] = useState<SavedOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedZone = zones.find((zone) => zone.id === deliveryZone) ?? zones[0];
  const deliveryFee = orderType === "delivery" ? (selectedZone?.fee ?? 0) : 0;
  const total = subtotal + deliveryFee;
  const smsPreview = submitted ? submitted.smsMessage : "";

  const submitCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customerName.trim() || !normalizeGhanaPhone(customerPhone)) {
      toast.error("Add your name and a valid Ghana phone number");
      return;
    }
    if (orderType === "delivery" && !deliveryLocation.trim()) {
      toast.error("Add your delivery location");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType,
          customerName,
          customerPhone,
          deliveryZone: orderType === "delivery" ? selectedZone?.id : null,
          deliveryLocation: orderType === "delivery" ? deliveryLocation : null,
          paymentMethod,
          items: cart.map((item) => ({
            mealId: item.mealId,
            price: item.price,
            quantity: item.quantity,
          })),
        }),
      });
      const data = (await response.json()) as { order?: SavedOrder; error?: string };
      if (!response.ok || !data.order) {
        throw new Error(data.error || "The order could not be saved.");
      }
      setSubmitted(data.order);
      toast.success(`Order #${data.order.orderNumber} sent to the kitchen`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The order could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetCart = () => {
    clearCart();
    setCheckout(false);
    setSubmitted(null);
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryLocation("");
    setCartOpen(false);
  };

  return (
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTrigger asChild>
            <Button className="cart-trigger" aria-label={`Open cart, ${itemCount} items`}>
              <ShoppingBag /><span className="cart-label">Your order</span><span className="cart-count">{itemCount}</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="cart-sheet" aria-describedby="cart-description">
            <SheetHeader className="cart-header">
              <SheetTitle className="cart-title">
                {submitted ? `Order #${submitted.orderNumber}` : checkout ? "Checkout" : "Your order"}
              </SheetTitle>
              <SheetDescription id="cart-description" className="cart-description">
                {submitted
                  ? "Your order number and private tracking password are ready."
                  : checkout
                    ? "Choose your order type and payment method."
                    : "Hot rice, packed when you order."}
              </SheetDescription>
            </SheetHeader>

            {submitted ? (
              <div className="checkout-success">
                <span className="success-icon" aria-hidden="true"><Check /></span>
                <p className="eyebrow">SENT TO THE KITCHEN</p>
                <div className="order-number" aria-label={`Order number ${submitted.orderNumber}`}>
                  <small>YOUR NUMBER</small><strong>#{submitted.orderNumber}</strong>
                </div>
                <div className="tracking-password" aria-label={`Tracking password ${submitted.trackingCode}`}>
                  <small>TRACKING PASSWORD</small>
                  <strong>{submitted.trackingCode}</strong>
                  <span>Keep this private. It opens only your order progress.</span>
                </div>
                <h2>Your food is in the queue.</h2>
                <p>
                  {submitted.orderType === "dine_in"
                    ? `Listen for number ${submitted.orderNumber}, then show this screen when collecting your food.`
                    : `Your GH₵${submitted.deliveryFee} delivery fee is included. The kitchen can see your order and location.`}
                </p>
                <div className="sms-preview"><span>SMS DEMO PREVIEW</span><p>{smsPreview}</p></div>
                <p className="test-note">Demo mode: the order is stored and visible to the kitchen. No real money or SMS is sent yet.</p>
                <Button asChild className="checkout-button">
                  <Link href={`/track?order=${submitted.orderNumber}`}>Track my order</Link>
                </Button>
                <button type="button" className="success-reset" onClick={resetCart}>Return to menu</button>
              </div>
            ) : checkout ? (
              <form className="checkout-form" onSubmit={submitCheckout}>
                <button className="back-button" type="button" onClick={() => setCheckout(false)}>
                  <ChevronLeft /> Back to cart
                </button>

                <fieldset className="order-type-fieldset">
                  <legend>Where are you ordering?</legend>
                  <RadioGroup
                    className="order-type-options"
                    value={orderType}
                    onValueChange={(value) => setOrderType(value as OrderType)}
                    aria-label="Order type"
                  >
                    <label className={`order-type-option ${orderType === "delivery" ? "selected" : ""}`}>
                      <RadioGroupItem value="delivery" /><Bike />
                      <span><strong>Delivery</strong><small>Location and area fee required</small></span>
                    </label>
                    <label className={`order-type-option ${orderType === "dine_in" ? "selected" : ""}`}>
                      <RadioGroupItem value="dine_in" /><QrCode />
                      <span><strong>At restaurant</strong><small>Pay online and collect by number</small></span>
                    </label>
                  </RadioGroup>
                </fieldset>

                <label className="field-label" htmlFor="customer-name">Your name</label>
                <input
                  id="customer-name"
                  className="checkout-input"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="e.g. Christian Antwi"
                  autoComplete="name"
                  required
                />
                <label className="field-label" htmlFor="customer-phone">Phone number</label>
                <input
                  id="customer-phone"
                  className="checkout-input"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="e.g. 024 000 0000"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                />

                {orderType === "delivery" && (
                  <div className="delivery-fields">
                    <label className="field-label" htmlFor="delivery-zone">Delivery area</label>
                    <select
                      id="delivery-zone"
                      className="checkout-input checkout-select"
                      value={deliveryZone}
                      onChange={(event) => setDeliveryZone(event.target.value as string)}
                    >
                      {zones.map((zone) => (
                        <option value={zone.id} key={zone.id}>{zone.label} · GH₵{zone.fee}</option>
                      ))}
                    </select>
                    <label className="field-label" htmlFor="delivery-location">Exact location or digital address</label>
                    <div className="input-with-icon">
                      <MapPin aria-hidden="true" />
                      <input
                        id="delivery-location"
                        className="checkout-input"
                        value={deliveryLocation}
                        onChange={(event) => setDeliveryLocation(event.target.value)}
                        placeholder="e.g. GA-123-4567, Osu Oxford Street"
                        autoComplete="street-address"
                        required
                      />
                    </div>
                  </div>
                )}

                <fieldset className="payment-fieldset">
                  <legend>Online payment</legend>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} aria-label="Payment method">
                    {paymentOptions.map((option) => (
                      <label className={`payment-option ${paymentMethod === option.value ? "selected" : ""}`} key={option.value}>
                        <RadioGroupItem value={option.value} />
                        <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                      </label>
                    ))}
                  </RadioGroup>
                </fieldset>

                <div className="price-summary">
                  <div><span>Food subtotal</span><strong>GH₵{subtotal}</strong></div>
                  {orderType === "delivery" && (
                    <div><span>{selectedZone?.label} delivery</span><strong>GH₵{deliveryFee}</strong></div>
                  )}
                  <div className="checkout-total"><span>Total</span><strong>GH₵{total}</strong></div>
                </div>
                <Button type="submit" className="checkout-button" disabled={submitting}>
                  {submitting ? "Sending order..." : "Confirm demo payment & order"}
                </Button>
                <p className="test-note">Payment and SMS are in demo mode. No money will be taken and no message will be sent yet.</p>
                <p className="test-note">We keep your name and phone only to prepare your order. <Link href="/privacy">Privacy</Link></p>
              </form>
            ) : cart.length === 0 ? (
              <div className="empty-cart">
                <ShoppingBag aria-hidden="true" /><h2>Your bowl is empty.</h2><p>Choose fried rice, jollof, or mix both.</p>
                <Button onClick={() => setCartOpen(false)} className="checkout-button" asChild><a href="#menu">See the menu</a></Button>
              </div>
            ) : (
              <div className="cart-items">
                {cart.map((item) => {
                  const meal = menu.meals.find((entry) => entry.id === item.mealId);
                  if (!meal) return null;
                  return (
                    <article className="cart-item" key={item.key}>
                      <div><p className="cart-item-name">{meal.name}</p><p className="cart-item-price">GH₵{item.price} plate</p></div>
                      <div className="quantity-control" aria-label={`${meal.name} quantity`}>
                        <button type="button" onClick={() => changeQuantity(item.key, -1)} aria-label={`Remove one ${meal.name}`}>
                          {item.quantity === 1 ? <Trash2 /> : <Minus />}
                        </button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => changeQuantity(item.key, 1)} aria-label={`Add one ${meal.name}`}><Plus /></button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {!checkout && !submitted && cart.length > 0 && (
              <SheetFooter className="cart-footer">
                <div className="checkout-total"><span>Food subtotal</span><strong>GH₵{subtotal}</strong></div>
                <Button className="checkout-button" onClick={() => setCheckout(true)}>Checkout</Button>
              </SheetFooter>
            )}
          </SheetContent>
        </Sheet>
  );
}
