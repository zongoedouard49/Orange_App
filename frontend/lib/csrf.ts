/**
 * lib/csrf.ts — protection CSRF côté navigateur.
 *
 * Installe un wrapper autour de window.fetch : pour toute requête modifiante
 * (POST/PUT/PATCH/DELETE) vers l'API, il ajoute l'en-tête X-CSRF-Token et
 * envoie les cookies (credentials: "include"). Le jeton est obtenu via GET
 * /csrf-token, mis en cache, et renouvelé automatiquement (1 nouvel essai)
 * si le serveur répond « csrf_invalid ».
 *
 * Aucun appel fetch existant n'a besoin d'être modifié.
 */
import { API_BASE_URL } from "@/lib/api";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

let installed = false;
let cachedToken: string | null = null;
let cachedHeaderName = "X-CSRF-Token";
let pending: Promise<string> | null = null;

export function installCsrfFetch(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  async function loadToken(force = false): Promise<string> {
    if (cachedToken && !force) return cachedToken;
    if (!pending) {
      pending = originalFetch(`${API_BASE_URL}/csrf-token`, { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) throw new Error("Impossible d'obtenir le jeton de sécurité.");
          const data = await res.json();
          cachedToken = data.csrf_token;
          cachedHeaderName = data.header_name || cachedHeaderName;
          return cachedToken as string;
        })
        .finally(() => { pending = null; });
    }
    return pending;
  }

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Seules les URL sous forme de chaîne/URL sont gérées (relançables) ; le reste passe tel quel
    if (input instanceof Request) return originalFetch(input, init);
    const url = typeof input === "string" ? input : input.href;
    const method = (init?.method ?? "GET").toUpperCase();

    if (!url.startsWith(API_BASE_URL) || SAFE_METHODS.has(method)) {
      return originalFetch(input, init);
    }

    const send = async (token: string) => {
      const headers = new Headers(init?.headers);
      headers.set(cachedHeaderName, token);
      return originalFetch(input, { ...init, headers, credentials: "include" });
    };

    let response = await send(await loadToken());
    if (response.status === 403) {
      const body = await response.clone().json().catch(() => null);
      if (body?.code === "csrf_invalid") {
        response = await send(await loadToken(true)); // jeton expiré : on le renouvelle une fois
      }
    }
    return response;
  };
}

// Installation dès le chargement du module côté navigateur (avant les effets des composants)
installCsrfFetch();
