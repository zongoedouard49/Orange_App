"use client";

import type { CSSProperties } from "react";
import { useRealtimeStatus } from "@/hooks/use-realtime";
import type { RealtimeKind } from "@/lib/realtime";

const LABELS = {
  connected: { text: "Mises à jour en direct", color: "#228722" },
  connecting: { text: "Connexion au direct…", color: "#b98a00" },
  disconnected: { text: "Direct indisponible", color: "#cd3c14" },
} as const;

export default function LiveIndicator({ kind = "admin", enabled = true }: { kind?: RealtimeKind; enabled?: boolean }) {
  const status = useRealtimeStatus(kind, enabled);
  const { text, color } = LABELS[status];
  return (
    <span className="live" role="status" aria-live="polite">
      <span className={`live-dot ${status === "connected" ? "is-on" : ""}`} style={{ "--c": color } as CSSProperties} />
      {text}
    </span>
  );
}
