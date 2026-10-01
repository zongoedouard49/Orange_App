import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/renseignements/submit
 *
 * Reçoit les informations personnelles + uniquement les tâches cochées
 * (avec leur description). Remplacez la logique mock par un vrai
 * enregistrement en base de données.
 *
 * Corps attendu :
 * {
 *   cuid: string,
 *   nom: string,
 *   prenom: string,
 *   service: string,
 *   statut: "employer" | "prestataire",
 *   taches: { id: number | string, text: string, description: string }[]
 * }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  const { cuid, nom, prenom, service, statut, taches } = body ?? {};

  if (!cuid || !nom || !prenom || !service || !statut) {
    return NextResponse.json(
      { error: "Champs obligatoires manquants." },
      { status: 400 }
    );
  }

  if (!Array.isArray(taches) || taches.length === 0) {
    return NextResponse.json(
      { error: "Aucune tâche sélectionnée." },
      { status: 400 }
    );
  }

  const invalid = taches.find(
    (t: { description?: string }) => !t.description || !t.description.trim()
  );
  if (invalid) {
    return NextResponse.json(
      { error: "Chaque tâche sélectionnée doit avoir une description." },
      { status: 400 }
    );
  }

  // TODO: remplacer par un enregistrement réel (BDD, service externe, etc.)
  console.log("Renseignements reçus :", { cuid, nom, prenom, service, statut, taches });

  return NextResponse.json({ ok: true, received: taches.length });
}
