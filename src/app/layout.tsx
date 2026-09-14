import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SVR · financiële administratie",
    template: "%s · SVR",
  },
  description:
    "Financiële administratie van de StudieVerenigingenRaad Delft: facturen, uitgaven, omslag en balans.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
