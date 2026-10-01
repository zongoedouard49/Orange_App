"use client";

import "@/lib/csrf"; // installe le wrapper fetch (jeton CSRF) au chargement

export default function CsrfProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
