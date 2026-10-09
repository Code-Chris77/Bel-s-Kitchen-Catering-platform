import Image from "next/image";
import Link from "next/link";
import { Check, ChefHat, Clock3, QrCode, Sparkles } from "lucide-react";

import { CartProvider } from "@/components/cart/cart-provider";
import { CartSheet } from "@/components/cart/cart-sheet";
import { AddToCartButton } from "@/components/home/add-to-cart-button";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { OrderPathButtons } from "@/components/home/order-path-buttons";
import { SiteBrand } from "@/components/site-brand";
import { Button } from "@/components/ui/button";
import { getMenu } from "@/lib/menu";

import "./home.css";

// The menu, prices and delivery fees come from D1 on every request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const menu = await getMenu();
  const zones = menu.zones.map(({ id, label, fee }) => ({ id, label, fee }));

  return (
    <CartProvider
      menu={{ meals: menu.items.map(({ id, name }) => ({ id, name })), prices: menu.prices, zones }}
    >
      <main>
        <nav className="site-nav" aria-label="Main navigation">
          <SiteBrand href="#top" />
          <div className="nav-links">
            <a href="#order-paths">Order options</a>
            <a href="#menu">Menu</a>
            <a href="#how">How it works</a>
          </div>
          <CartSheet />
        </nav>

        <HeroCarousel />

        <section className="order-paths" id="order-paths">
          <div className="order-path-heading">
            <p className="eyebrow">TWO WAYS TO ORDER</p><h2>Coming in or staying home?</h2><p>Choose your path now. You can change it again during checkout.</p>
          </div>
          <OrderPathButtons zones={zones} />
        </section>

        <section className="menu-section" id="menu">
          <div className="section-heading">
            <div><p className="eyebrow">THE MENU</p><h2>Pick your rice.</h2></div>
            <p>Every choice comes hot with chicken. Pick the rice you want, then choose the price that fits your appetite.</p>
          </div>
          <div className="meal-grid">
            {menu.items.map((meal, index) => (
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
                  {menu.prices.map((price) => (
                    <AddToCartButton key={price} mealId={meal.id} mealName={meal.name} price={price} />
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
        <p>Fresh rice meals, chicken and catering service.</p><Link href="/track">Track my order</Link><Link href="/privacy">Privacy</Link><Link href="/kitchen">Kitchen staff</Link><Link href="/admin">Restaurant admin</Link><p>© 2026 Bel&apos;s Kitchen Catering Service</p>
      </footer>
      </main>
    </CartProvider>
  );
}
