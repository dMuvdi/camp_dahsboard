import type { Metadata, Viewport } from "next";
import { Cinzel, Great_Vibes, Montserrat } from "next/font/google";
import "./globals.css";

// Revelation Camp brand type (Canva brand guide): Cinzel display, Great Vibes script, Montserrat text
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  display: "swap",
});

const greatVibes = Great_Vibes({
  variable: "--font-great-vibes",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Revelation Camp", template: "%s | Revelation Camp" },
  description: "Campamento del Ministerio Juvenil VIDA.",
};

export const viewport: Viewport = {
  themeColor: "#4f0100",
  // lets the installed app draw under the iPhone status bar; headers pad with env(safe-area-inset-top)
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${cinzel.variable} ${greatVibes.variable} ${montserrat.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
