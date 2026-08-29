"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Bike,
  Check,
  ChefHat,
  ChevronLeft,
  Clock3,
  MapPin,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
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
import { Toaster } from "@/components/ui/sonner";
import { SiteBrand } from "@/components/site-brand";

type MealId = "fried" | "jollof" | "mixed";
type OrderType = "delivery" | "dine_in";
type DeliveryZone = "accra" | "tema" | "outside";

type Meal = {
  id: MealId;
  name: string;
  note: string;
  accent: string;
  image: string;
  alt: string;
};

type CartItem = {
  key: string;
  mealId: MealId;
  price: number;
  quantity: number;
};

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

const meals: Meal[] = [
  {
    id: "fried",
    name: "Fried Rice",
    note: "Smoky, colourful and made fresh to order.",
    accent: "Golden wok flavour",
    image: "/menu-fried-rice.webp",
    alt: "Fried rice with glazed grilled chicken",
  },
  {
    id: "jollof",
    name: "Jollof Rice",
    note: "Rich tomato spice with that deep party-jollof finish.",
    accent: "Slow-cooked Ghana flavour",
    image: "/menu-jollof-rice.webp",
    alt: "Ghanaian jollof rice with glazed grilled chicken",
  },
  {
    id: "mixed",
    name: "The Mix",
    note: "Fried rice and jollof, side by side in one generous bowl.",
    accent: "Two favourites, one plate",
    image: "/menu-mixed-rice.webp",
    alt: "Fried rice and jollof rice mixed on one plate with grilled chicken",
  },
];

const prices = [35, 40, 50];

const deliveryZones: Record<DeliveryZone, { label: string; fee: number }> = {
  accra: { label: "Accra", fee: 30 },
  tema: { label: "Tema", fee: 50 },
  outside: { label: "Outside Accra", fee: 80 },
};

const paymentOptions = [
  { value: "mtn", label: "MTN MoMo", detail: "Pay with your MTN number" },
  { value: "telecel", label: "Telecel Cash", detail: "Pay with your Telecel number" },
  { value: "at", label: "AT Money", detail: "Pay with your AT number" },
  { value: "card", label: "Card", detail: "Visa or Mastercard" },
];

const heroSlides = [
  {
    image: "/hero-slide-fried.webp",
    eyebrow: "GOLDEN WOK FLAVOUR",
    title: "Fried rice, fired fresh.",
    description: "Smoky rice, bright vegetables and juicy grilled chicken—served hot from the kitchen.",
  },
  {
    image: "/hero-slide-jollof.webp",
    eyebrow: "SLOW-COOKED GHANA FLAVOUR",
    title: "Jollof worth gathering for.",
    description: "Rich tomato spice, fragrant grains and grilled chicken with that proper party-jollof finish.",
  },
  {
    image: "/hero-slide-mix.webp",
    eyebrow: "TWO FAVOURITES, ONE BOWL",
    title: "Why choose just one?",
    description: "Fried rice and jollof together with grilled chicken, made for the days you want everything.",
  },
];

export default function Home() {
  const [heroApi, setHeroApi] = useState<CarouselApi>();
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [paymentMethod, setPaymentMethod] = useState("mtn");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryZone, setDeliveryZone] = useState<DeliveryZone>("accra");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [submitted, setSubmitted] = useState<SavedOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("order") === "dine_in") {
        setOrderType("dine_in");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!heroApi) return;

    const selectSlide = () => setActiveHeroSlide(heroApi.selectedScrollSnap());
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    selectSlide();
    heroApi.on("select", selectSlide);
    heroApi.on("reInit", selectSlide);

    const timer = reduceMotion.matches
      ? undefined
      : window.setInterval(() => heroApi.scrollNext(), 5200);

    return () => {
      heroApi.off("select", selectSlide);
      heroApi.off("reInit", selectSlide);
      if (timer) window.clearInterval(timer);
    };
  }, [heroApi]);

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const deliveryFee = orderType === "delivery" ? deliveryZones[deliveryZone].fee : 0;
  const total = subtotal + deliveryFee;

  const addToCart = (mealId: MealId, price: number) => {
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
      description: `${meals.find((meal) => meal.id === mealId)?.name} · GH₵${price}`,
    });
  };

  const changeQuantity = (key: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + delta } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const startOrder = (type: OrderType) => {
    setOrderType(type);
    document.querySelector("#menu")?.scrollIntoView({ behavior: "smooth" });
    toast.message(type === "dine_in" ? "Restaurant order selected" : "Delivery selected", {
      description:
        type === "dine_in"
          ? "Pick your meal, pay online, then receive a collection number."
          : "Your area and exact location will be required at checkout.",
    });
  };

  const submitCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customerName.trim() || customerPhone.replace(/\D/g, "").length < 9) {
      toast.error("Add your name and a valid phone number");
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
          deliveryZone: orderType === "delivery" ? deliveryZone : null,
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
    setCart([]);
    setCheckout(false);
    setSubmitted(null);
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryLocation("");
    setCartOpen(false);
  };

  const smsPreview = submitted
    ? submitted.smsMessage
    : "";

  return (
    <main>
      <Toaster position="top-center" richColors />

      <nav className="site-nav" aria-label="Main navigation">
        <SiteBrand href="#top" />
        <div className="nav-links">
          <a href="#order-paths">Order options</a>
          <a href="#menu">Menu</a>
          <a href="#how">How it works</a>
        </div>
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
                  <a href={`/track?order=${submitted.orderNumber}`}>Track my order</a>
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
                      onChange={(event) => setDeliveryZone(event.target.value as DeliveryZone)}
                    >
                      {Object.entries(deliveryZones).map(([value, zone]) => (
                        <option value={value} key={value}>{zone.label} · GH₵{zone.fee}</option>
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
                    <div><span>{deliveryZones[deliveryZone].label} delivery</span><strong>GH₵{deliveryFee}</strong></div>
                  )}
                  <div className="checkout-total"><span>Total</span><strong>GH₵{total}</strong></div>
                </div>
                <Button type="submit" className="checkout-button" disabled={submitting}>
                  {submitting ? "Sending order..." : "Confirm demo payment & order"}
                </Button>
                <p className="test-note">Payment and SMS are in demo mode. No money will be taken and no message will be sent yet.</p>
              </form>
            ) : cart.length === 0 ? (
              <div className="empty-cart">
                <ShoppingBag aria-hidden="true" /><h2>Your bowl is empty.</h2><p>Choose fried rice, jollof, or mix both.</p>
                <Button onClick={() => setCartOpen(false)} className="checkout-button" asChild><a href="#menu">See the menu</a></Button>
              </div>
            ) : (
              <div className="cart-items">
                {cart.map((item) => {
                  const meal = meals.find((entry) => entry.id === item.mealId)!;
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
      </nav>

      <section className="hero-slideshow" id="top" aria-label="Featured meals">
        <Carousel
          className="hero-carousel"
          opts={{ loop: true, align: "start" }}
          setApi={setHeroApi}
        >
          <CarouselContent className="hero-carousel-track">
            {heroSlides.map((slide, index) => (
              <CarouselItem className="hero-slide" key={slide.image}>
                <div className="hero-slide-frame">
                  <Image
                    src={slide.image}
                    alt=""
                    fill
                    priority={index === 0}
                    sizes="100vw"
                    className="hero-slide-image"
                    unoptimized
                  />
                  <div className="hero-vignette" aria-hidden="true" />
                  <div className="hero-slide-copy">
                    <p className="eyebrow">{slide.eyebrow}</p>
                    <h1>{slide.title}</h1>
                    <p>{slide.description}</p>
                    <Button asChild className="hero-cta"><a href="#order-paths">Start your order</a></Button>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hero-arrow hero-arrow-previous" />
          <CarouselNext className="hero-arrow hero-arrow-next" />
          <div className="hero-dots" aria-label="Choose featured meal">
            {heroSlides.map((slide, index) => (
              <button
                type="button"
                key={slide.image}
                className={activeHeroSlide === index ? "is-active" : ""}
                onClick={() => heroApi?.scrollTo(index)}
                aria-label={`Show slide ${index + 1}: ${slide.title}`}
                aria-current={activeHeroSlide === index ? "true" : undefined}
              />
            ))}
          </div>
        </Carousel>
      </section>

      <section className="order-paths" id="order-paths">
        <div className="order-path-heading">
          <p className="eyebrow">TWO WAYS TO ORDER</p><h2>Coming in or staying home?</h2><p>Choose your path now. You can change it again during checkout.</p>
        </div>
        <div className="order-path-grid">
          <button type="button" className="order-path-card" onClick={() => startOrder("delivery")}>
            <span className="path-icon"><Bike /></span>
            <span className="path-copy"><small>OUTSIDE THE RESTAURANT</small><strong>Deliver to me</strong><span>Enter your name, phone, area and exact location. Your fee appears before payment.</span></span>
            <span className="path-fees">Accra GH₵30 · Tema GH₵50 · Outside GH₵80</span>
          </button>
          <button type="button" className="order-path-card dine-in" onClick={() => startOrder("dine_in")}>
            <span className="path-icon"><QrCode /></span>
            <span className="path-copy"><small>AT THE RESTAURANT</small><strong>Scan, order, collect</strong><span>Skip the receptionist. Pay online, receive a number, then collect when your number is called.</span></span>
            <span className="path-fees">No delivery fee · No waiting at reception</span>
          </button>
        </div>
      </section>

      <section className="menu-section" id="menu">
        <div className="section-heading">
          <div><p className="eyebrow">THE MENU</p><h2>Pick your rice.</h2></div>
          <p>Every choice comes hot with chicken. Pick the rice you want, then choose the price that fits your appetite.</p>
        </div>
        <div className="meal-grid">
          {meals.map((meal, index) => (
            <article className={`meal-card meal-card-${index + 1}`} key={meal.id}>
              <div className="meal-image-wrap">
                <Image
                  src={meal.image}
                  alt={meal.alt}
                  className="meal-image"
                  width={1200}
                  height={900}
                  sizes="(max-width: 900px) 100vw, 33vw"
                  unoptimized
                />
                <div className="meal-number">0{index + 1}</div>
              </div>
              <div className="meal-copy"><p className="meal-accent">{meal.accent}</p><h3>{meal.name}</h3><p>{meal.note}</p></div>
              <div className="price-list" aria-label={`${meal.name} prices`}>
                {prices.map((price) => (
                  <button type="button" key={price} onClick={() => addToCart(meal.id, price)}><span>GH₵{price}</span><Plus aria-hidden="true" /></button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section" id="how">
        <div className="how-copy">
          <p className="eyebrow">FROM SCREEN TO STEAM</p><h2>Your order goes straight to the kitchen.</h2>
          <p>Choose your meal and pay online. The kitchen receives the order immediately, while your phone gets the same collection number shown on screen.</p>
        </div>
        <ol className="steps-list">
          <li><span>01</span><div><strong>Choose</strong><p>Fried, jollof, or mix both.</p></div></li>
          <li><span>02</span><div><strong>Pay</strong><p>Use MoMo or card before the kitchen starts.</p></div></li>
          <li><span>03</span><div><strong>Track</strong><p>The chef sees your name, meal and order number.</p></div></li>
          <li><span>04</span><div><strong>Collect or receive</strong><p>Show your number at the restaurant, or wait for delivery.</p></div></li>
        </ol>
      </section>

      <section className="queue-proof">
        <div><ChefHat aria-hidden="true" /><p className="eyebrow">LIVE KITCHEN QUEUE</p><h2>No order gets lost between the counter and the chef.</h2></div>
        <div className="queue-proof-points">
          <p><Check /> Stored order with customer details</p><p><Clock3 /> Received, preparing and ready stages</p><p><QrCode /> QR link opens restaurant ordering directly</p>
        </div>
      </section>

      <section className="final-cta">
        <div className="final-glow" aria-hidden="true" /><Sparkles aria-hidden="true" /><p className="eyebrow">MADE WHEN YOU ORDER</p><h2>Your bowl is waiting.</h2>
        <Button asChild className="hero-cta"><a href="#order-paths">Start an order</a></Button>
      </section>

      <footer>
        <SiteBrand href="#top" />
        <p>Fresh rice meals, chicken and catering service.</p><a href="/track">Track my order</a><a href="/kitchen">Kitchen staff</a><a href="/admin">Restaurant admin</a><p>© 2026 Bel&apos;s Kitchen Catering Service</p>
      </footer>
    </main>
  );
}
