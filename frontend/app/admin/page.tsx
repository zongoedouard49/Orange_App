import type { Metadata } from "next";
import AdminPanel from "@/components/AdminPanel";

export const metadata: Metadata = {
  title: "Panneau Administrateur",
  description: "Administration — Paramètres et rapports.",
};

export default function Page() {
  return <AdminPanel />;
}
