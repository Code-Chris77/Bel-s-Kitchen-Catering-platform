import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bel's Kitchen Catering Service",
  description:
    "Order fried rice, jollof rice, or mixed rice with chicken from Bel's Kitchen Catering Service and pay with Mobile Money or card.",
  icons: {
    icon: "/bels-kitchen-logo.png",
    shortcut: "/bels-kitchen-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
