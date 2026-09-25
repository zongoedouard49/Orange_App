import json
import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status

import auth
import models
import schemas
from config import SERVICES_FILE, STATUTS_VALIDES

router = APIRouter(prefix="/services", tags=["Services"])


def _load() -> dict:
    with open(SERVICES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("services", [])
    data.setdefault("plateformes", [])
    data.setdefault("partenaires", [])
    return data


def _save(data: dict) -> None:
    os.makedirs(os.path.dirname(SERVICES_FILE), exist_ok=True)
    with open(SERVICES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@router.get("/", summary="Lister tout")
def get_all():
    data = _load()
    data["statuts"] = sorted(STATUTS_VALIDES)
    return data


@router.get("/plateformes", summary="Lister les plateformes")
def get_plateformes():
    return {"plateformes": _load().get("plateformes", [])}


@router.get("/partenaires", summary="Lister les partenaires")
def get_partenaires():
    return {"partenaires": _load().get("partenaires", [])}


@router.post("/update", summary="Remplacer la liste (admin)")
def update_liste(
    body: schemas.ServicesUpdate,
    current_admin: models.Admin = Depends(auth.get_current_admin),
):
    seen = set()
    unique = []
    for s in body.name:
        key = s.lower()
        if key not in seen:
            seen.add(key)
            unique.append(s)
    data = _load()
    data["services"] = unique
    _save(data)
    return data


@router.post("/delete", summary="Supprimer un élément")
def supprimer(body: schemas.ServiceDeleteRequest):
    data = _load()
    type_ = body.type_
    items = data.get(type_, [])

    match = next(
        (s for s in items if s.lower() == body.name.lower()),
        None,
    )
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"'{body.name}' introuvable dans '{type_}'.",
        )

    items.remove(match)
    data[type_] = items
    _save(data)
    return data


@router.post("/importer-word", summary="Importer depuis Word")
async def importer_word(
    file: UploadFile = File(...),
    current_admin: models.Admin = Depends(auth.get_current_admin),
):
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Veuillez fournir un fichier Word .docx")
    try:
        from docx import Document
        import io
        contenu = await file.read()
        document = Document(io.BytesIO(contenu))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Fichier Word illisible ou invalide") from exc

    def normaliser(cell):
        return " ".join(cell.text.split()).strip()

    colonnes = None
    valeurs_plateformes, valeurs_services, valeurs_partenaires = [], [], []
    for tableau in document.tables:
        if not tableau.rows:
            continue
        entetes = [normaliser(c).casefold() for c in tableau.rows[0].cells]
        found_cols = {}
        for nom in ("plateformes", "services", "partenaires"):
            if nom in entetes:
                found_cols[nom] = entetes.index(nom)
        if not found_cols:
            continue
        colonnes = found_cols
        dest_map = {
            "plateformes": valeurs_plateformes,
            "services": valeurs_services,
            "partenaires": valeurs_partenaires,
        }
        for ligne in tableau.rows[1:]:
            cellules = ligne.cells
            for nom, destination in dest_map.items():
                if nom in colonnes:
                    idx = colonnes[nom]
                    if idx < len(cellules):
                        valeur = normaliser(cellules[idx])
                        if valeur:
                            destination.append(valeur)
        break

    if colonnes is None:
        raise HTTPException(status_code=400, detail="Aucun tableau avec les colonnes attendues trouvé")

    data = _load()

    def ajouter_uniques(cle, valeurs):
        existants = data.setdefault(cle, [])
        vus = {v.strip().casefold() for v in existants if isinstance(v, str)}
        ajoutes = []
        for valeur in valeurs:
            if valeur.casefold() not in vus:
                existants.append(valeur)
                vus.add(valeur.casefold())
                ajoutes.append(valeur)
        return ajoutes

    np = ajouter_uniques("plateformes", valeurs_plateformes)
    ns = ajouter_uniques("services", valeurs_services)
    npart = ajouter_uniques("partenaires", valeurs_partenaires)
    _save(data)
    return {
        "message": "Import terminé",
        "plateformes_ajoutees": np,
        "services_ajoutes": ns,
        "partenaires_ajoutes": npart,
    }


@router.post("/ajout")
def ajouter_valeur(data: schemas.AjouterValeurRequest):
    try:
        with open(SERVICES_FILE, "r", encoding="utf-8") as f:
            contenu = json.load(f)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Le fichier JSON est invalide.")

    cle = f'{data.cle.strip()}s'
    valeur = data.valeur.strip()

    if not cle:
        raise HTTPException(status_code=400, detail="La clé est obligatoire.")
    if not valeur:
        raise HTTPException(status_code=400, detail="La valeur est obligatoire.")

    if cle not in contenu:
        contenu[cle] = []

    if not isinstance(contenu[cle], list):
        raise HTTPException(status_code=400, detail=f"La clé '{cle}' ne contient pas une liste.")

    if valeur.lower() in [v.lower() for v in contenu[cle]]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La valeur '{valeur}' existe déjà dans '{cle}'."
        )

    contenu[cle].append(valeur)

    with open(SERVICES_FILE, "w", encoding="utf-8") as f:
        json.dump(contenu, f, ensure_ascii=False, indent=4)

    return {
        "success": True,
        "message": "Valeur ajoutée avec succès.",
        "cle": cle,
        "valeur": valeur,
        "ajoute": True
    }
