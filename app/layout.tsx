import "./globals.css";
import type { Metadata } from "next";
import { Sora, Inter, Fraunces } from "next/font/google";

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
// Display serif scoped to the merchant dashboard (.app-shell / .app-page) for
// a warm editorial character. Customer pages keep Sora.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  variable: "--font-display-serif",
});

export const metadata: Metadata = {
  title: "Coffee Shop — Loyalty Card",
  description: "Coffee shop loyalty card: buy 9 coffees, get the 10th free.",
  // iOS detects card numbers (e.g. 67598271) as phone numbers and makes them
  // tappable ("Call?"). Turn that auto-detection off.
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
