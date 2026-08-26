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
// a warm editorial "trattoria" character. Customer pages keep Sora.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  variable: "--font-display-serif",
});

export const metadata: Metadata = {
  title: "Pizzeria Esempio — Fidélité",
  description: "Carte de fidélité Pizzeria Esempio",
  // iOS détecte les numéros de carte (ex. 67598271) comme des téléphones et les
  // rend cliquables ("Appeler ?"). On coupe cette auto-détection.
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sora.variable} ${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
