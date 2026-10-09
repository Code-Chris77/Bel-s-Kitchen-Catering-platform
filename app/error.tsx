"use client";

import { Button } from "@/components/ui/button";

import "./tracking.css";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="tracking-page">
      <section className="tracking-shell">
        <div className="tracking-card" role="alert">
          <p className="eyebrow">SOMETHING WENT WRONG</p>
          <h1>We could not load this page.</h1>
          <p>Please try again. If it keeps happening, speak with the restaurant team.</p>
          <Button className="tracking-submit" onClick={reset}>Try again</Button>
        </div>
      </section>
    </main>
  );
}
