/**
 * ApiErrorDisplay.tsx
 * Composant d'affichage des erreurs API — s'adapte au type d'erreur :
 *   • Erreur simple : bandeau rouge avec message
 *   • Erreur 422 multi-champs : liste des champs en erreur
 */
"use client";

import { AlertCircle, XCircle } from "lucide-react";
import type { ApiError } from "@/lib/errors";

interface Props {
  /** Peut être une ApiError structurée ou une simple string */
  error: ApiError | string | null | undefined;
  className?: string;
  onClose?: () => void;
}

export default function ApiErrorDisplay({ error, className = "", onClose }: Props) {
  if (!error) return null;

  // Normaliser en ApiError
  const err: ApiError =
    typeof error === "string"
      ? { message: error }
      : error;

  const hasFields = err.fieldErrors && err.fieldErrors.length > 0;

  return (
    <div
      role="alert"
      className={`border-l-4 border-destructive bg-destructive/10 animate-in fade-in slide-in-from-top-1 duration-300 ${className}`}
    >
      {/* En-tête */}
      <div className="flex items-start gap-3 p-4">
        {hasFields ? (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        ) : (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-destructive leading-snug">
            {err.message}
          </p>

          {/* Liste des erreurs par champ (422) */}
          {hasFields && (
            <ul className="mt-2 space-y-1">
              {err.fieldErrors!.map((fe, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm text-destructive/90">
                  <span className="shrink-0 font-medium">• {fe.field} :</span>
                  <span>{fe.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded p-0.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Version inline compacte — pour les tooltips / messages sous les champs.
 */
export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-destructive font-medium">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}
