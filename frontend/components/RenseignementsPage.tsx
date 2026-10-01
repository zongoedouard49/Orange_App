
"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  SearchX,
  // Search,
  Send,
} from "lucide-react";
import PortalHeader from "@/components/brand/PortalHeader";
import { API_ROUTES } from "@/lib/api";
import { parseApiError, formatApiError, parseError } from "@/lib/errors";

const STATUTS = ["Employé", "Prestataire", "Stagiaire", "Contractuel"];

/* ── Composant Select avec recherche ── */
type SearchableSelectProps = {
  id: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
  "aria-invalid"?: boolean;
};

function SearchableSelect({
  id,
  value,
  options,
  placeholder,
  onChange,
  "aria-invalid": ariaInvalid,
}: SearchableSelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter((o) =>
    normalizeText(o).includes(normalizeText(search))
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const toggle = () => {
    setOpen((o) => !o);
    setSearch("");
  };

  return (
    <div
      ref={containerRef}
      className="searchable-select-wrap"
      style={{ position: "relative" }}
    >
      {/* Trigger */}
      <div
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-invalid={ariaInvalid}
        tabIndex={0}
        className={`select searchable-trigger${ariaInvalid ? " is-invalid" : ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        {value ? (
          value
        ) : (
          <span
            style={{
              color: "var(--c-text-3, #9ca3af)",
              fontWeight: 400,
            }}
          >
            {placeholder}
          </span>
        )}
      </div>

      <ChevronDown
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: open ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
          pointerEvents: "none",
          transition: "transform .2s",
          width: 16,
          height: 16,
          color: "var(--c-text-2, #6b7280)",
        }}
      />

      {/* Dropdown */}
      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          aria-label={placeholder}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--c-surface, #fff)",
            border: "1px solid var(--c-border, #e5e7eb)",
            borderRadius: "var(--r-md, 8px)",
            boxShadow: "0 8px 24px rgba(0,0,0,.12)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {/* Champ de recherche */}
          <div
            style={{ padding: "8px 8px 4px", borderBottom: "1px solid var(--c-border, #e5e7eb)" }}
          >
            <div className="input-icon" style={{ gap: 6 }}>
              {/*<Search*/}
              {/*  aria-hidden="true"*/}
              {/*  style={{ width: 14, height: 14, flexShrink: 0 }}*/}
              {/*/>*/}
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="input"
                style={{ padding: "6px 8px", fontSize: 13 }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                  } else if (e.key === "Enter" && filtered.length === 1) {
                    onChange(filtered[0]);
                    setOpen(false);
                    setSearch("");
                  }
                }}
              />
            </div>
          </div>

          {/* Liste */}
          <ul
            style={{
              maxHeight: 220,
              overflowY: "auto",
              listStyle: "none",
              margin: 0,
              padding: "4px 0",
            }}
          >
            {filtered.length === 0 ? (
              <li
                style={{
                  padding: "10px 14px",
                  color: "var(--c-text-3, #9ca3af)",
                  fontSize: 13,
                  fontStyle: "italic",
                }}
              >
                Aucun résultat
              </li>
            ) : (
              filtered.map((o) => {
                const isSelected = o === value;
                return (
                  <li
                    key={o}
                    role="option"
                    aria-selected={isSelected}
                    style={{
                      padding: "9px 14px",
                      cursor: "pointer",
                      background: isSelected
                        ? "rgba(255,121,0,.08)"
                        : "transparent",
                      color: isSelected ? "#ff7900" : "inherit",
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: 14,
                      transition: "background .12s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLElement).style.background =
                          "var(--c-hover, rgba(0,0,0,.04))";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLElement).style.background =
                          "transparent";
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(o);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    {o}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type Ligne = { id: number | string; text: string };
type Etape = "form" | "resume" | "succes";

export default function RenseignementsPage() {
  const router = useRouter();
  const [cuid, setCuid] = useState("");
  const [userToken, setUserToken] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [poste, setPoste] = useState("");
  const [referent, setReferent] = useState("");
  const [direction, setDirection] = useState("");
  const [directions, setDirections] = useState<string[]>([]);
  const [plateformes, setPlateformes] = useState<string[]>([]);
  const [statut, setStatut] = useState("");
  const [entreprisePartenaire, setEntreprisePartenaire] = useState("");
  const [partenairesListe, setPartenairesListe] = useState<string[]>([]);
  const [etape, setEtape] = useState<Etape>("form");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState("");
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [descs, setDescs] = useState<Record<string, string>>({});
  const [descTouched, setDescTouched] = useState<Record<string, boolean>>({});
  const [recherchePlateforme, setRecherchePlateforme] = useState("");
  const [toggleSansDesc, setToggleSansDesc] = useState(0);
  const [selectErrors, setSelectErrors] = useState<Record<string, boolean>>({});
  const [textErrors, setTextErrors] = useState<Record<string, string>>({});
  const [textTouched, setTextTouched] = useState<Record<string, boolean>>({});
  const [compteBloque, setCompteBloque] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const token = sessionStorage.getItem("user_token");

    if (!token) {
      router.push("/");
      return;
    }

    const storedCuid = sessionStorage.getItem("cuid") ?? "";

    setCuid(storedCuid);
    setUserToken(token);

    // Vérifier si ce CUID a déjà soumis
    if (storedCuid) {
      fetch(API_ROUTES.checkSoumission(storedCuid), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((data) => {
          if (data.deja_soumis) {
            alert(
              "Vous avez déjà soumis vos renseignements. Redirection..."
            );
            router.push("/");
          }
        })
        .catch(() => {});
    }
  }, [router]);

  // Temps réel : listes mises à jour par l'admin,
  // et blocage du compte en direct
  useRealtime(
    "user",
    (e) => {
      if (e.type === "resync" || e.resource === "services") {
        setRefreshKey((k) => k + 1);
      } else if (
        e.resource === "blocked_accounts" &&
        e.action === "insert"
      ) {
        setCompteBloque(true);
      }
    },
    !!userToken
  );

  // Load directions from backend
  useEffect(() => {
    if (!userToken) return;

    fetch(API_ROUTES.services, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: any) => {
        const values: any[] = Array.isArray(data)
          ? data
          : data &&
              typeof data === "object" &&
              Array.isArray(data.services)
            ? data.services
            : [];

        setDirections(
          values
            .map((v) =>
              typeof v === "string"
                ? v
                : v.name ?? v.nom ?? ""
            )
            .filter(Boolean)
        );
      })
      .catch(() => {});
  }, [refreshKey, userToken]);

  // Load plateformes from backend
  useEffect(() => {
    if (!userToken) return;

    fetch(API_ROUTES.plateformes, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: unknown) => {
        const values: any[] = Array.isArray(data)
          ? data
          : data &&
              typeof data === "object" &&
              Array.isArray((data as any).plateformes)
            ? (data as any).plateformes
            : [];

        const next = values
          .map((v, i) =>
            typeof v === "string"
              ? { id: i + 1, text: v }
              : {
                  id: v.id ?? i + 1,
                  text:
                    v.name ??
                    v.nom ??
                    v.plateforme ??
                    "",
                }
          )
          .filter((v) => v.text);

        // Fusion : les plateformes déjà affichées gardent leur id
        // (cases cochées et descriptions conservées),
        // les nouvelles sont ajoutées,
        // celles supprimées par l'admin disparaissent.
        setLignes((prev) => {
          if (prev.length === 0) return next;

          let maxId = Math.max(
            ...prev.map((l) => Number(l.id) || 0),
            ...next.map((l) => Number(l.id) || 0)
          );

          return next.map((n) => {
            const existant = prev.find(
              (p) => p.text === n.text
            );

            return existant ?? {
              ...n,
              id: ++maxId,
            };
          });
        });
      })
      .catch(() => {
        if (refreshKey === 0) {
          setError(
            "Impossible de charger les données. Vérifiez votre connexion."
          );
        }
      })
      .finally(() => setLoading(false));
  }, [refreshKey, userToken]);

  // Load partenaires
  useEffect(() => {
    if (!userToken) return;

    fetch(API_ROUTES.partenaires, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: unknown) => {
        const values: any[] = Array.isArray(data)
          ? data
          : data &&
              typeof data === "object" &&
              Array.isArray((data as any).partenaires)
            ? (data as any).partenaires
            : [];

        setPartenairesListe(
          values
            .map((v) =>
              typeof v === "string"
                ? v
                : v.name ?? v.nom ?? ""
            )
            .filter(Boolean)
        );
      })
      .catch(() => {});
  }, [refreshKey, userToken]);

  // Auto-blocage si l'utilisateur clique 3+ fois
  // sur "Voir le résumé" avec une plateforme cochée
  // mais sans description
  useEffect(() => {
    if (
      toggleSansDesc >= 3 &&
      etape === "form" &&
      userToken &&
      cuid
    ) {
      const platsCochees = lignes.filter(
        (l) => checks[l.id]
      );

      if (nom && prenom && direction && statut) {
        const blocageData = {
          cuid,
          nom,
          prenom,
          direction,
          statut: statut.toLowerCase(),
          entreprise_partenaire:
            statut && statut !== "Employé"
              ? entreprisePartenaire
              : null,
          plateformes: platsCochees.map((l) => ({
            id: l.id,
            text: l.text,
            description: (descs[l.id] ?? "").trim(),
          })),
        };

        fetch(API_ROUTES.bloquerCompte, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify(blocageData),
        })
          .catch(() => {})
          .finally(() => {
            setCompteBloque(true);
          });
      }
    }
  }, [toggleSansDesc]);

  const checkedCount = Object.values(checks).filter(
    Boolean
  ).length;

  const tachesSelectionnees = lignes.filter(
    (l) => checks[l.id]
  );

  const lignesFiltrees = lignes.filter((l) =>
    normalizeText(l.text).includes(
      normalizeText(recherchePlateforme)
    )
  );

  const descManquante = (
    id: number | string
  ) =>
    !!checks[id] &&
    !(descs[id] ?? "").trim();

  const auMoinsUneDescManquante =
    tachesSelectionnees.some((l) =>
      descManquante(l.id)
    );

  // Fin de session automatique après l'envoi (5 s)
  // ou un blocage (6 s).
  const delaiFin = compteBloque
    ? 6000
    : etape === "succes"
      ? 5000
      : 0;

  useEffect(() => {
    if (!delaiFin) return;

    const t = setTimeout(() => {
      sessionStorage.removeItem("cuid");
      sessionStorage.removeItem("user_token");
      router.push("/");
    }, delaiFin);

    return () => clearTimeout(t);
  }, [delaiFin, router]);

  // Remonter en haut de page à chaque changement d'étape
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [etape]);

  // Fermer la boîte de confirmation avec Échap
  useEffect(() => {
    if (!showConfirmPopup) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowConfirmPopup(false);
      }
    };

    window.addEventListener("keydown", onKey);

    return () =>
      window.removeEventListener("keydown", onKey);
  }, [showConfirmPopup]);

  const identiteComplete =
    !!nom.trim() &&
    !!prenom.trim() &&
    !!poste.trim() &&
    !!direction &&
    !!statut &&
    (statut === "Employé" ||
      !!entreprisePartenaire);

  const plateformesCompletes =
    checkedCount > 0 &&
    !auMoinsUneDescManquante;

  const progression =
    etape === "succes"
      ? 1
      : etape === "resume"
        ? 0.85
        : (identiteComplete ? 0.35 : 0) +
          (plateformesCompletes
            ? 0.35
            : checkedCount > 0
              ? 0.15
              : 0);

  const handleLogout = () => {
    sessionStorage.removeItem("cuid");
    sessionStorage.removeItem("user_token");
    router.push("/");
  };

  const handleValiderFormulaire = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    // Valider les champs texte
    const newTextErrors: Record<
      string,
      string
    > = {};

    if (!nom.trim()) {
      newTextErrors.nom =
        "Veuillez remplir ce champ";
    }

    if (!prenom.trim()) {
      newTextErrors.prenom =
        "Veuillez remplir ce champ";
    }

    if (!poste.trim()) {
      newTextErrors.poste =
        "Veuillez remplir ce champ";
    }

    setTextErrors(newTextErrors);

    setTextTouched({
      nom: true,
      prenom: true,
      poste: true,
    });

    // Valider les selects
    const errors: Record<
      string,
      boolean
    > = {};

    if (!direction) {
      errors.direction = true;
    }

    if (!statut) {
      errors.statut = true;
    }

    if (
      statut &&
      statut !== "Employé" &&
      !entreprisePartenaire
    ) {
      errors.partenaire = true;
    }

    setSelectErrors(errors);

    if (
      Object.keys(newTextErrors).length > 0 ||
      Object.keys(errors).length > 0
    ) {
      return;
    }

    if (checkedCount === 0) {
      return;
    }

    if (auMoinsUneDescManquante) {
      setDescTouched((prev) => {
        const next = { ...prev };

        tachesSelectionnees.forEach((l) => {
          next[l.id] = true;
        });

        return next;
      });

      // Tentative de validation avec une description manquante
      setToggleSansDesc(
        (prev) => prev + 1
      );

      return;
    }

    setEtape("resume");
  };

  const handleConfirmerEnvoi =
    async () => {
      setEnvoiEnCours(true);
      setErreurEnvoi("");

      try {
        const res = await fetch(
          API_ROUTES.renseignementsSubmit,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${userToken}`,
            },
            body: JSON.stringify({
              cuid,
              nom,
              prenom,
              direction,
              poste: poste.trim(),
              referent: referent.trim() || null,
              statut: statut.toLowerCase(),
              entreprise_partenaire:
                statut &&
                statut !== "Employé"
                  ? entreprisePartenaire
                  : null,
              plateformes:
                tachesSelectionnees.map(
                  (l) => ({
                    id: l.id,
                    text: l.text,
                    description:
                      (
                        descs[l.id] ??
                        ""
                      ).trim(),
                  })
                ),
            }),
          }
        );

        if (!res.ok) {
          const raw = await res
            .text()
            .catch(() => "");

          const apiErr =
            await parseApiError(
              res,
              raw
            );

          throw new Error(
            formatApiError(apiErr)
          );
        }

        setEtape("succes");
      } catch (e: any) {
        setErreurEnvoi(
          parseError(e) ||
            "L'envoi a échoué. Veuillez réessayer."
        );
      } finally {
        setEnvoiEnCours(false);
      }
    };

  const header = (
    <PortalHeader
      title="Déclaration d'utilisation"
      user={cuid || undefined}
      onLogout={handleLogout}
    />
  );

  /* ── Compte bloqué ── */
  if (compteBloque) {
    return (
      <>
        {header}

        <main className="outcome outcome--blocked">
          <div
            className="outcome-card"
            role="alert"
          >
            <div
              className="outcome-mark"
              aria-hidden="true"
            >
              <svg viewBox="0 0 88 88">
                <rect
                  className="sq"
                  x="4"
                  y="4"
                  width="80"
                  height="80"
                />
                <path
                  className="tick"
                  d="M30 30 L58 58 M58 30 L30 58"
                />
              </svg>
            </div>

            <h1>Compte bloqué</h1>

            <p>
              La description d&apos;une plateforme
              cochée est restée vide après
              plusieurs tentatives. Votre compte
              est bloqué et vos informations ont
              été transmises à l&apos;administrateur.
            </p>

            <div className="outcome-timer">
              <p>
                Fin de session automatique dans
                quelques secondes.
              </p>

              <div className="bar">
                <span
                  style={
                    {
                      "--t": "6s",
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  /* ── Succès ── */
  if (etape === "succes") {
    return (
      <>
        {header}

        <div
          className="portal-progress"
          aria-hidden="true"
        >
          <span
            style={
              {
                "--p": 1,
              } as CSSProperties
            }
          />
        </div>

        <main className="outcome">
          <div
            className="outcome-card"
            role="status"
          >
            <div
              className="outcome-mark"
              aria-hidden="true"
            >
              <svg viewBox="0 0 88 88">
                <rect
                  className="sq"
                  x="4"
                  y="4"
                  width="80"
                  height="80"
                />
                <path
                  className="tick"
                  d="M24 46 L38 60 L64 30"
                />
              </svg>
            </div>

            <h1>Déclaration envoyée</h1>

            <p>
              {tachesSelectionnees.length}{" "}
              plateforme
              {tachesSelectionnees.length > 1
                ? "s"
                : ""}{" "}
              déclarée
              {tachesSelectionnees.length > 1
                ? "s"
                : ""}.
              Merci pour votre collaboration.
            </p>

            <div className="outcome-timer">
              <p>
                Fin de session automatique dans
                quelques secondes.
              </p>

              <div className="bar">
                <span
                  style={
                    {
                      "--t": "5s",
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  const steps = (
    <nav
      className="steps"
      aria-label="Étapes de la déclaration"
    >
      <ol>
        {[
          {
            name: "Vos informations",
            meta: "Nom, direction, statut",
            done:
              identiteComplete ||
              etape === "resume",
            current:
              etape === "form" &&
              !identiteComplete,
          },
          {
            name: "Plateformes",
            meta:
              checkedCount > 0
                ? `${checkedCount} sélectionnée${
                    checkedCount > 1
                      ? "s"
                      : ""
                  }`
                : "Cochez et décrivez",
            done:
              plateformesCompletes ||
              etape === "resume",
            current:
              etape === "form" &&
              identiteComplete,
          },
          {
            name: "Vérification",
            meta: "Relire puis envoyer",
            done: false,
            current: etape === "resume",
          },
        ].map((s, i) => (
          <li
            key={s.name}
            className={`step ${
              s.done
                ? "is-done"
                : ""
            } ${
              s.current
                ? "is-current"
                : ""
            }`}
            aria-current={
              s.current
                ? "step"
                : undefined
            }
          >
            <span
              className="step-dot tabular"
              style={
                s.current
                  ? {
                      background: "#ff7900",
                      borderColor: "#ff7900",
                      color: "#fff",
                    }
                  : undefined
              }
            >
              {s.done ? (
                <Check
                  aria-hidden="true"
                  strokeWidth={3}
                />
              ) : (
                i + 1
              )}
            </span>

            <span
              className="step-name"
              style={
                s.current
                  ? { color: "#ff7900", fontWeight: 600 }
                  : undefined
              }
            >
              {s.name}
              <span className="step-meta">
                {s.meta}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );

  /* ── Résumé ── */
  if (etape === "resume") {
    const resumeFields = [
      {
        label: "CUID",
        value: cuid || "—",
      },
      {
        label: "Nom",
        value: nom,
      },
      {
        label: "Prénom",
        value: prenom,
      },
      {
        label: "Direction",
        value: direction,
      },
      {
        label: "Poste",
        value: poste,
      },
      ...(referent.trim()
        ? [
            {
              label: "Référent",
              value: referent,
            },
          ]
        : []),
      {
        label: "Statut",
        value: statut,
      },
      ...(statut &&
      statut !== "Employé"
        ? [
            {
              label:
                "Entreprise partenaire",
              value:
                entreprisePartenaire,
            },
          ]
        : []),
    ];

    return (
      <>
        {header}

        <div
          className="portal-progress"
          aria-hidden="true"
        >
          <span
            style={
              {
                "--p": progression,
              } as CSSProperties
            }
          />
        </div>

        <div className="decl">
          {steps}

          <main className="decl-main">
            <button
              type="button"
              onClick={() =>
                setEtape("form")
              }
              className="btn btn-ghost"
            >
              <ArrowLeft
                aria-hidden="true"
              />
              Modifier la déclaration
            </button>

            <h1
              className="decl-title"
              style={{ marginTop: 12 }}
            >
              Vérifiez avant d&apos;envoyer
            </h1>

            <p className="decl-lede">
              Une fois envoyée, votre
              déclaration ne pourra plus être
              modifiée.
            </p>

            <section
              className="panel"
              aria-labelledby="resume-identite"
            >
              <div className="panel-head">
                <h2
                  id="resume-identite"
                  className="panel-title"
                >
                  Vos informations
                </h2>
              </div>

              <div className="panel-body">
                <dl className="summary-list">
                  {resumeFields.map(
                    (f, i) => (
                      <div
                        key={f.label}
                        style={{
                          animationDelay: `${
                            120 + i * 45
                          }ms`,
                        }}
                      >
                        <dt>{f.label}</dt>
                        <dd>{f.value}</dd>
                      </div>
                    )
                  )}
                </dl>
              </div>
            </section>

            <section
              className="panel"
              aria-labelledby="resume-plateformes"
            >
              <div className="panel-head">
                <h2
                  id="resume-plateformes"
                  className="panel-title"
                >
                  Plateformes déclarées
                </h2>

                <span className="count-pill">
                  <b className="tabular">
                    {
                      tachesSelectionnees.length
                    }
                  </b>
                </span>
              </div>

              <div className="panel-body">
                <ul className="summary-platforms">
                  {tachesSelectionnees.map(
                    (l, i) => (
                      <li
                        key={l.id}
                        style={{
                          animationDelay: `${
                            200 +
                            Math.min(i, 10) *
                              45
                          }ms`,
                        }}
                      >
                        <div>
                          <h3>{l.text}</h3>
                          <p>
                            {descs[l.id]}
                          </p>
                        </div>
                      </li>
                    )
                  )}
                </ul>
              </div>
            </section>

            {erreurEnvoi && (
              <div
                className="notice"
                role="alert"
                style={{ marginTop: 24 }}
              >
                <AlertCircle
                  aria-hidden="true"
                />
                <span>
                  {erreurEnvoi}
                </span>
              </div>
            )}

            <p className="page-foot">
              © 2026 Orange Burkina Faso.
              Tous droits réservés.
            </p>
          </main>
        </div>

        <div className="action-bar">
          <div className="action-bar-inner">
            <span className="action-bar-status">
              Dernière étape : confirmez
              l&apos;envoi.
            </span>

            <div className="action-bar-actions">
              <button
                type="button"
                onClick={() =>
                  setEtape("form")
                }
                className="btn btn-secondary"
              >
                Modifier
              </button>

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPopup(true)
                }
                disabled={envoiEnCours}
                className="btn btn-primary"
              >
                {envoiEnCours ? (
                  <Loader2
                    className="spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send aria-hidden="true" />
                )}

                {envoiEnCours
                  ? "Envoi…"
                  : "Envoyer la déclaration"}
              </button>
            </div>
          </div>
        </div>

        {showConfirmPopup && (
          <div
            className="modal-backdrop"
            onClick={() =>
              setShowConfirmPopup(false)
            }
          >
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              aria-describedby="confirm-desc"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <h2 id="confirm-title">
                Envoyer définitivement ?
              </h2>

              <p id="confirm-desc">
                Vous déclarez{" "}
                {
                  tachesSelectionnees.length
                }{" "}
                plateforme
                {tachesSelectionnees.length >
                1
                  ? "s"
                  : ""}
                . Après l&apos;envoi, ces
                informations ne pourront plus
                être modifiées.
              </p>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPopup(false)
                  }
                  className="btn btn-secondary"
                  autoFocus
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmPopup(false);
                    handleConfirmerEnvoi();
                  }}
                  className="btn btn-danger"
                >
                  Envoyer définitivement
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  /* ── Formulaire ── */
  const erreurTexte = (
    champ: "nom" | "prenom" | "poste"
  ) =>
    !!textErrors[champ] &&
    !!textTouched[champ];

  return (
    <>
      {header}

      <div
        className="portal-progress"
        aria-hidden="true"
      >
        <span
          style={
            {
              "--p": progression,
            } as CSSProperties
          }
        />
      </div>

      <div className="decl">
        {steps}

        <main className="decl-main">
          <h1 className="decl-title">
            Déclarez les plateformes que vous
            utilisez
          </h1>

          <p className="decl-lede">
            Renseignez vos informations, cochez
            chaque plateforme utilisée et
            expliquez en une phrase ou deux ce
            que vous y faites.
          </p>

          <form
            id="declaration"
            onSubmit={handleValiderFormulaire}
            noValidate
          >
            {/* ── Vos informations ── */}
            <section
              className="panel"
              aria-labelledby="bloc-identite"
            >
              <div className="panel-head">
                <div>
                  <h2
                    id="bloc-identite"
                    className="panel-title"
                  >
                    Vos informations
                  </h2>

                  <p className="panel-desc">
                    Tous les champs sont
                    obligatoires.
                  </p>
                </div>
              </div>

              <div className="panel-body stack">
                <div className="grid-2">
                  <div className="field">
                    <label
                      htmlFor="r-nom"
                      className="field-label"
                    >
                      Nom
                      <span
                        className="req"
                        aria-hidden="true"
                      >
                        *
                      </span>
                    </label>

                    <input
                      id="r-nom"
                      type="text"
                      value={nom}
                      autoComplete="family-name"
                      className="input"
                      aria-invalid={erreurTexte(
                        "nom"
                      )}
                      aria-describedby={
                        erreurTexte("nom")
                          ? "r-nom-err"
                          : undefined
                      }
                      onChange={(e) => {
                        setNom(
                          e.target.value
                        );

                        if (
                          textTouched.nom
                        ) {
                          setTextErrors(
                            (p) => ({
                              ...p,
                              nom: e.target.value.trim()
                                ? ""
                                : "Veuillez remplir ce champ",
                            })
                          );
                        }
                      }}
                      onBlur={() => {
                        setTextTouched(
                          (p) => ({
                            ...p,
                            nom: true,
                          })
                        );

                        if (!nom.trim()) {
                          setTextErrors(
                            (p) => ({
                              ...p,
                              nom: "Veuillez remplir ce champ",
                            })
                          );
                        }
                      }}
                      placeholder="Votre nom"
                    />

                    {erreurTexte("nom") && (
                      <p
                        id="r-nom-err"
                        className="field-error"
                      >
                        <AlertCircle aria-hidden="true" />
                        Indiquez votre nom.
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <label
                      htmlFor="r-prenom"
                      className="field-label"
                    >
                      Prénom
                      <span
                        className="req"
                        aria-hidden="true"
                      >
                        *
                      </span>
                    </label>

                    <input
                      id="r-prenom"
                      type="text"
                      value={prenom}
                      autoComplete="given-name"
                      className="input"
                      aria-invalid={erreurTexte(
                        "prenom"
                      )}
                      aria-describedby={
                        erreurTexte(
                          "prenom"
                        )
                          ? "r-prenom-err"
                          : undefined
                      }
                      onChange={(e) => {
                        setPrenom(
                          e.target.value
                        );

                        if (
                          textTouched.prenom
                        ) {
                          setTextErrors(
                            (p) => ({
                              ...p,
                              prenom:
                                e.target.value.trim()
                                  ? ""
                                  : "Veuillez remplir ce champ",
                            })
                          );
                        }
                      }}
                      onBlur={() => {
                        setTextTouched(
                          (p) => ({
                            ...p,
                            prenom: true,
                          })
                        );

                        if (
                          !prenom.trim()
                        ) {
                          setTextErrors(
                            (p) => ({
                              ...p,
                              prenom:
                                "Veuillez remplir ce champ",
                            })
                          );
                        }
                      }}
                      placeholder="Votre prénom"
                    />

                    {erreurTexte(
                      "prenom"
                    ) && (
                      <p
                        id="r-prenom-err"
                        className="field-error"
                      >
                        <AlertCircle aria-hidden="true" />
                        Indiquez votre prénom.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="field">
                    <label
                      htmlFor="r-cuid"
                      className="field-label"
                    >
                      CUID
                    </label>

                    <input
                      id="r-cuid"
                      type="text"
                      readOnly
                      disabled
                      value={cuid}
                      className="input tabular"
                    />
                  </div>

                  <div className="field">
                    <label
                      htmlFor="r-direction"
                      className="field-label"
                    >
                      Direction
                      <span
                        className="req"
                        aria-hidden="true"
                      >
                        *
                      </span>
                    </label>

                    <SearchableSelect
                      id="r-direction"
                      value={direction}
                      options={directions}
                      placeholder="Choisir une direction"
                      aria-invalid={!!selectErrors.direction}
                      onChange={(v) => {
                        setDirection(v);
                        setSelectErrors((p) => ({
                          ...p,
                          direction: false,
                        }));
                      }}
                    />

                    {selectErrors.direction && (
                      <p className="field-error">
                        <AlertCircle aria-hidden="true" />
                        Choisissez votre
                        direction.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="field">
                    <label
                      htmlFor="r-statut"
                      className="field-label"
                    >
                      Statut
                      <span
                        className="req"
                        aria-hidden="true"
                      >
                        *
                      </span>
                    </label>

                    <SearchableSelect
                      id="r-statut"
                      value={statut}
                      options={STATUTS}
                      placeholder="Choisir un statut"
                      aria-invalid={!!selectErrors.statut}
                      onChange={(v) => {
                        setStatut(v);
                        setSelectErrors((p) => ({
                          ...p,
                          statut: false,
                          partenaire: false,
                        }));
                        if (v === "Employé") {
                          setEntreprisePartenaire("");
                        }
                      }}
                    />

                    {selectErrors.statut && (
                      <p className="field-error">
                        <AlertCircle aria-hidden="true" />
                        Choisissez votre
                        statut.
                      </p>
                    )}
                  </div>

                  {statut &&
                    statut !==
                      "Employé" && (
                      <div className="field reveal">
                        <label
                          htmlFor="r-partenaire"
                          className="field-label"
                        >
                          Entreprise partenaire
                          <span
                            className="req"
                            aria-hidden="true"
                          >
                            *
                          </span>
                        </label>

                        <SearchableSelect
                          id="r-partenaire"
                          value={entreprisePartenaire}
                          options={partenairesListe}
                          placeholder="Choisir l'entreprise"
                          aria-invalid={!!selectErrors.partenaire}
                          onChange={(v) => {
                            setEntreprisePartenaire(v);
                            setSelectErrors((p) => ({
                              ...p,
                              partenaire: false,
                            }));
                          }}
                        />

                        {selectErrors.partenaire && (
                          <p className="field-error">
                            <AlertCircle aria-hidden="true" />
                            Choisissez
                            l&apos;entreprise
                            partenaire.
                          </p>
                        )}

                        {partenairesListe.length ===
                          0 && (
                          <p className="field-hint">
                            Aucune entreprise
                            partenaire n&apos;est
                            encore enregistrée.
                          </p>
                        )}
                      </div>
                    )}
                </div>

                <div className="grid-2">
                  <div className="field">
                    <label
                      htmlFor="r-poste"
                      className="field-label"
                    >
                      Poste
                      <span
                        className="req"
                        aria-hidden="true"
                      >
                        *
                      </span>
                    </label>

                    <input
                      id="r-poste"
                      type="text"
                      value={poste}
                      autoComplete="organization-title"
                      className="input"
                      aria-invalid={erreurTexte(
                        "poste"
                      )}
                      aria-describedby={
                        erreurTexte("poste")
                          ? "r-poste-err"
                          : undefined
                      }
                      onChange={(e) => {
                        setPoste(
                          e.target.value
                        );

                        if (
                          textTouched.poste
                        ) {
                          setTextErrors(
                            (p) => ({
                              ...p,
                              poste:
                                e.target.value.trim()
                                  ? ""
                                  : "Veuillez remplir ce champ",
                            })
                          );
                        }
                      }}
                      onBlur={() => {
                        setTextTouched(
                          (p) => ({
                            ...p,
                            poste: true,
                          })
                        );

                        if (!poste.trim()) {
                          setTextErrors(
                            (p) => ({
                              ...p,
                              poste:
                                "Veuillez remplir ce champ",
                            })
                          );
                        }
                      }}
                      placeholder="Votre poste"
                    />

                    {erreurTexte("poste") && (
                      <p
                        id="r-poste-err"
                        className="field-error"
                      >
                        <AlertCircle aria-hidden="true" />
                        Indiquez votre poste.
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <label
                      htmlFor="r-referent"
                      className="field-label"
                    >
                      Référent
                    </label>

                    <input
                      id="r-referent"
                      type="text"
                      value={referent}
                      className="input"
                      onChange={(e) =>
                        setReferent(
                          e.target.value
                        )
                      }
                      placeholder="Nom de votre référent"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ── Plateformes ── */}
            <section
              className="panel"
              aria-labelledby="bloc-plateformes"
            >
              <div className="panel-head">
                <div>
                  <h2
                    id="bloc-plateformes"
                    className="panel-title"
                  >
                    Plateformes utilisées
                  </h2>

                  <p className="panel-desc">
                    Une description est demandée
                    pour chaque plateforme cochée.
                  </p>
                </div>

                {!loading && !error && (
                  <span
                    className="count-pill"
                    aria-live="polite"
                  >
                    <b
                      key={checkedCount}
                      className="tabular"
                    >
                      {checkedCount}
                    </b>

                    sélectionnée
                    {checkedCount > 1
                      ? "s"
                      : ""}
                  </span>
                )}
              </div>

              <div className="platform-tools">
                <div className="input-icon">
                  {/*<Search aria-hidden="true" />*/}

                  <input
                    type="search"
                    value={
                      recherchePlateforme
                    }
                    className="input"
                    onChange={(e) =>
                      setRecherchePlateforme(
                        e.target.value
                      )
                    }
                    placeholder="Rechercher une plateforme"
                    aria-label="Rechercher une plateforme"
                  />
                </div>
              </div>

              {loading && (
                <div
                  className="platform-list"
                  aria-busy="true"
                  aria-label="Chargement des plateformes"
                >
                  {[62, 44, 70, 52, 38].map(
                    (w, i) => (
                      <div
                        key={i}
                        className="skeleton-row"
                      >
                        <span
                          className="skeleton"
                          style={{
                            width: 24,
                            height: 24,
                          }}
                        />

                        <span
                          className="skeleton"
                          style={{
                            width: `${w}%`,
                            height: 14,
                          }}
                        />
                      </div>
                    )
                  )}
                </div>
              )}

              {error && (
                <div className="panel-body">
                  <div
                    className="notice"
                    role="alert"
                  >
                    <AlertCircle aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {!loading && !error && (
                <div className="platform-list">
                  {lignesFiltrees.length ===
                    0 && (
                    <div className="list-empty">
                      <SearchX aria-hidden="true" />

                      <span>
                        {lignes.length ===
                        0
                          ? "Aucune plateforme n'est encore disponible."
                          : `Aucune plateforme ne contient « ${recherchePlateforme} ».`}
                      </span>
                    </div>
                  )}

                  {lignesFiltrees.map(
                    (l) => {
                      const estCochee =
                        !!checks[l.id];

                      const afficherErreur =
                        estCochee &&
                        !!descTouched[
                          l.id
                        ] &&
                        descManquante(
                          l.id
                        );

                      const descId = `desc-${l.id}`;

                      const longueur = (
                        descs[l.id] ?? ""
                      )
                        .trim()
                        .length;

                      return (
                        <div
                          key={l.id}
                          className={`platform ${
                            estCochee
                              ? "is-on"
                              : ""
                          } ${
                            afficherErreur
                              ? "is-invalid"
                              : ""
                          }`}
                        >
                          <label className="platform-row">
                            <span className="check">
                              <input
                                type="checkbox"
                                checked={
                                  estCochee
                                }
                                onChange={(
                                  e
                                ) => {
                                  const coche =
                                    e.target
                                      .checked;

                                  setChecks(
                                    (
                                      prev
                                    ) => ({
                                      ...prev,
                                      [l.id]:
                                        coche,
                                    })
                                  );

                                  if (!coche) {
                                    setDescTouched(
                                      (
                                        prev
                                      ) => ({
                                        ...prev,
                                        [l.id]:
                                          false,
                                      })
                                    );
                                  } else {
                                    // Placer le curseur dans
                                    // la description dès l'ouverture
                                    setTimeout(
                                      () =>
                                        document
                                          .getElementById(
                                            descId
                                          )
                                          ?.focus({
                                            preventScroll:
                                              true,
                                          }),
                                      200
                                    );
                                  }
                                }}
                              />

                              <span
                                className="check-box"
                                aria-hidden="true"
                              >
                                <svg viewBox="0 0 16 16">
                                  <path d="M3 8.5 L6.5 12 L13 4.5" />
                                </svg>
                              </span>
                            </span>

                            <span className="platform-name">
                              {l.text}
                            </span>

                            <span
                              className="platform-state"
                              aria-hidden="true"
                            >
                              {afficherErreur
                                ? "Description manquante"
                                : estCochee &&
                                    longueur >
                                      0
                                  ? "Décrite"
                                  : "Cochée"}
                            </span>
                          </label>

                          <div
                            className="platform-detail"
                            inert={
                              !estCochee
                            }
                          >
                            <div>
                              <div className="platform-detail-inner">
                                <label
                                  htmlFor={
                                    descId
                                  }
                                >
                                  Que faites-vous
                                  sur{" "}
                                  {l.text} ?
                                </label>

                                <textarea
                                  id={descId}
                                  className="textarea"
                                  rows={3}
                                  value={
                                    descs[
                                      l.id
                                    ] ?? ""
                                  }
                                  aria-invalid={
                                    afficherErreur
                                  }
                                  aria-describedby={
                                    afficherErreur
                                      ? `${descId}-err`
                                      : undefined
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    setDescs(
                                      (
                                        prev
                                      ) => ({
                                        ...prev,
                                        [l.id]:
                                          e.target
                                            .value,
                                      })
                                    )
                                  }
                                  onBlur={() =>
                                    setDescTouched(
                                      (
                                        prev
                                      ) => ({
                                        ...prev,
                                        [l.id]:
                                          true,
                                      })
                                    )
                                  }
                                  placeholder="Ex. saisie des tickets clients, suivi des interventions…"
                                />

                                {afficherErreur ? (
                                  <p
                                    key={
                                      toggleSansDesc
                                    }
                                    id={`${descId}-err`}
                                    className="field-error shake"
                                  >
                                    <AlertCircle aria-hidden="true" />
                                    {" "}
                                    Décrivez votre
                                    utilisation
                                    de cette
                                    plateforme.
                                  </p>
                                ) : (
                                  <span
                                    className="char-count tabular"
                                    aria-hidden="true"
                                  >
                                    {longueur}{" "}
                                    caractère
                                    {longueur >
                                    1
                                      ? "s"
                                      : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          </form>

          <p className="page-foot">
            © 2026 Orange Burkina Faso. Tous
            droits réservés.
          </p>
        </main>
      </div>

      <div className="action-bar">
        <div className="action-bar-inner">
          <span className="action-bar-status">
            {checkedCount === 0 ? (
              "Cochez au moins une plateforme pour continuer."
            ) : auMoinsUneDescManquante ? (
              <>
                <b>
                  {
                    tachesSelectionnees.filter(
                      (l) =>
                        descManquante(
                          l.id
                        )
                    ).length
                  }
                </b>{" "}
                description
                {tachesSelectionnees.filter(
                  (l) =>
                    descManquante(
                      l.id
                    )
                ).length > 1
                  ? "s"
                  : ""}{" "}
                à compléter
              </>
            ) : (
              <>
                <b>{checkedCount}</b>{" "}
                plateforme
                {checkedCount > 1
                  ? "s"
                  : ""}{" "}
                prête
                {checkedCount > 1
                  ? "s"
                  : ""}
              </>
            )}
          </span>

          <div className="action-bar-actions">
            <button
              type="submit"
              form="declaration"
              disabled={checkedCount === 0}
              className="btn btn-primary"
            >
              Vérifier ma déclaration
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

