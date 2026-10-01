"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Settings,
  FileSpreadsheet,
  LogOut,
  Plus,
  Trash2,
  Download,
  Loader2,
  RefreshCw,
  FileText,
  Users,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  BookOpen,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import AuthShell from "@/components/brand/AuthShell";
import PasswordInput from "@/components/brand/PasswordInput";
import PortalHeader from "@/components/brand/PortalHeader";
import AdminUsers from "@/components/AdminUsers";
import { API_ROUTES } from "@/lib/api";
import { fetchJson, getAdminAuthHeaders, parseError, parseApiError, formatApiError, type ApiError } from "@/lib/errors";
import ApiErrorDisplay from "@/components/ApiErrorDisplay";
import LiveIndicator from "@/components/LiveIndicator";
import { useRealtime } from "@/hooks/use-realtime";

type EntryType = "direction" | "plateforme" | "partenaire";
type PreviewType = "services" | "plateformes" | "partenaires";

type RapportRow = {
  id: number | string;
  CUID: string;
  Nom: string;
  prenom: string;
  direction: string;
  statut: string;
  entreprise_partenaire: string;
  plateforme: string;
  description: string;
};

type LogRow = {
  id: number | string;
  cuid: string;
  action: string;
  adresse_ip: string;
  adresse_mac: string;
  date_creation: string;
};

type RensLogRow = {
  id: number | string;
  cuid: string;
  adresse_ip: string;
  adresse_mac: string;
  date_creation: string;
};

type AdminView = "parametres" | "rapport" | "utilisateurs" | "logs" | "logs_renseignements" | "comptes_bloques" | "ajouter_utilisateurs";

type PlateformeBloqueeRow = { text: string; description: string };

type CompteBloqueRow = {
  id: number | string;
  cuid: string;
  nom: string;
  prenom: string;
  direction: string;
  statut: string;
  entreprise_partenaire: string;
  plateformes: PlateformeBloqueeRow[];
  date_creation: string;
};

const inputCls =
  "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 transition-colors";

const selectCls =
  "rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 transition-colors";

// fetchJson et parseError importés depuis @/lib/errors

/** Parsing synchrone rapide pour les fetch() manuels (exports fichiers). */
function parseRawError(raw: string, status: number): string {
  try {
    const p = JSON.parse(raw);
    if (typeof p?.detail === "string") return p.detail;
    if (Array.isArray(p?.detail)) {
      return p.detail
        .filter((d: any) => d && typeof d === "object")
        .map((d: any) => {
          const field = Array.isArray(d.loc)
            ? d.loc.filter((x: any) => typeof x === "string" && x !== "body").join(" › ")
            : "";
          const msg = typeof d.msg === "string" ? d.msg : "Valeur invalide";
          return field ? `${field} : ${msg}` : msg;
        })
        .join(" — ");
    }
  } catch {}
  const HTTP: Record<number, string> = {
    400: "Requête incorrecte.",
    401: "Session expirée, veuillez vous reconnecter.",
    403: "Accès refusé.",
    404: "Ressource introuvable.",
    409: "Cette ressource existe déjà.",
    422: "Données invalides dans le formulaire.",
    429: "Trop de tentatives, veuillez patienter.",
    500: "Erreur serveur, veuillez réessayer.",
  };
  return HTTP[status] ?? `Une erreur est survenue (code ${status}).`;
}

export default function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [cuid, setCuid] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<ApiError | string>("");

  const [view, setView] = useState<AdminView>("parametres");

  const [allData, setAllData] = useState<Record<string, string[]>>({ services: [], plateformes: [], partenaires: [], statuts: [] });
  const [loadingData, setLoadingData] = useState(false);

  const [newEntryName, setNewEntryName] = useState("");
  const [newEntryType, setNewEntryType] = useState<EntryType>("direction");
  const [savingEntry, setSavingEntry] = useState(false);
  const [entryError, setEntryError] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [savingFile, setSavingFile] = useState(false);
  const [fileError, setFileError] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  const [previewType, setPreviewType] = useState<PreviewType>("plateformes");
  const [previewSearch, setPreviewSearch] = useState("");

  // Rapport
  const [filterCuid, setFilterCuid] = useState("");
  const [filterDirection, setFilterDirection] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [filterPlateforme, setFilterPlateforme] = useState("");
  const [rapportData, setRapportData] = useState<RapportRow[]>([]);
  const [rapportTotal, setRapportTotal] = useState(0);
  const [rapportPage, setRapportPage] = useState(1);
  const [rapportTotalPages, setRapportTotalPages] = useState(1);
  const [loadingRapport, setLoadingRapport] = useState(false);
  const [rapportError, setRapportError] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Logs connexions
  const [logFilterCuid, setLogFilterCuid] = useState("");
  const [logFilterMac, setLogFilterMac] = useState("");
  const [logsData, setLogsData] = useState<LogRow[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [isExportingLogs, setIsExportingLogs] = useState(false);

  // Logs renseignements
  const [rensLogFilterCuid, setRensLogFilterCuid] = useState("");
  const [rensLogFilterMac, setRensLogFilterMac] = useState("");
  const [rensLogsData, setRensLogsData] = useState<RensLogRow[]>([]);
  const [rensLogsTotal, setRensLogsTotal] = useState(0);
  const [rensLogsPage, setRensLogsPage] = useState(1);
  const [rensLogsTotalPages, setRensLogsTotalPages] = useState(1);
  const [loadingRensLogs, setLoadingRensLogs] = useState(false);
  const [rensLogsError, setRensLogsError] = useState("");
  const [isExportingRensLogs, setIsExportingRensLogs] = useState(false);

  // Import utilisateurs Excel
  // type ImportRow = { cuid: string; nom: string; prenom: string; statut: string; direction: string; entreprise_partenaire: string; plateforme: string; description: string; };
  type ImportRow = {
  ligne: number;
  cuid: string;
  nom: string;
  prenom: string;
  statut: string;
  direction: string;
  entreprise_partenaire: string;
  plateforme: string;
  description: string;
  champs_manquants: string[];
  deja_inscrit?: boolean; };
  // type ImportErrorRow = { ligne: number; colonnes_vides: string[] };
  // const [importErrors, setImportErrors] = useState<ImportErrorRow[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFileKey, setImportFileKey] = useState(0);
  const [importLoading, setImportLoading] = useState(false);
  // const [importErrors, setImportErrors] = useState<ImportErrorRow[]>([]);
  const [importErrors, setImportErrors] = useState<ImportRow[]>([]);
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [importDoublons, setImportDoublons] = useState<ImportRow[]>([]); // CUID déjà renseignés (ignorés)
  const [importResultMsg, setImportResultMsg] = useState("");
  const [importStep, setImportStep] = useState<"upload" | "errors" | "preview" | "success">("upload");
  const [importConfirmLoading, setImportConfirmLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importFileError, setImportFileError] = useState("");

  // Comptes bloqués
  const [blocFilterCuid, setBlocFilterCuid] = useState("");
  const [blocData, setBlocData] = useState<CompteBloqueRow[]>([]);
  const [blocTotal, setBlocTotal] = useState(0);
  const [blocPage, setBlocPage] = useState(1);
  const [blocTotalPages, setBlocTotalPages] = useState(1);
  const [loadingBloc, setLoadingBloc] = useState(false);
  const [blocError, setBlocError] = useState("");
  const [isExportingBloc, setIsExportingBloc] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("admin_token");
    if (token) {
      setIsLoggedIn(true);
      setCuid(sessionStorage.getItem("admin_cuid") ?? ""); // affichage de l'identité après rechargement
    }
  }, []);

  const getAuthHeaders = useCallback((): HeadersInit => {
    return getAdminAuthHeaders();
  }, []);

  const loadAllData = useCallback(async (silent?: unknown) => {
    if (silent !== true) setLoadingData(true); // rechargement temps réel : sans clignotement
    try {
      const data = await fetchJson(API_ROUTES.services, { headers: getAuthHeaders() });
      if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        setAllData({
          services: Array.isArray(obj.services) ? obj.services as string[] : [],
          plateformes: Array.isArray(obj.plateformes) ? obj.plateformes as string[] : [],
          partenaires: Array.isArray(obj.partenaires) ? obj.partenaires as string[] : [],
          statuts: Array.isArray(obj.statuts) ? obj.statuts as string[] : [],
        });
      }
    } catch {} finally { setLoadingData(false); }
  }, [getAuthHeaders]);

  useEffect(() => { if (isLoggedIn) void loadAllData(); }, [isLoggedIn, loadAllData]);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const data = await fetchJson(API_ROUTES.adminLogin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuid, password }),
      });
      if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        const token = obj.access_token ?? obj.token;
        if (typeof token === "string" && token) sessionStorage.setItem("admin_token", token);
        sessionStorage.setItem("admin_cuid", cuid);
      }
      setIsLoggedIn(true);
    } catch (error) {
      setLoginError(parseError(error) || "Identifiants incorrects.");
    } finally { setLoginLoading(false); }
  };

  const addEntry = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = newEntryName.trim();
    if (!name || savingEntry) return;
    setSavingEntry(true);
    setEntryError("");
    try {
      await fetchJson(API_ROUTES.ajout, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ valeur: name, cle: newEntryType === "direction" ? "service" : newEntryType }),
      });
      setNewEntryName("");
      await loadAllData();
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : "Impossible d'ajouter.");
    } finally { setSavingEntry(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError("");
    const file = e.target.files?.[0];
    if (!file) { setSelectedFile(null); return; }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setSelectedFile(null);
      setFileInputKey((k) => k + 1);
      setFileError("Veuillez sélectionner un fichier .docx.");
      return;
    }
    setSelectedFile(file);
  };

  const addFromFile = async () => {
    if (!selectedFile || savingFile) return;
    setSavingFile(true);
    setFileError("");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      await fetchJson(API_ROUTES.wordFile, { method: "POST", headers: { ...getAuthHeaders() }, body: formData });
      setSelectedFile(null);
      setFileInputKey((k) => k + 1);
      await loadAllData();
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Impossible d'importer.");
    } finally { setSavingFile(false); }
  };

  const deleteItem = async (name: string, type_: PreviewType) => {
    if (!window.confirm(`Supprimer "${name}" ?`)) return;
    try {
      await fetchJson(API_ROUTES.delete_service, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name, type_: type_ }),
      });
      await loadAllData();
    } catch {}
  };

  // Rapport
  const loadRapport = useCallback(async (page = 1, silent = false) => {
    if (!silent) setLoadingRapport(true); // silent : rechargement temps réel, sans clignotement
    setRapportError("");
    const params = new URLSearchParams();
    if (filterCuid) params.set("cuid", filterCuid);
    if (filterDirection) params.set("direction", filterDirection);
    if (filterStatut) params.set("statut", filterStatut);
    if (filterPlateforme) params.set("plateforme", filterPlateforme);
    params.set("page", String(page));
    try {
      const resp = await fetchJson(`${API_ROUTES.list}?${params}`, { headers: getAuthHeaders() });
      const obj = resp as any;
      setRapportData((obj.data || []).map((r: any) => ({
        id: r.id, CUID: r.CUID || "", Nom: r.Nom || "", prenom: r.prenom || "",
        direction: r.direction || "", statut: r.statut || "", entreprise_partenaire: r.entreprise_partenaire || "",
        plateforme: r.plateforme || "", description: r.description || "",
      })));
      setRapportTotal(obj.total || 0);
      setRapportPage(obj.page || 1);
      setRapportTotalPages(obj.total_pages || 1);
    } catch (error) {
      if (!silent) { setRapportData([]); setRapportTotal(0); }
      if (error instanceof Error && error.message.includes("expirée")) return;
    } finally { setLoadingRapport(false); }
  }, [filterCuid, filterDirection, filterStatut, filterPlateforme, getAuthHeaders]);

  useEffect(() => {
    if (isLoggedIn && view === "rapport") {
      const timer = setTimeout(() => void loadRapport(1), 300);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, view, filterCuid, filterDirection, filterStatut, filterPlateforme, loadRapport]);

  const exportExcel = async () => {
    setIsExporting(true);
    setRapportError("");
    const params = new URLSearchParams();
    if (filterCuid) params.set("cuid", filterCuid);
    if (filterDirection) params.set("direction", filterDirection);
    if (filterStatut) params.set("statut", filterStatut);
    if (filterPlateforme) params.set("plateforme", filterPlateforme);
    try {
      const response = await fetch(`${API_ROUTES.rapportExport}?${params}`, { headers: getAuthHeaders() });
      if (response.status === 401) { sessionStorage.removeItem("admin_token"); window.location.href = "/admin"; return; }
      if (!response.ok) { const raw = await response.text().catch(() => ""); throw new Error(parseRawError(raw, response.status)); }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `rapport_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setRapportError(error instanceof Error ? error.message : "Export impossible.");
    } finally { setIsExporting(false); }
  };

  // Logs connexions
  const loadLogs = useCallback(async (page = 1, silent = false) => {
    if (!silent) setLoadingLogs(true); // silent : rechargement temps réel, sans clignotement
    setLogsError("");
    const params = new URLSearchParams();
    if (logFilterCuid) params.set("cuid", logFilterCuid);
    if (logFilterMac) params.set("adresse_mac", logFilterMac);
    params.set("page", String(page));
    try {
      const resp = await fetchJson(`${API_ROUTES.logsList}?${params}`, { headers: getAuthHeaders() });
      const obj = resp as any;
      setLogsData((obj.data || []).map((r: any) => ({
        id: r.id, cuid: r.cuid || "", action: r.action || "login",
        adresse_ip: r.adresse_ip || "", adresse_mac: r.adresse_mac || "", date_creation: r.date_creation || "",
      })));
      setLogsTotal(obj.total || 0);
      setLogsPage(obj.page || 1);
      setLogsTotalPages(obj.total_pages || 1);
    } catch (error) {
      if (!silent) { setLogsData([]); setLogsTotal(0); }
      if (error instanceof Error && error.message.includes("expirée")) return;
    } finally { setLoadingLogs(false); }
  }, [logFilterCuid, logFilterMac, getAuthHeaders]);

  useEffect(() => {
    if (isLoggedIn && view === "logs") {
      const timer = setTimeout(() => void loadLogs(1), 300);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, view, logFilterCuid, logFilterMac, loadLogs]);

  const exportLogsExcel = async () => {
    setIsExportingLogs(true);
    setLogsError("");
    const params = new URLSearchParams();
    if (logFilterCuid) params.set("cuid", logFilterCuid);
    if (logFilterMac) params.set("adresse_mac", logFilterMac);
    try {
      const response = await fetch(`${API_ROUTES.logsExport}?${params}`, { headers: getAuthHeaders() });
      if (response.status === 401) { sessionStorage.removeItem("admin_token"); window.location.href = "/admin"; return; }
      if (!response.ok) throw new Error("Export impossible.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `logs_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : "Export impossible.");
    } finally { setIsExportingLogs(false); }
  };

  // Logs renseignements
  const loadRensLogs = useCallback(async (page = 1, silent = false) => {
    if (!silent) setLoadingRensLogs(true); // silent : rechargement temps réel, sans clignotement
    setRensLogsError("");
    const params = new URLSearchParams();
    if (rensLogFilterCuid) params.set("cuid", rensLogFilterCuid);
    if (rensLogFilterMac) params.set("adresse_mac", rensLogFilterMac);
    params.set("page", String(page));
    try {
      const resp = await fetchJson(`${API_ROUTES.renseignementsLogs}?${params}`, { headers: getAuthHeaders() });
      const obj = resp as any;
      setRensLogsData((obj.data || []).map((r: any) => ({
        id: r.id, cuid: r.cuid || "", adresse_ip: r.adresse_ip || "",
        adresse_mac: r.adresse_mac || "", date_creation: r.date_creation || "",
      })));
      setRensLogsTotal(obj.total || 0);
      setRensLogsPage(obj.page || 1);
      setRensLogsTotalPages(obj.total_pages || 1);
    } catch (error) {
      if (!silent) { setRensLogsData([]); setRensLogsTotal(0); }
    } finally { setLoadingRensLogs(false); }
  }, [rensLogFilterCuid, rensLogFilterMac, getAuthHeaders]);

  useEffect(() => {
    if (isLoggedIn && view === "logs_renseignements") {
      const timer = setTimeout(() => void loadRensLogs(1), 300);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, view, rensLogFilterCuid, rensLogFilterMac, loadRensLogs]);

  const exportRensLogsExcel = async () => {
    setIsExportingRensLogs(true);
    setRensLogsError("");
    const params = new URLSearchParams();
    if (rensLogFilterCuid) params.set("cuid", rensLogFilterCuid);
    if (rensLogFilterMac) params.set("adresse_mac", rensLogFilterMac);
    try {
      const response = await fetch(`${API_ROUTES.renseignementsLogsExport}?${params}`, { headers: getAuthHeaders() });
      if (response.status === 401) { sessionStorage.removeItem("admin_token"); window.location.href = "/admin"; return; }
      if (!response.ok) throw new Error("Export impossible.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `logs_renseignements_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setRensLogsError(error instanceof Error ? error.message : "Export impossible.");
    } finally { setIsExportingRensLogs(false); }
  };

  // Comptes bloqués
  const loadBlocData = useCallback(async (page = 1, silent = false) => {
    if (!silent) setLoadingBloc(true); // silent : rechargement temps réel, sans clignotement
    setBlocError("");
    const params = new URLSearchParams();
    if (blocFilterCuid) params.set("cuid", blocFilterCuid);
    params.set("page", String(page));
    try {
      const resp = await fetchJson(`${API_ROUTES.comptesBloques}?${params}`, { headers: getAuthHeaders() });
      const obj = resp as any;
      setBlocData((obj.data || []).map((r: any) => ({
        id: r.id, cuid: r.cuid || "", nom: r.nom || "", prenom: r.prenom || "",
        direction: r.direction || "", statut: r.statut || "", entreprise_partenaire: r.entreprise_partenaire || "",
        plateformes: Array.isArray(r.plateformes) ? r.plateformes : [], date_creation: r.date_creation || "",
      })));
      setBlocTotal(obj.total || 0);
      setBlocPage(obj.page || 1);
      setBlocTotalPages(obj.total_pages || 1);
    } catch (error) {
      if (!silent) { setBlocData([]); setBlocTotal(0); }
    } finally { setLoadingBloc(false); }
  }, [blocFilterCuid, getAuthHeaders]);

  /* ── Temps réel : rechargement silencieux de la vue affichée quand les données changent ── */
  const rtState = useRef({ view, rapportPage, logsPage, rensLogsPage, blocPage });
  rtState.current = { view, rapportPage, logsPage, rensLogsPage, blocPage };
  const rtPending = useRef<Set<string>>(new Set());
  const rtTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushRealtime = useCallback(() => {
    const changed = rtPending.current;
    rtPending.current = new Set();
    const { view: v, rapportPage: rp, logsPage: lp, rensLogsPage: rlp, blocPage: bp } = rtState.current;
    const has = (r: string) => changed.has("*") || changed.has(r);
    if (v === "rapport" && has("renseignements")) void loadRapport(rp, true);
    if (v === "logs" && has("login_logs")) void loadLogs(lp, true);
    if (v === "logs_renseignements" && has("renseignement_logs")) void loadRensLogs(rlp, true);
    if (v === "comptes_bloques" && has("blocked_accounts")) void loadBlocData(bp, true);
    if (v === "parametres" && has("services")) void loadAllData(true);
  }, [loadRapport, loadLogs, loadRensLogs, loadBlocData, loadAllData]);

  useRealtime("admin", (e) => {
    rtPending.current.add(e.type === "resync" ? "*" : e.resource);
    if (rtTimer.current) clearTimeout(rtTimer.current);
    rtTimer.current = setTimeout(flushRealtime, 400); // regroupe les rafales d'événements (ex. import Excel)
  }, isLoggedIn);
  useEffect(() => () => { if (rtTimer.current) clearTimeout(rtTimer.current); }, []);

  useEffect(() => {
    if (isLoggedIn && view === "comptes_bloques") {
      const timer = setTimeout(() => void loadBlocData(1), 300);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, view, blocFilterCuid, loadBlocData]);

  const exportBlocExcel = async () => {
    setIsExportingBloc(true);
    setBlocError("");
    const params = new URLSearchParams();
    if (blocFilterCuid) params.set("cuid", blocFilterCuid);
    try {
      const response = await fetch(`${API_ROUTES.comptesBloquesExport}?${params}`, { headers: getAuthHeaders() });
      if (response.status === 401) { sessionStorage.removeItem("admin_token"); window.location.href = "/admin"; return; }
      if (!response.ok) throw new Error("Export impossible.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `comptes_bloques_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setBlocError(error instanceof Error ? error.message : "Export impossible.");
    } finally { setIsExportingBloc(false); }
  };

  const handleDownloadExemple = async () => {
    try {
      const response = await fetch(API_ROUTES.exempleUtilisateurs, { headers: getAuthHeaders() });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "exemple_utilisateurs.xlsx";
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportFileError("");
    setImportErrors([]); setImportDoublons([]);
    setImportData([]);
    setImportStep("upload");
    const file = e.target.files?.[0];
    if (!file) { setImportFile(null); return; }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx")) {
      setImportFile(null);
      setImportFileKey((k) => k + 1);
      setImportFileError("Veuillez sélectionner un fichier Excel (.xlsx).");
      return;
    }
    setImportFile(file);
  };

  const handleAnalyserExcel = async () => {
    if (!importFile || importLoading) return;
    setImportLoading(true);
    setImportError("");
    setImportErrors([]); setImportDoublons([]);
    setImportData([]);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const resp = await fetchJson(API_ROUTES.analyserExcel, {
        method: "POST",
        headers: { ...getAuthHeaders() },
        body: formData,
      });
      // Le backend renvoie { lignes, total, nb_erreurs } : on sépare lignes en erreur / valides
      const lignes: ImportRow[] = (resp as any)?.lignes || [];
      const doublons = lignes.filter((l) => l.deja_inscrit);
      const enErreur = lignes.filter((l) => !l.deja_inscrit && (l.champs_manquants || []).length > 0);
      const valides = lignes.filter((l) => !l.deja_inscrit && (l.champs_manquants || []).length === 0);
      setImportDoublons(doublons);
      setImportErrors(enErreur);
      setImportData(valides);
      // "errors" = étape bloquante (champs vides) ou fichier ne contenant que des CUID déjà renseignés
      setImportStep(enErreur.length > 0 || valides.length === 0 ? "errors" : "preview");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Erreur lors de l'analyse du fichier.");
    } finally {
      setImportLoading(false);
    }
  };

  const handleImporterUtilisateurs = async () => {
    if (!importData.length || importConfirmLoading) return;
    setImportConfirmLoading(true);
    setImportError("");
    try {
      const res = await fetchJson(API_ROUTES.importerUtilisateurs, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ lignes: importData }),
      });
      setImportResultMsg((res as any)?.message || "");
      setImportStep("success");
      setImportFile(null);
      setImportFileKey((k) => k + 1);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Erreur lors de l'importation.");
    } finally {
      setImportConfirmLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(API_ROUTES.adminLogout, {
        method: "POST",
        headers: { ...getAuthHeaders() },
      });
    } catch {}
    sessionStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_cuid");
    setIsLoggedIn(false);
    setCuid("");
    setPassword("");
  };

  const currentItemsAll = allData[previewType] || [];
  const currentItems = previewSearch.trim()
    ? currentItemsAll.filter((item) => item.toLowerCase().includes(previewSearch.toLowerCase()))
    : currentItemsAll;

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  };

  // ── LOGIN ──
  if (!isLoggedIn) {
    return (
      <AuthShell
        title="Administration"
        subtitle="Connexion réservée aux administrateurs du portail."
        seed={404}
        links={<>
          <Link href="/admin/register" className="text-link">Créer un compte administrateur</Link>
          <Link href="/" className="text-link text-link--muted">Espace collaborateur</Link>
        </>}
      >
        <form onSubmit={handleLogin} className="auth-form">
          <div className="field">
            <label htmlFor="a-cuid" className="field-label">CUID</label>
            <input id="a-cuid" type="text" required autoComplete="username" autoFocus value={cuid}
              onChange={(e) => setCuid(e.target.value)} placeholder="Ex. ABCD1234" className="input" />
          </div>
          <div className="field">
            <label htmlFor="a-pwd" className="field-label">Mot de passe</label>
            <PasswordInput id="a-pwd" required autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Votre mot de passe" />
          </div>
          {loginError ? <ApiErrorDisplay error={loginError} /> : null}
          <button type="submit" disabled={loginLoading} className="btn btn-primary btn-block">
            {loginLoading ? <><Loader2 className="spin" aria-hidden="true" /> Connexion…</> : "Se connecter"}
          </button>
        </form>
      </AuthShell>
    );
  }

  // ── MAIN ──
  const NAV = [
    { key: "parametres" as const, icon: Settings, label: "Paramètres" },
    { key: "rapport" as const, icon: FileSpreadsheet, label: "Rapport des déclarations" },
    { key: "logs" as const, icon: ClipboardList, label: "Journal des connexions" },
    { key: "logs_renseignements" as const, icon: BookOpen, label: "Journal des déclarations" },
    { key: "comptes_bloques" as const, icon: ShieldAlert, label: "Comptes bloqués" },
    { key: "utilisateurs" as const, icon: Users, label: "Comptes Administrateurs" },
    { key: "ajouter_utilisateurs" as const, icon: UserPlus, label: "Import d'utilisateurs" },
  ];
  const navIndex = Math.max(0, NAV.findIndex((n) => n.key === view));

  return (
    <div className="admin-shell">
      <PortalHeader title="Administration du portail" user={cuid || undefined} onLogout={logout} />

      <div className="admin-body">
        <aside className="admin-side">
          <div className="admin-identity">
            <p className="admin-identity-role">Administrateur</p>
            <p className="admin-identity-cuid">{cuid || "—"}</p>
            <LiveIndicator kind="admin" enabled={isLoggedIn} />
          </div>

          <nav className="admin-nav" aria-label="Sections de l'administration">
            <span className="admin-nav-indicator" style={{ "--i": navIndex } as React.CSSProperties} aria-hidden="true" />
            {NAV.map(({ key, icon: Icon, label }) => (
              <button key={key} type="button" onClick={() => setView(key)} aria-current={view === key ? "page" : undefined}>
                <Icon aria-hidden="true" />{label}
              </button>
            ))}
          </nav>
        </aside>

      <main className="admin-main">
       <div key={view} className="admin-view">
        {/* ═══ PARAMETRES ═══ */}
        {view === "parametres" && (
          <div className="max-w-5xl">
            <h1 className="mb-6 text-2xl font-bold text-foreground">Listes de référence</h1>
            <p className="-mt-3 mb-6 text-sm text-muted-foreground">Directions, plateformes et entreprises partenaires proposées dans le formulaire des collaborateurs.</p>

            <form onSubmit={addEntry} className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-card-foreground">Ajouter un élément</h2>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label htmlFor="new-entry-name" className="mb-1.5 block text-sm font-medium">Nom</label>
                  <input id="new-entry-name" type="text" required value={newEntryName} onChange={(e) => setNewEntryName(e.target.value)} placeholder="Nom" className={inputCls} />
                </div>
                <div className="sm:w-44">
                  <label htmlFor="new-entry-type" className="mb-1.5 block text-sm font-medium">Type</label>
                  <select id="new-entry-type" value={newEntryType} onChange={(e) => setNewEntryType(e.target.value as EntryType)} className={`${selectCls} w-full`}>
                    <option value="direction">Direction</option>
                    <option value="plateforme">Plateforme</option>
                    <option value="partenaire">Partenaire</option>
                  </select>
                </div>
                <button type="submit" disabled={!newEntryName.trim() || savingEntry} className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
                  {savingEntry ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Ajouter
                </button>
              </div>
              <ApiErrorDisplay error={entryError} className="mt-4" onClose={() => setEntryError("")} />
            </form>

            <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-card-foreground">Importer depuis un fichier Word</h2>
              <p className="mb-3 text-xs text-muted-foreground">Le fichier doit contenir un tableau avec les colonnes : plateformes, services, partenaires</p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <input key={fileInputKey} type="file" accept=".docx" onChange={handleFileChange} className={`${inputCls} file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary`} />
                  {selectedFile && <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" />{selectedFile.name}</p>}
                </div>
                <button type="button" onClick={addFromFile} disabled={!selectedFile || savingFile} className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
                  {savingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Importer
                </button>
              </div>
              <ApiErrorDisplay error={fileError} className="mt-4" onClose={() => setFileError("")} />
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-base font-semibold text-card-foreground">Aperçu</h2>
                  <select value={previewType} onChange={(e) => setPreviewType(e.target.value as PreviewType)} className={selectCls}>
                    <option value="plateformes">Plateformes</option>
                    <option value="services">Directions</option>
                    <option value="partenaires">Partenaires</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{currentItems.length}</span>
                  <button onClick={loadAllData} disabled={loadingData} className="rounded-lg p-2 text-muted-foreground hover:bg-accent">
                    <RefreshCw className={`h-4 w-4 ${loadingData ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
              <div className="border-b border-border px-6 py-3">
                <input value={previewSearch} onChange={(e) => setPreviewSearch(e.target.value)} placeholder="Rechercher..." className={`${inputCls} max-w-xs`} />
              </div>
              {loadingData ? (
                <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>
              ) : currentItems.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">Aucun élément.</div>
              ) : (
                <div className="max-h-[280px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-muted/80">
                      <tr>
                        <th className="px-3 py-2 text-left text-lg font-bold uppercase tracking-wide text-muted-foreground">Nom</th>
                        <th className="w-14 px-3 py-2 text-right text-lg font-bold uppercase tracking-wide text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {currentItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-lg text-foreground">{item}</td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => deleteItem(item, previewType)} title="Supprimer" className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ RAPPORT ═══ */}
        {view === "rapport" && (
          <div className="max-w-6xl">
            <h1 className="mb-6 text-2xl font-bold text-foreground">Rapport des déclarations</h1>

            <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-card-foreground">Filtres</h2>
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1.5 block text-sm font-medium">CUID</label>
                  <input value={filterCuid} onChange={(e) => { setFilterCuid(e.target.value); setRapportPage(1); }} placeholder="Filtrer par CUID..." className={inputCls} />
                </div>
                <div className="min-w-[180px] flex-1">
                  <label className="mb-1.5 block text-sm font-medium">Direction</label>
                  <select value={filterDirection} onChange={(e) => { setFilterDirection(e.target.value); setRapportPage(1); }} className={`${selectCls} w-full`}>
                    <option value="">Toutes</option>
                    {(allData.services || []).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="min-w-[160px] flex-1">
                  <label className="mb-1.5 block text-sm font-medium">Statut</label>
                  <select value={filterStatut} onChange={(e) => { setFilterStatut(e.target.value); setRapportPage(1); }} className={`${selectCls} w-full`}>
                    <option value="">Tous</option>
                    {(allData.statuts || []).map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[180px] flex-1">
                  <label className="mb-1.5 block text-sm font-medium">Plateforme</label>
                  <select value={filterPlateforme} onChange={(e) => { setFilterPlateforme(e.target.value); setRapportPage(1); }} className={`${selectCls} w-full`}>
                    <option value="">Toutes</option>
                    {(allData.plateformes || []).map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <ApiErrorDisplay error={rapportError} className="mb-6" onClose={() => setRapportError("")} />

            <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-card-foreground">Résultats</h2>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{rapportTotal} résultat{rapportTotal > 1 ? "s" : ""}</span>
              </div>
              {loadingRapport ? (
                <div className="flex items-center justify-center gap-2 px-6 py-12 text-base text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full min-w-[700px] text-base">
                    <thead className="sticky top-0 z-10 bg-muted/60">
                      <tr>
                        {["CUID", "Nom", "Prénom", "Direction", "Statut", "Partenaire", "Plateforme", "Description"].map((h) => (
                          <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rapportData.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-10 text-center text-base text-muted-foreground">Aucun renseignement trouvé.</td></tr>
                      ) : rapportData.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-mono text-sm">{row.CUID}</td>
                          <td className="px-4 py-3 font-medium">{row.Nom}</td>
                          <td className="px-4 py-3">{row.prenom}</td>
                          <td className="px-4 py-3"><span className="inline-block whitespace-nowrap rounded-full bg-accent px-2.5 py-0.5 text-sm font-medium">{row.direction}</span></td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                              row.statut === "employé" ? "bg-green-100 text-green-700" :
                              row.statut === "prestataire" ? "bg-blue-100 text-blue-700" :
                              row.statut === "stagiaire" ? "bg-yellow-100 text-yellow-700" :
                              row.statut === "contractuel" ? "bg-purple-100 text-purple-700" :
                              "bg-gray-100 text-gray-700"
                            }`}>{row.statut}</span>
                          </td>
                          <td className="px-4 py-3">{row.entreprise_partenaire || "—"}</td>
                          <td className="px-4 py-3 font-medium">{row.plateforme || "—"}</td>
                          <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">{row.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {rapportTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-6 py-3">
                  <span className="text-sm text-muted-foreground">Page {rapportPage} / {rapportTotalPages}</span>
                  <div className="flex gap-2">
                    <button disabled={rapportPage <= 1} onClick={() => loadRapport(rapportPage - 1)} className="rounded-lg border border-border p-2 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                    <button disabled={rapportPage >= rapportTotalPages} onClick={() => loadRapport(rapportPage + 1)} className="rounded-lg border border-border p-2 text-sm disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={exportExcel} disabled={isExporting || rapportTotal === 0} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-60">
                {isExporting ? <><Loader2 className="h-4 w-4 animate-spin" /> Export en cours...</> : <><Download className="h-4 w-4" /> Exporter en Excel</>}
              </button>
            </div>
          </div>
        )}

        {/* ═══ LOGS CONNEXIONS ═══ */}
        {view === "logs" && (
          <div className="max-w-6xl">
            <h1 className="mb-6 text-2xl font-bold text-foreground">Journal des connexions</h1>

            <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-card-foreground">Filtres</h2>
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1.5 block text-sm font-medium">CUID</label>
                  <input value={logFilterCuid} onChange={(e) => { setLogFilterCuid(e.target.value); setLogsPage(1); }} placeholder="Filtrer par CUID..." className={inputCls} />
                </div>
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1.5 block text-sm font-medium">Adresse MAC</label>
                  <input value={logFilterMac} onChange={(e) => { setLogFilterMac(e.target.value); setLogsPage(1); }} placeholder="Filtrer par adresse MAC..." className={inputCls} />
                </div>
              </div>
            </div>

            <ApiErrorDisplay error={logsError} className="mb-6" onClose={() => setLogsError("")} />

            <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-card-foreground">Connexions</h2>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{logsTotal} résultat{logsTotal > 1 ? "s" : ""}</span>
              </div>
              {loadingLogs ? (
                <div className="flex items-center justify-center gap-2 px-6 py-12 text-base text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full min-w-[700px] text-base">
                    <thead className="sticky top-0 z-10 bg-muted/60">
                      <tr>
                        {["CUID", "Action", "Adresse IP", "Adresse MAC", "Date"].map((h) => (
                          <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {logsData.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-10 text-center text-base text-muted-foreground">Aucun log trouvé.</td></tr>
                      ) : logsData.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-mono text-sm">{row.cuid}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${
                              row.action.includes("logout") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                            }`}>{row.action}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm">{row.adresse_ip || "—"}</td>
                          <td className="px-4 py-3 font-mono text-sm">{row.adresse_mac || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(row.date_creation)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {logsTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-6 py-3">
                  <span className="text-sm text-muted-foreground">Page {logsPage} / {logsTotalPages}</span>
                  <div className="flex gap-2">
                    <button disabled={logsPage <= 1} onClick={() => loadLogs(logsPage - 1)} className="rounded-lg border border-border p-2 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                    <button disabled={logsPage >= logsTotalPages} onClick={() => loadLogs(logsPage + 1)} className="rounded-lg border border-border p-2 text-sm disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={exportLogsExcel} disabled={isExportingLogs || logsTotal === 0} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-60">
                {isExportingLogs ? <><Loader2 className="h-4 w-4 animate-spin" /> Export en cours...</> : <><Download className="h-4 w-4" /> Exporter en Excel</>}
              </button>
            </div>
          </div>
        )}

        {/* ═══ LOGS RENSEIGNEMENTS ═══ */}
        {view === "logs_renseignements" && (
          <div className="max-w-6xl">
            <h1 className="mb-6 text-2xl font-bold text-foreground">Journal des envois</h1>

            <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-card-foreground">Filtres</h2>
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1.5 block text-sm font-medium">CUID</label>
                  <input value={rensLogFilterCuid} onChange={(e) => { setRensLogFilterCuid(e.target.value); setRensLogsPage(1); }} placeholder="Filtrer par CUID..." className={inputCls} />
                </div>
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1.5 block text-sm font-medium">Adresse MAC</label>
                  <input value={rensLogFilterMac} onChange={(e) => { setRensLogFilterMac(e.target.value); setRensLogsPage(1); }} placeholder="Filtrer par adresse MAC..." className={inputCls} />
                </div>
              </div>
            </div>

            <ApiErrorDisplay error={rensLogsError} className="mb-6" onClose={() => setRensLogsError("")} />

            <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-card-foreground">Soumissions</h2>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{rensLogsTotal} résultat{rensLogsTotal > 1 ? "s" : ""}</span>
              </div>
              {loadingRensLogs ? (
                <div className="flex items-center justify-center gap-2 px-6 py-12 text-base text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full min-w-[700px] text-base">
                    <thead className="sticky top-0 z-10 bg-muted/60">
                      <tr>
                        {["CUID", "Adresse IP", "Adresse MAC", "Date de soumission"].map((h) => (
                          <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rensLogsData.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-10 text-center text-base text-muted-foreground">Aucun log trouvé.</td></tr>
                      ) : rensLogsData.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-mono text-sm">{row.cuid}</td>
                          <td className="px-4 py-3 font-mono text-sm">{row.adresse_ip || "—"}</td>
                          <td className="px-4 py-3 font-mono text-sm">{row.adresse_mac || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(row.date_creation)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {rensLogsTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-6 py-3">
                  <span className="text-sm text-muted-foreground">Page {rensLogsPage} / {rensLogsTotalPages}</span>
                  <div className="flex gap-2">
                    <button disabled={rensLogsPage <= 1} onClick={() => loadRensLogs(rensLogsPage - 1)} className="rounded-lg border border-border p-2 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                    <button disabled={rensLogsPage >= rensLogsTotalPages} onClick={() => loadRensLogs(rensLogsPage + 1)} className="rounded-lg border border-border p-2 text-sm disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={exportRensLogsExcel} disabled={isExportingRensLogs || rensLogsTotal === 0} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-60">
                {isExportingRensLogs ? <><Loader2 className="h-4 w-4 animate-spin" /> Export en cours...</> : <><Download className="h-4 w-4" /> Exporter en Excel</>}
              </button>
            </div>
          </div>
        )}

        {/* ═══ COMPTES BLOQUÉS ═══ */}
        {view === "comptes_bloques" && (
          <div className="max-w-6xl">
            <h1 className="mb-6 text-2xl font-bold text-foreground">Comptes bloqués</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Comptes bloqués automatiquement après 3 tentatives sans description de plateforme renseignée.
            </p>

            <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-card-foreground">Filtres</h2>
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1.5 block text-sm font-medium">CUID</label>
                  <input value={blocFilterCuid} onChange={(e) => { setBlocFilterCuid(e.target.value); setBlocPage(1); }} placeholder="Filtrer par CUID..." className={inputCls} />
                </div>
              </div>
            </div>

            <ApiErrorDisplay error={blocError} className="mb-6" onClose={() => setBlocError("")} />

            <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-card-foreground">Comptes bloqués</h2>
                <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">{blocTotal} résultat{blocTotal > 1 ? "s" : ""}</span>
              </div>
              {loadingBloc ? (
                <div className="flex items-center justify-center gap-2 px-6 py-12 text-base text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full min-w-[900px] text-base">
                    <thead className="sticky top-0 z-10 bg-muted/60">
                      <tr>
                        {["CUID", "Nom", "Prénom", "Direction", "Statut", "Entreprise partenaire", "Plateformes sélectionnées", "Date de blocage"].map((h) => (
                          <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {blocData.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-10 text-center text-base text-muted-foreground">Aucun compte bloqué.</td></tr>
                      ) : blocData.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-mono text-sm">{row.cuid}</td>
                          <td className="px-4 py-3">{row.nom}</td>
                          <td className="px-4 py-3">{row.prenom}</td>
                          <td className="px-4 py-3">{row.direction}</td>
                          <td className="px-4 py-3">{row.statut}</td>
                          <td className="px-4 py-3">{row.entreprise_partenaire || "—"}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {row.plateformes.length === 0 ? "—" : row.plateformes.map((p, i) => (
                              <div key={i}>{p.text}{p.description ? ` — ${p.description}` : " (description non renseignée)"}</div>
                            ))}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(row.date_creation)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {blocTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-6 py-3">
                  <span className="text-sm text-muted-foreground">Page {blocPage} / {blocTotalPages}</span>
                  <div className="flex gap-2">
                    <button disabled={blocPage <= 1} onClick={() => loadBlocData(blocPage - 1)} className="rounded-lg border border-border p-2 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                    <button disabled={blocPage >= blocTotalPages} onClick={() => loadBlocData(blocPage + 1)} className="rounded-lg border border-border p-2 text-sm disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={exportBlocExcel} disabled={isExportingBloc || blocTotal === 0} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-60">
                {isExportingBloc ? <><Loader2 className="h-4 w-4 animate-spin" /> Export en cours...</> : <><Download className="h-4 w-4" /> Exporter en Excel</>}
              </button>
            </div>
          </div>
        )}

        {/* ═══ AJOUTER UTILISATEURS ═══ */}
        {view === "ajouter_utilisateurs" && (
          <div className="max-w-5xl">
            <h1 className="mb-2 text-2xl font-bold text-foreground">Ajouter des utilisateurs</h1>
            <p className="mb-6 text-sm text-muted-foreground">Importez des utilisateurs en masse via un fichier Excel.</p>

            {/* Étape 1 : Télécharger exemple + uploader */}
            {(importStep === "upload" || importStep === "errors") && (
              <>
                {/* Bloc exemple */}
                <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="mb-1 text-base font-semibold text-card-foreground">1. Télécharger le modèle Excel</h2>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Colonnes attendues : CUID, Nom, Prenom, Statut, Direction, Entreprise Partenaire, Plateforme Utilisée, Description de la Plateforme
                  </p>
                  <button
                    type="button"
                    onClick={handleDownloadExemple}
                    className="flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Download className="h-4 w-4" /> Télécharger le fichier exemple
                  </button>
                </div>

                {/* Bloc upload */}
                <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="mb-1 text-base font-semibold text-card-foreground">2. Importer votre fichier rempli</h2>
                  <p className="mb-4 text-xs text-muted-foreground">Le fichier sera analysé avant l'envoi en base. Les erreurs seront signalées.</p>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <input
                        key={importFileKey}
                        type="file"
                        accept=".xlsx"
                        onChange={handleImportFileChange}
                        className={`${inputCls} file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary`}
                      />
                      {importFile && (
                        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" /> {importFile.name}
                        </p>
                      )}
                      {importFileError && (
                        <p className="mt-2 text-sm text-destructive">{importFileError}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleAnalyserExcel}
                      disabled={!importFile || importLoading}
                      className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                    >
                      {importLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyse...</> : <><Plus className="h-4 w-4" /> Analyser</>}
                    </button>
                  </div>
                  <ApiErrorDisplay error={importError} className="mt-4" onClose={() => setImportError("")} />
                </div>

                {/* CUID déjà renseignés : signalés, non ré-inscrits */}
                {importStep === "errors" && importDoublons.length > 0 && (
                  <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 border-b border-amber-300 bg-amber-100 px-6 py-4">
                      <span className="flex items-center gap-2 text-base font-semibold text-amber-800"><AlertTriangle className="h-5 w-5" aria-hidden="true" />CUID déjà déclarés : ces lignes seront ignorées</span>
                      <span className="ml-auto rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{importDoublons.length} ligne{importDoublons.length > 1 ? "s" : ""}</span>
                    </div>
                    <div className="max-h-56 overflow-auto px-6 py-3 text-sm text-amber-900">
                      {importDoublons.map((d) => (
                        <div key={d.ligne} className="flex gap-3 py-1">
                          <span className="font-mono font-bold">Ligne {d.ligne}</span>
                          <span className="font-mono">{d.cuid}</span>
                          <span className="text-amber-700">{d.nom} {d.prenom}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tableau des erreurs */}
                {importStep === "errors" && importErrors.length > 0 && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/5 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 border-b border-destructive/30 bg-destructive/10 px-6 py-4">
                      <span className="flex items-center gap-2 text-base font-semibold text-destructive"><AlertTriangle className="h-5 w-5" aria-hidden="true" />Colonnes vides : corrigez le fichier puis importez-le à nouveau</span>
                      <span className="ml-auto rounded-full bg-destructive/20 px-2.5 py-0.5 text-xs font-semibold text-destructive">{importErrors.length} ligne{importErrors.length > 1 ? "s" : ""} concernée{importErrors.length > 1 ? "s" : ""}</span>
                    </div>
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wide">Ligne</th>
                            <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wide">Colonnes vides / manquantes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {importErrors.map((err) => (
                            <tr key={err.ligne} className="hover:bg-muted/20">
                              <td className="px-4 py-3 font-mono font-bold text-destructive">Ligne {err.ligne}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  {err.champs_manquants.map((col) => (
                                    <span key={col} className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive">{col}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {importData.length > 0 && (
                      <div className="border-t border-destructive/30 px-6 py-3 text-xs text-muted-foreground">
                        {importData.length} ligne{importData.length > 1 ? "s" : ""} valide{importData.length > 1 ? "s" : ""} — corrigez les erreurs ci-dessus puis ré-importez le fichier complet.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Étape 2 : Prévisualisation avant confirmation */}
            {importStep === "preview" && (
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                  <div>
                    <h2 className="text-base font-semibold text-card-foreground">Prévisualisation — {importData.length} utilisateur{importData.length > 1 ? "s" : ""} à importer</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Vérifiez les données avant l'envoi en base de données.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setImportStep("upload"); setImportData([]); setImportErrors([]); setImportDoublons([]); setImportFile(null); setImportFileKey((k) => k + 1); }}
                    className="text-sm text-muted-foreground hover:text-foreground underline"
                  >
                    Recommencer
                  </button>
                </div>
                {importDoublons.length > 0 && (
                  <div className="border-b border-amber-300 bg-amber-50 px-6 py-3 text-sm text-amber-800">
                    <AlertTriangle className="mr-2 inline h-4 w-4 align-[-3px]" aria-hidden="true" />{importDoublons.length} ligne{importDoublons.length > 1 ? "s" : ""} ignorée{importDoublons.length > 1 ? "s" : ""} (CUID déjà renseigné) : {Array.from(new Set(importDoublons.map((d) => d.cuid))).join(", ")}
                  </div>
                )}
                <div className="overflow-auto max-h-[400px]">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="sticky top-0 z-10 bg-muted/60">
                      <tr>
                        {["CUID", "Nom", "Prénom", "Statut", "Direction", "Partenaire", "Plateforme", "Description"].map((h) => (
                          <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {importData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-mono text-xs">{row.cuid}</td>
                          <td className="px-4 py-2.5 font-medium">{row.nom}</td>
                          <td className="px-4 py-2.5">{row.prenom}</td>
                          <td className="px-4 py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              row.statut.toLowerCase() === "employé" ? "bg-green-100 text-green-700" :
                              row.statut.toLowerCase() === "prestataire" ? "bg-blue-100 text-blue-700" :
                              row.statut.toLowerCase() === "stagiaire" ? "bg-yellow-100 text-yellow-700" :
                              "bg-purple-100 text-purple-700"
                            }`}>{row.statut}</span>
                          </td>
                          <td className="px-4 py-2.5">{row.direction}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{row.entreprise_partenaire || "—"}</td>
                          <td className="px-4 py-2.5 font-medium">{row.plateforme || "—"}</td>
                          <td className="max-w-[180px] truncate px-4 py-2.5 text-muted-foreground">{row.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ApiErrorDisplay error={importError} className="border-t border-border" onClose={() => setImportError("")} />
                <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
                  <button
                    type="button"
                    onClick={() => { setImportStep("upload"); setImportData([]); setImportFile(null); setImportFileKey((k) => k + 1); }}
                    className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleImporterUtilisateurs}
                    disabled={importConfirmLoading}
                    className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {importConfirmLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Importation...</> : <><Download className="h-4 w-4" /> Confirmer l'importation</>}
                  </button>
                </div>
              </div>
            )}

            {/* Étape 3 : Succès */}
            {importStep === "success" && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center shadow-sm">
                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-700 animate-in zoom-in-50 duration-500" aria-hidden="true" />
                <h2 className="text-lg font-bold text-green-800 mb-2">Importation réussie !</h2>
                <p className="text-sm text-green-700 mb-6">{importResultMsg || "Les utilisateurs ont été ajoutés à la base de données."}</p>
                <button
                  type="button"
                  onClick={() => { setImportStep("upload"); setImportData([]); setImportErrors([]); setImportDoublons([]); setImportFile(null); setImportFileKey((k) => k + 1); setImportError(""); }}
                  className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Nouvelle importation
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ UTILISATEURS ═══ */}
        {view === "utilisateurs" && <AdminUsers />}
       </div>
      </main>
      </div>
    </div>
  );
}
