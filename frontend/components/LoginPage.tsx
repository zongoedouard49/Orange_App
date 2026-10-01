"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { API_ROUTES } from "@/lib/api";
import { parseError } from "@/lib/errors";
import AuthShell from "@/components/brand/AuthShell";
import PasswordInput from "@/components/brand/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const [cuid, setCuid] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0); // relance l'animation d'erreur à chaque échec

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const adresse_mac = "";

      const res = await fetch(API_ROUTES.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuid, password, adresse_mac }),
      });

      if (!res.ok) {
        throw new Error("CUID ou mot de passe incorrect.");
      }

      const data = await res.json();
      if (data.token || data.access_token) {
        sessionStorage.setItem("user_token", data.token || data.access_token);
      }
      sessionStorage.setItem("cuid", cuid);

      if (data.data?.deja_soumis) {
        setError("Vous avez déjà envoyé votre déclaration avec ce CUID. Une seule déclaration est acceptée.");
        setAttempt((n) => n + 1);
        return;
      }

      router.push("/renseignements");
    } catch (e: any) {
      setError(parseError(e) || "CUID ou mot de passe incorrect.");
      setAttempt((n) => n + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Connexion"
      subtitle="Utilisez votre CUID et votre mot de passe habituels."
      seed={2026}
      links={
        <Link href="/admin" className="text-link text-link--muted">
          Accès administrateur
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="field">
          <label htmlFor="cuid" className="field-label">CUID</label>
          <input
            id="cuid" type="text" required autoComplete="username" autoFocus
            value={cuid} onChange={(e) => setCuid(e.target.value)}
            placeholder="Ex. ABCD1234" className="input"
          />
        </div>
        <div className="field">
          <label htmlFor="password" className="field-label">Mot de passe</label>
          <PasswordInput
            id="password" required autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Votre mot de passe"
          />
        </div>

        {error && (
          <div key={attempt} className={`notice ${attempt > 1 ? "shake" : ""}`} role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary btn-block">
          {loading ? <><Loader2 className="spin" aria-hidden="true" /> Connexion…</> : "Se connecter"}
        </button>
      </form>
    </AuthShell>
  );
}
