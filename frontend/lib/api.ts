export const API_BASE_URL =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : "http://localhost:8000";

export const API_ROUTES = {
  login: `${API_BASE_URL}/user/login`,
  adminLogin: `${API_BASE_URL}/admin/login`,
  adminRegister: `${API_BASE_URL}/admin/register`,

  plateformes: `${API_BASE_URL}/services/plateformes`,
  partenaires: `${API_BASE_URL}/services/partenaires`,
  importerWord: `${API_BASE_URL}/services/importer-word`,
  admins: `${API_BASE_URL}/admin/comptes`,
  adminActivation: (id: number | string, actif: boolean) =>
    `${API_BASE_URL}/admin/comptes/${id}/activation?actif=${actif}`,

  ajout: `${API_BASE_URL}/services/ajout`,
  services: `${API_BASE_URL}/services`,
  delete_service: `${API_BASE_URL}/services/delete`,
  update_service: `${API_BASE_URL}/services/update`,
  serviceByName: (name: string) =>
    `${API_BASE_URL}/services/${encodeURIComponent(name)}`,

  renseignementsSubmit: `${API_BASE_URL}/renseignements/enregistrer`,
  list: `${API_BASE_URL}/renseignements/list`,
  wordFile: `${API_BASE_URL}/services/importer-word`,
  rapportExport: `${API_BASE_URL}/renseignements/exporter`,

  logsList: `${API_BASE_URL}/admin/logs`,
  logsExport: `${API_BASE_URL}/admin/logs/exporter`,
  adminLogout: `${API_BASE_URL}/admin/logout`,

  checkSoumission: (cuid: string) => `${API_BASE_URL}/user/check-soumission/${encodeURIComponent(cuid)}`,
  renseignementsLogs: `${API_BASE_URL}/renseignements/logs`,
  renseignementsLogsExport: `${API_BASE_URL}/renseignements/logs/exporter`,

  blockedIps: `${API_BASE_URL}/admin/blocked-ips`,
  unblockIp: (id: number | string) => `${API_BASE_URL}/admin/blocked-ips/${id}`,

  bloquerCompte: `${API_BASE_URL}/renseignements/bloquer-compte`,
  comptesBloques: `${API_BASE_URL}/renseignements/comptes-bloques`,
  comptesBloquesExport: `${API_BASE_URL}/renseignements/comptes-bloques/exporter`,

  // Import utilisateurs via Excel
  exempleUtilisateurs: `${API_BASE_URL}/admin/utilisateurs/modele-excel`,
  analyserExcel: `${API_BASE_URL}/admin/utilisateurs/verifier-import`,
  importerUtilisateurs: `${API_BASE_URL}/admin/utilisateurs/importer`,
} as const;
