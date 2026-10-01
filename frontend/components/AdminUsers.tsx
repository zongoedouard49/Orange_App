"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { Loader2, RefreshCw, Search, UserCheck, UserX, ShieldOff } from "lucide-react";
import { API_ROUTES } from "@/lib/api";
import { parseApiError, formatApiError, parseError, getAdminAuthHeaders } from "@/lib/errors";
import ApiErrorDisplay from "@/components/ApiErrorDisplay";

const ACTIVATION_METHOD = "PATCH";

type AdminAccount = {
  id: number | string;
  cuid?: string;
  actif?: boolean;
  active?: boolean;
  enabled?: boolean;
  created_at?: string;
  [key: string]: unknown;
};

const isActive = (a: AdminAccount) => Boolean(a.actif ?? a.active ?? a.enabled);

// authHeaders importé depuis @/lib/errors → getAdminAuthHeaders

// parseErrorDetail remplacé par parseApiError depuis @/lib/errors

type BlockedIP = {
  id: number | string;
  adresse_ip: string;
  cuid: string;
  adresse_mac: string;
  raison: string;
  date_creation: string;
};

export default function AdminUsers() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"tous" | "actifs" | "inactifs">("tous");
  const [pendingId, setPendingId] = useState<number | string | null>(null);

  // Blocked IPs
  const [blockedIps, setBlockedIps] = useState<BlockedIP[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState<number | string | null>(null);

  const load = useCallback(async (silent?: unknown) => {
    const quiet = silent === true; // rechargement temps réel : sans clignotement (utilisé aussi comme onClick)
    if (!quiet) { setLoading(true); setError(""); }
    try {
      const res = await fetch(API_ROUTES.admins, { headers: getAdminAuthHeaders() });
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem("admin_token");
          window.location.href = "/admin";
          return;
        }
        const raw = await res.text().catch(() => "");
        const apiErr = await parseApiError(res, raw);
        throw new Error(formatApiError(apiErr));
      }
      const data = await res.json();
      setAdmins(Array.isArray(data) ? data : data?.content ?? data?.data ?? []);
    } catch (e: any) {
      if (!quiet) setError(parseError(e) || "Impossible de charger les utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBlockedIps = useCallback(async (silent?: unknown) => {
    if (silent !== true) setLoadingBlocked(true);
    try {
      const res = await fetch(API_ROUTES.blockedIps, { headers: getAdminAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBlockedIps(Array.isArray(data) ? data : []);
      }
    } catch {} finally { setLoadingBlocked(false); }
  }, []);

  useEffect(() => { load(); loadBlockedIps(); }, [load, loadBlockedIps]);

  // Temps réel : comptes administrateurs et IP bloquées
  useRealtime("admin", (e) => {
    if (e.type === "resync" || e.resource === "admins") void load(true);
    if (e.type === "resync" || e.resource === "blocked_ips") void loadBlockedIps(true);
  });

  const unblockIp = async (ip: BlockedIP) => {
    if (!window.confirm(`Débloquer l'adresse IP "${ip.adresse_ip}" ?`)) return;
    setUnblockingId(ip.id);
    try {
      const res = await fetch(API_ROUTES.unblockIp(ip.id), { method: "DELETE", headers: getAdminAuthHeaders() });
      if (res.ok) {
        setBlockedIps((list) => list.filter((b) => b.id !== ip.id));
      } else {
        const raw = await res.text().catch(() => "");
        const apiErr = await parseApiError(res, raw);
        setError(formatApiError(apiErr));
      }
    } catch (e: any) {
      setError(parseError(e) || "Échec de l'opération.");
    } finally { setUnblockingId(null); }
  };

  const toggle = async (admin: AdminAccount) => {
    const next = !isActive(admin);
    setPendingId(admin.id);
    setError("");
    try {
      const res = await fetch(API_ROUTES.adminActivation(admin.id, next), {
        method: ACTIVATION_METHOD,
        headers: getAdminAuthHeaders(),
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        const apiErr = await parseApiError(res, raw);
        throw new Error(formatApiError(apiErr));
      }
      setAdmins((list) =>
        list.map((a) =>
          a.id === admin.id ? { ...a, actif: next, active: next, enabled: next } : a,
        ),
      );
    } catch (e: any) {
      setError(parseError(e) || `Échec de la ${next ? "activation" : "désactivation"}.`);
    } finally {
      setPendingId(null);
    }
  };

  // Merge blocked regular users into the list
  type MergedUser = AdminAccount & { privilege: "Admin" | "Utilisateur" };

  const mergedUsers = useMemo((): MergedUser[] => {
    const adminEntries: MergedUser[] = admins.map((a) => ({ ...a, privilege: "Admin" as const }));
    // Add blocked regular users (by CUID) that aren't already admins
    const adminCuids = new Set(admins.map((a) => a.cuid?.toLowerCase()).filter(Boolean));
    const blockedUsers: MergedUser[] = blockedIps
      .filter((ip) => ip.cuid && !adminCuids.has(ip.cuid.toLowerCase()))
      .reduce<MergedUser[]>((acc, ip) => {
        // Deduplicate by CUID
        if (!acc.some((u) => u.cuid?.toLowerCase() === ip.cuid.toLowerCase())) {
          acc.push({
            id: `blocked-${ip.id}`,
            cuid: ip.cuid,
            actif: false,
            created_at: ip.date_creation,
            privilege: "Utilisateur",
          });
        }
        return acc;
      }, []);
    return [...adminEntries, ...blockedUsers];
  }, [admins, blockedIps]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mergedUsers.filter((a) => {
      if (filter === "actifs" && !isActive(a)) return false;
      if (filter === "inactifs" && isActive(a)) return false;
      if (!q) return true;
      return [a.cuid].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [mergedUsers, query, filter]);

  const activeCount = mergedUsers.filter(isActive).length;

  const formatDate = (d?: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return d; }
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Utilisateurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Liste des administrateurs. Activez ou désactivez leur accès au panneau.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground transition-all hover:bg-accent disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: mergedUsers.length },
          { label: "Actifs", value: activeCount },
          { label: "Inactifs", value: mergedUsers.length - activeCount },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-card-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par CUID…"
            className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary">
          <option value="tous">Tous</option>
          <option value="actifs">Actifs</option>
          <option value="inactifs">Inactifs</option>
        </select>
      </div>

      <ApiErrorDisplay error={error} className="mb-4" onClose={() => setError("")} />

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">CUID</th>
                <th className="px-4 py-3">Privilège</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date de création</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && admins.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              )}
              {visible.map((a) => {
                const on = isActive(a);
                const busy = pendingId === a.id;
                return (
                  <tr key={a.id} className="border-t border-border transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3 font-medium text-card-foreground">{a.cuid ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        a.privilege === "Admin" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {a.privilege}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        on ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-primary" : "bg-muted-foreground"}`} />
                        {on ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(a.created_at as string)}</td>
                    <td className="px-4 py-3 text-right">
                      {a.privilege === "Admin" ? (
                        <button onClick={() => toggle(a)} disabled={busy}
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-60 ${
                            on
                              ? "border border-destructive/40 text-destructive hover:bg-destructive/10"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          }`}>
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : on ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          {on ? "Désactiver" : "Activer"}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Bloqué</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── IP Bloquées ── */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Adresses IP bloquées</h2>
            {/*<p className="mt-1 text-sm text-muted-foreground">IP bloquées automatiquement pour activité suspecte.</p>*/}
          </div>
          <button onClick={loadBlockedIps} disabled={loadingBlocked}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground transition-all hover:bg-accent disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loadingBlocked ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Adresse IP</th>
                  <th className="px-4 py-3">CUID</th>
                  <th className="px-4 py-3">Raison</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingBlocked && blockedIps.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
                )}
                {!loadingBlocked && blockedIps.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Aucune IP bloquée.</td></tr>
                )}
                {blockedIps.map((ip) => (
                  <tr key={ip.id} className="border-t border-border transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3 font-mono text-sm font-medium">{ip.adresse_ip}</td>
                    <td className="px-4 py-3">{ip.cuid || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">{ip.raison}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(ip.date_creation)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => unblockIp(ip)} disabled={unblockingId === ip.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                        {unblockingId === ip.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
                        Débloquer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
