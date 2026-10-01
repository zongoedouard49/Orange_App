import type { Metadata } from "next";
import LoginPage from "@/components/LoginPage";

export const metadata: Metadata = {
  title: "Connexion — Espace collaborateur",
  description: "Accédez à votre espace collaborateur avec votre CUID et votre mot de passe.",
};

export default function Page() {
  return <LoginPage />;
}
