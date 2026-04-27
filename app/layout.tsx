import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "shul — Votre synagogue sur le web, depuis WhatsApp",
    template: "%s | shul",
  },
  description:
    "Donnez à votre synagogue une présence web en quelques minutes. Mettez à jour les horaires, la photo et les actualités directement depuis WhatsApp.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://shul"
  ),
  other: {
    "facebook-domain-verification": "xai0kcvw79052kv4luudq3lu2uof69",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
