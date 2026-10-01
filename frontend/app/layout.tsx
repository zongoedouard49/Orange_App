import type { Metadata, Viewport } from "next";
import "./globals.css";
import CsrfProvider from "@/components/CsrfProvider";

export const metadata: Metadata = {
  title: "Espace collaborateur — Connexion et renseignements",
  description: "Un espace simple pour renseigner et suivre vos activités.",
  openGraph: {
    title: "Espace CUID — Connexion et Renseignements",
    description: "Application de connexion et de renseignements personnels.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
      </head>
      <body>
        <CsrfProvider>{children}</CsrfProvider>
      </body>
    </html>
  );
}
