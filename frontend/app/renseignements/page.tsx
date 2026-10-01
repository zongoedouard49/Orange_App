import type { Metadata } from "next";
import RenseignementsPage from "@/components/RenseignementsPage";

export const metadata: Metadata = {
  title: "Renseignements — Informations personnelles",
  description: "Remplissez vos informations personnelles et renseignez vos tâches.",
};

export default function Page() {
  return <RenseignementsPage />;
}
