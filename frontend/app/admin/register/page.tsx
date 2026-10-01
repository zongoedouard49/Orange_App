import type { Metadata } from "next";
import AdminRegister from "@/components/AdminRegister";

export const metadata: Metadata = {
  title: "Inscription administrateur",
  description: "Créez un compte administrateur avec votre CUID et votre mot de passe.",
  openGraph: {
    title: "Inscription administrateur",
    description: "Créez un compte administrateur avec votre CUID et votre mot de passe.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <AdminRegister />;
}
