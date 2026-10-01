import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/rapport/export?service=Technique&statut=employer
 *
 * Retourne un fichier Excel (.xlsx) filtré par service et statut.
 * Remplacez la logique mock par votre vraie source de données.
 */

// Données mock — à remplacer par un appel BDD ou service
const MOCK_RECORDS = [
  { cuid: "EMP001", nom: "Kaboré",    prenom: "Alain",    service: "Technique",          statut: "employer",    tache: "Vérification des équipements", description: "Terminé avec succès" },
  { cuid: "PRE002", nom: "Traoré",    prenom: "Fatou",    service: "Commercial",          statut: "prestataire", tache: "Rapport de maintenance",       description: "En cours de traitement" },
  { cuid: "EMP003", nom: "Sawadogo",  prenom: "Moussa",   service: "Technique",          statut: "employer",    tache: "Contrôle qualité signal",      description: "Planifié semaine prochaine" },
  { cuid: "EMP004", nom: "Ouédraogo", prenom: "Aïcha",    service: "Ressources Humaines", statut: "employer",    tache: "Inventaire matériel",          description: "À compléter" },
  { cuid: "PRE005", nom: "Zongo",     prenom: "Pierre",   service: "Informatique",        statut: "prestataire", tache: "Mise à jour des logiciels",    description: "Déployé en production" },
  { cuid: "EMP006", nom: "Compaoré",  prenom: "Sylvie",   service: "Direction",           statut: "employer",    tache: "Rapport de maintenance",       description: "Validé par la hiérarchie" },
  { cuid: "PRE007", nom: "Diallo",    prenom: "Ibrahima", service: "Technique",          statut: "prestataire", tache: "Vérification des équipements", description: "En attente de pièces" },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const service = searchParams.get("service");
  const statut  = searchParams.get("statut");

  // Filtrage
  let data = MOCK_RECORDS;
  if (service) data = data.filter((r) => r.service === service);
  if (statut)  data = data.filter((r) => r.statut  === statut);

  // Génération CSV (fallback sans librairie externe)
  // Pour un vrai .xlsx installez 'xlsx' (SheetJS) et remplacez ce bloc
  const headers = ["CUID", "Nom", "Prénom", "Service", "Statut", "Tâche", "Description"];
  const rows = data.map((r) =>
    [r.cuid, r.nom, r.prenom, r.service, r.statut, r.tache, r.description]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...rows].join("\r\n");

  // NOTE : retourne un CSV en attendant SheetJS
  // Pour du vrai .xlsx : npm install xlsx
  // import * as XLSX from "xlsx";
  // const ws = XLSX.utils.json_to_sheet(data);
  // const wb = XLSX.utils.book_new();
  // XLSX.utils.book_append_sheet(wb, ws, "Rapport");
  // const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  // return new NextResponse(buf, {
  //   headers: {
  //     "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  //     "Content-Disposition": `attachment; filename="rapport_taches.xlsx"`,
  //   },
  // });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapport_taches_${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
