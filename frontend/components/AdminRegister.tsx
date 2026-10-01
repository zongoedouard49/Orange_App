"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { API_ROUTES } from "@/lib/api";
import { parseApiError, formatApiError, parseError } from "@/lib/errors";
import AuthShell from "@/components/brand/AuthShell";
import PasswordInput from "@/components/brand/PasswordInput";

export default function AdminRegister() {
  const [cuid, setCuid] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [success, setSuccess] = useState(false);

  const mismatch = confirmation.length > 0 && password !== confirmation;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      setAttempt((n) => n + 1);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(API_ROUTES.adminRegister, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuid, password }),
      });
      if (!response.ok) {
        const raw = await response.text().catch(() => "");
        const apiErr = await parseApiError(response, raw);
        throw new Error(formatApiError(apiErr));
      }
      setSuccess(true);
      setCuid("");
      setPassword("");
      setConfirmation("");
    } catch (registrationError) {
      setError(parseError(registrationError) || "Impossible de créer le compte.");
      setAttempt((n) => n + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={success ? "Compte créé" : "Créer un compte administrateur"}
      subtitle={success ? undefined : "Le compte sera inactif tant qu'un administrateur ne l'aura pas activé."}
      seed={77}
      links={<Link href="/admin" className="text-link text-link--muted">Retour à la connexion administrateur</Link>}
    >
      {success ? (
        <div className="auth-form">
          <div className="notice notice--success" role="status">
            <CheckCircle2 aria-hidden="true" />
            <span>Votre compte est créé mais inactif. Un administrateur doit l&apos;activer avant votre première connexion.</span>
          </div>
          <Link href="/admin" className="btn btn-primary btn-block">Aller à la connexion</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="register-cuid" className="field-label">CUID</label>
            <input id="register-cuid" type="text" required autoComplete="username" value={cuid}
              onChange={(e) => setCuid(e.target.value)} placeholder="Ex. ABCD1234" className="input" />
          </div>
          <div className="field">
            <label htmlFor="register-password" className="field-label">Mot de passe</label>
            <PasswordInput id="register-password" required minLength={6} autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 caractères minimum" />
          </div>
          <div className="field">
            <label htmlFor="register-confirmation" className="field-label">Confirmer le mot de passe</label>
            <PasswordInput id="register-confirmation" required minLength={6} autoComplete="new-password"
              value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Répétez le mot de passe"
              aria-invalid={mismatch} aria-describedby={mismatch ? "register-mismatch" : undefined} />
            {mismatch && (
              <p id="register-mismatch" className="field-error">
                <AlertCircle aria-hidden="true" /> Les mots de passe ne correspondent pas.
              </p>
            )}
          </div>

          {error && (
            <div key={attempt} className={`notice ${attempt > 1 ? "shake" : ""}`} role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary btn-block">
            {loading ? <><Loader2 className="spin" aria-hidden="true" /> Création…</> : "Créer le compte"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
