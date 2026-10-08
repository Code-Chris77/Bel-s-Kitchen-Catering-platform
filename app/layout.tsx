import type { Metadata, Viewport } from "next";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const description =
  "Order fried rice, jollof rice, or mixed rice with chicken from Bel's Kitchen Catering Service and pay with Mobile Money or card.";

export const metadata: Metadata = {
  title: {
    default: "Bel's Kitchen Catering Service",
    template: "%s · Bel's Kitchen",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "Bel's Kitchen Catering Service",
    title: "Bel's Kitchen Catering Service",
    description,
    images: ["/hero-slide-jollof.webp"],
  },
  icons: {
    icon: "/bels-kitchen-logo.png",
    shortcut: "/bels-kitchen-logo.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#160904",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
