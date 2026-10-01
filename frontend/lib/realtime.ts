/**
 * lib/realtime.ts — client temps réel (WebSocket) avec reconnexion automatique.
 *
 * • Un seul canal par type de session ("admin" | "user"), partagé par tous les composants.
 * • Authentification : JWT envoyé dans le 1er message (jamais dans l'URL).
 * • Reconnexion avec délai progressif (1 s → 30 s) ; à chaque reconnexion, un événement
 *   "resync" est émis pour recharger ce qui a pu être manqué pendant la coupure.
 * • Le serveur n'envoie que {resource, action} : les données sont rechargées via l'API.
 */
import { API_BASE_URL } from "@/lib/api";

export type RealtimeKind = "admin" | "user";
export type RealtimeStatus = "connecting" | "connected" | "disconnected";
export type RealtimeEvent =
  | { type: "change"; resource: string; action: "insert" | "update" | "delete"; ts: number }
  | { type: "resync" };

type Listener = { onEvent?: (e: RealtimeEvent) => void; onStatus?: (s: RealtimeStatus) => void };

const TOKEN_KEYS: Record<RealtimeKind, string> = { admin: "admin_token", user: "user_token" };
const PING_INTERVAL_MS = 25_000;
const NO_RETRY_CODES = new Set([4401, 4403]); // authentification / origine refusées

class Channel {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private status: RealtimeStatus = "disconnected";
  private attempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private hadConnection = false;
  private stopped = true;

  constructor(private kind: RealtimeKind) {}

  getStatus() { return this.status; }

  add(l: Listener) {
    this.listeners.add(l);
    l.onStatus?.(this.status);
    if (this.stopped) this.start();
    return () => {
      this.listeners.delete(l);
      if (this.listeners.size === 0) this.stop();
    };
  }

  private setStatus(s: RealtimeStatus) {
    if (this.status === s) return;
    this.status = s;
    this.listeners.forEach((l) => l.onStatus?.(s));
  }

  private emit(e: RealtimeEvent) {
    this.listeners.forEach((l) => { try { l.onEvent?.(e); } catch { /* un écouteur ne doit pas casser les autres */ } });
  }

  private start() {
    this.stopped = false;
    window.addEventListener("online", this.wake);
    document.addEventListener("visibilitychange", this.wake);
    this.connect();
  }

  private stop() {
    this.stopped = true;
    window.removeEventListener("online", this.wake);
    document.removeEventListener("visibilitychange", this.wake);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.clearPing();
    this.ws?.close(1000);
    this.ws = null;
    this.hadConnection = false;
    this.attempts = 0;
    this.setStatus("disconnected");
  }

  // Reconnexion immédiate quand le réseau revient ou que l'onglet redevient visible
  private wake = () => {
    if (this.stopped || this.status === "connected" || this.status === "connecting") return;
    if (document.visibilityState === "hidden") return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.connect();
  };

  private clearPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private connect() {
    const token = sessionStorage.getItem(TOKEN_KEYS[this.kind]);
    if (!token) { this.setStatus("disconnected"); return; }

    this.setStatus("connecting");
    const ws = new WebSocket(`${API_BASE_URL.replace(/^http/i, "ws")}/ws`);
    this.ws = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token }));

    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string" || ev.data === "pong") return;
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === "ready") {
        this.attempts = 0;
        this.setStatus("connected");
        this.clearPing();
        this.pingTimer = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send("ping"); }, PING_INTERVAL_MS);
        if (this.hadConnection) this.emit({ type: "resync" }); // rattrapage après coupure
        this.hadConnection = true;
      } else if (msg.type === "change" && typeof msg.resource === "string") {
        this.emit(msg as RealtimeEvent);
      }
    };

    ws.onclose = (ev) => {
      this.clearPing();
      if (this.ws === ws) this.ws = null;
      this.setStatus("disconnected");
      if (this.stopped || NO_RETRY_CODES.has(ev.code)) return;
      const delay = Math.min(30_000, 1000 * 2 ** this.attempts) + Math.random() * 500;
      this.attempts += 1;
      this.retryTimer = setTimeout(() => { if (!this.stopped) this.connect(); }, delay);
    };

    ws.onerror = () => { /* onclose gère la reconnexion */ };
  }
}

const channels: Partial<Record<RealtimeKind, Channel>> = {};

export function subscribeRealtime(kind: RealtimeKind, listener: Listener): () => void {
  if (typeof window === "undefined") return () => {};
  const channel = (channels[kind] ??= new Channel(kind));
  return channel.add(listener);
}
