import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SiteBrand } from "@/components/site-brand";
import { PERSONAL_DATA_RETENTION_DAYS } from "@/lib/retention";

import "../tracking.css";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Bel's Kitchen Catering Service uses and protects your order details.",
};

export default function PrivacyPage() {
  return (
    <main className="tracking-page">
      <nav className="tracking-nav">
        <SiteBrand />
        <Link className="kitchen-back" href="/"><ArrowLeft /> Main menu</Link>
      </nav>
      <section className="tracking-shell">
        <div className="tracking-card">
          <p className="eyebrow">YOUR DETAILS</p>
          <h1>Privacy.</h1>
          <h2>What we collect</h2>
          <p>
            When you order we store your name, phone number, delivery location (for deliveries)
            and what you ordered. We use them only to prepare and deliver your order and to
            reach you about it.
          </p>
          <h2>How long we keep it</h2>
          <p>
            After {PERSONAL_DATA_RETENTION_DAYS} days your name, phone number and delivery
            location are removed. We keep only the order totals for the restaurant&apos;s records.
          </p>
          <h2>Who can see it</h2>
          <p>
            Only the restaurant&apos;s kitchen and administrator can see order details. Your
            tracking password shows nothing but the progress of your own order. We do not sell
            or share your details.
          </p>
          <h2>Your rights</h2>
          <p>
            Under Ghana&apos;s Data Protection Act, 2012 you can ask to see or delete your details
            by speaking to the restaurant team.
          </p>
        </div>
      </section>
    </main>
  );
}
