"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeRealtime, type RealtimeEvent, type RealtimeKind, type RealtimeStatus } from "@/lib/realtime";

/** Appelle `handler` à chaque modification poussée par le serveur (et à chaque resynchronisation). */
export function useRealtime(kind: RealtimeKind, handler: (e: RealtimeEvent) => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler; // toujours la version la plus récente, sans se réabonner

  useEffect(() => {
    if (!enabled) return;
    return subscribeRealtime(kind, { onEvent: (e) => ref.current(e) });
  }, [kind, enabled]);
}

/** État de la connexion temps réel (pour l'indicateur « En direct »). */
export function useRealtimeStatus(kind: RealtimeKind, enabled = true): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("disconnected");
  useEffect(() => {
    if (!enabled) return;
    return subscribeRealtime(kind, { onStatus: setStatus });
  }, [kind, enabled]);
  return status;
}
