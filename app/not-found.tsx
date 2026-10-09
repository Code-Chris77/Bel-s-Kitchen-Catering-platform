import Link from "next/link";

import { Button } from "@/components/ui/button";

import "./tracking.css";

export default function NotFound() {
  return (
    <main className="tracking-page">
      <section className="tracking-shell">
        <div className="tracking-card">
          <p className="eyebrow">PAGE NOT FOUND</p>
          <h1>That page is not on the menu.</h1>
          <Button asChild className="tracking-submit"><Link href="/">Return to main page</Link></Button>
        </div>
      </section>
    </main>
  );
}
