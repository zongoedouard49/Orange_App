/**
 * lib/errors.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralisation du parsing des erreurs API.
 *
 * FastAPI peut retourner plusieurs formes d'erreur :
 *
 *   • HTTP 4xx/5xx avec  { "detail": "message texte" }       → chaîne simple
 *   • HTTP 422 Pydantic  { "detail": [{loc, msg, type}, …] } → tableau d'objets
 *   • Erreur réseau (offline, CORS, timeout)                  → TypeError JS
 *
 * Cette lib convertit toujours en chaîne française lisible,
 * sans jamais exposer le JSON brut à l'utilisateur.
 */

// ── Mapping champs Pydantic → noms lisibles en français ──────────────────────
const FIELD_LABELS: Record<string, string> = {
  cuid:                 "CUID",
  nom:                  "Nom",
  prenom:               "Prénom",
  password:             "Mot de passe",
  direction:            "Direction",
  statut:               "Statut",
  entreprise_partenaire:"Entreprise partenaire",
  plateforme:           "Plateforme",
  description:          "Description",
  plateformes:          "Plateformes",
  file:                 "Fichier",
  // champs admin
  actif:                "État du compte",
  created_at:           "Date de création",
};

/** Convertit un chemin loc Pydantic ["body","nom"] → "Nom" */
function labelFromLoc(loc: unknown[]): string {
  // On ignore "body" / "query" / index numérique
  const parts = loc
    .filter((p) => typeof p === "string" && p !== "body" && p !== "query" && p !== "path")
    .map((p) => FIELD_LABELS[p as string] ?? String(p));
  return parts.join(" › ") || "Champ inconnu";
}

// ── Mapping messages Pydantic v1 & v2 → français ─────────────────────────────
function translateMsg(msg: string, type?: string): string {
  const m = msg.toLowerCase();
  const t = (type ?? "").toLowerCase();

  if (m.includes("field required") || t.includes("missing"))
    return "Ce champ est obligatoire";
  if (m.includes("value is not a valid email") || t.includes("email"))
    return "L'adresse e-mail n'est pas valide";
  if (m.includes("str too short") || m.includes("at least"))
    return "La valeur saisie est trop courte";
  if (m.includes("str too long") || m.includes("at most"))
    return "La valeur saisie est trop longue";
  if (m.includes("none is not an allowed value") || t.includes("none_required"))
    return "Ce champ ne peut pas être vide";
  if (m.includes("value is not a valid integer") || t.includes("int_"))
    return "La valeur doit être un nombre entier";
  if (m.includes("value could not be parsed") || t.includes("float"))
    return "La valeur n'est pas un nombre valide";
  if (m.includes("value is not a valid") || t.includes("enum"))
    return "La valeur sélectionnée n'est pas acceptée";
  if (m.includes("ensure this value has at least"))
    return "Le minimum requis n'est pas atteint";
  if (m.includes("ensure this value is greater"))
    return "La valeur doit être supérieure au minimum autorisé";
  if (m.includes("unique"))
    return "Cette valeur existe déjà, elle doit être unique";
  if (m.includes("not a valid") && m.includes("date"))
    return "La date saisie n'est pas valide";
  if (m.includes("unauthorized") || t.includes("auth"))
    return "Non autorisé, veuillez vous reconnecter";

  // Dernier recours : retourner le message tel quel, proprement mis en majuscule
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}

// ── Mapping codes HTTP → messages génériques ─────────────────────────────────
const HTTP_MESSAGES: Record<number, string> = {
  400: "La requête est incorrecte. Vérifiez les informations saisies.",
  401: "Session expirée ou non autorisée. Veuillez vous reconnecter.",
  403: "Accès refusé. Vous n'avez pas les droits nécessaires.",
  404: "La ressource demandée est introuvable.",
  405: "Méthode non autorisée.",
  408: "La requête a expiré. Vérifiez votre connexion et réessayez.",
  409: "Conflit : cette ressource existe déjà.",
  413: "Le fichier envoyé est trop volumineux.",
  422: "Certains champs sont incorrects ou manquants.",
  429: "Trop de tentatives. Veuillez patienter avant de réessayer.",
  500: "Erreur serveur. Veuillez réessayer ultérieurement.",
  502: "Le serveur est temporairement indisponible.",
  503: "Service indisponible. Veuillez réessayer plus tard.",
  504: "Le serveur n'a pas répondu à temps.",
};

// ── Type d'erreur structurée retournée par parseApiError ─────────────────────
export type ApiError = {
  /** Message court à afficher (une ligne) */
  message: string;
  /** Détails par champ pour les erreurs 422 */
  fieldErrors?: { field: string; message: string }[];
  /** Code HTTP reçu */
  status?: number;
};

/**
 * parseApiError — fonction principale
 *
 * @param response  L'objet Response de fetch()  (peut être null si erreur réseau)
 * @param rawBody   Texte brut du body déjà lu (évite de le lire deux fois)
 */
export async function parseApiError(
  response: Response | null,
  rawBody?: string,
): Promise<ApiError> {
  // ── Erreur réseau (pas de réponse du tout) ────────────────────────────────
  if (!response) {
    return {
      message: "Impossible de contacter le serveur. Vérifiez votre connexion réseau.",
    };
  }

  const status = response.status;

  // Lire le body si pas encore fourni
  let bodyText = rawBody ?? "";
  if (!bodyText) {
    try {
      bodyText = await response.text();
    } catch {
      bodyText = "";
    }
  }

  // Parser le JSON si possible
  let bodyJson: unknown = null;
  try {
    bodyJson = JSON.parse(bodyText);
  } catch {
    // body n'est pas du JSON valide
  }

  // ── 422 : erreurs de validation Pydantic (tableau dans detail) ────────────
  if (
    status === 422 &&
    bodyJson &&
    typeof bodyJson === "object" &&
    Array.isArray((bodyJson as any).detail)
  ) {
    const items: any[] = (bodyJson as any).detail;

    const fieldErrors = items
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        field: Array.isArray(item.loc) ? labelFromLoc(item.loc) : "Champ",
        message: translateMsg(
          typeof item.msg === "string" ? item.msg : "Valeur invalide",
          typeof item.type === "string" ? item.type : undefined,
        ),
      }));

    const plural = fieldErrors.length > 1 ? "s" : "";
    return {
      message: `${fieldErrors.length} champ${plural} incorrect${plural} dans le formulaire.`,
      fieldErrors,
      status,
    };
  }

  // ── detail est une chaîne simple ─────────────────────────────────────────
  if (
    bodyJson &&
    typeof bodyJson === "object" &&
    typeof (bodyJson as any).detail === "string"
  ) {
    const detail = (bodyJson as any).detail as string;
    return { message: detail, status };
  }

  // ── Fallback : message générique selon le code HTTP ───────────────────────
  return {
    message:
      HTTP_MESSAGES[status] ??
      `Une erreur est survenue (code ${status}). Veuillez réessayer.`,
    status,
  };
}

/**
 * parseApiError — version synchrone pour les blocs catch qui ont déjà un Error
 *
 * Gère deux cas :
 *   - L'erreur vient d'un fetchJson (message déjà parsé, simple string)
 *   - L'erreur est un objet inconnu
 */
export function parseError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Une erreur inattendue est survenue.";
}

/**
 * Formate une ApiError en string simple (pour les composants qui n'affichent
 * qu'une seule ligne d'erreur).
 */
export function formatApiError(err: ApiError): string {
  if (err.fieldErrors && err.fieldErrors.length > 0) {
    return err.fieldErrors
      .map((fe) => `${fe.field} : ${fe.message}`)
      .join(" — ");
  }
  return err.message;
}

// ── fetchJson centralisé ──────────────────────────────────────────────────────
/**
 * Wrapper fetch qui :
 *  1. Gère le 401 → redirige vers /admin
 *  2. Parse toutes les erreurs en français via parseApiError
 *  3. Retourne le JSON parsé ou null (204 / non-JSON)
 */
export async function fetchJson(
  url: string,
  options?: RequestInit,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { ...(options?.headers ?? {}) },
    });
  } catch {
    // Erreur réseau (offline, CORS, DNS…)
    throw new Error(
      "Impossible de contacter le serveur. Vérifiez votre connexion réseau.",
    );
  }

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("admin_token");
      window.location.href = "/admin";
    }
    throw new Error("Session expirée. Reconnexion en cours…");
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    const apiErr = await parseApiError(response, raw);
    throw new Error(formatApiError(apiErr));
  }

  if (response.status === 204) return null;
  const ct = response.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return null;
  return response.json();
}

/** Helper auth headers — à utiliser dans les composants */
export function getAdminAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = sessionStorage.getItem("admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
