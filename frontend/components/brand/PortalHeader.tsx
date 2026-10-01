import type { ReactNode } from "react";
import { LogOut } from "lucide-react";

type Props = {
  title: string;
  user?: string;
  onLogout?: () => void;
  children?: ReactNode;
};

export default function PortalHeader({ title, user, onLogout, children }: Props) {
  return (
    <header className="portal-header">
      <div className="portal-header-brand">
        <img src="/favicon.ico" alt="Orange Burkina Faso" />
        <span className="portal-header-name">{title}</span>
      </div>
      <div className="portal-header-right">
        {children}
        {user && (
          <span className="portal-header-user">
            Connecté : <strong>{user}</strong>
          </span>
        )}
        {onLogout && (
          <button type="button" onClick={onLogout} className="portal-logout" aria-label="Déconnexion">
            <LogOut aria-hidden="true" />
            <span className="portal-logout-label">Déconnexion</span>
          </button>
        )}
      </div>
    </header>
  );
}
