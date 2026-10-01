import type { ReactNode } from "react";
import SignalGrid from "./SignalGrid";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  links?: ReactNode;
  /** Graine de la grille : chaque écran a son propre motif */
  seed?: number;
};

export default function AuthShell({ title, subtitle, children, links, seed }: Props) {
  return (
    <div className="auth">
      <section className="auth-stage" aria-label="Présentation">
        <div className="auth-brand">
          <img src="/favicon.ico" alt="" />
          <span>Orange Burkina Faso</span>
        </div>

        <SignalGrid seed={seed} />

        <div className="auth-stage-copy">
          <p className="auth-stage-title">Déclaration d&apos;utilisation des plateformes internes</p>
          <p className="auth-stage-text">
            Indiquez les outils que vous utilisez et ce que vous y faites. Une seule déclaration par collaborateur.
          </p>
        </div>
      </section>

      <main className="auth-panel">
        <div className="auth-panel-inner">
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
          {links && <div className="auth-links">{links}</div>}
          <p className="auth-legal">© 2026 Orange Burkina Faso</p>
        </div>
      </main>
    </div>
  );
}
