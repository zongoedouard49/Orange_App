import re
from pydantic import BaseModel, validator
from typing import Optional, List, Any


def sanitize_input(value: str) -> str:
    """Strip dangerous characters to prevent injection attacks."""
    # Remove null bytes and control characters
    value = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', value)
    return value.strip()


def validate_no_sql_injection(value: str, field_name: str) -> str:
    """Basic check for SQL injection patterns."""
    dangerous = re.compile(
        r"(--|;|'|\"|\b(DROP|DELETE|INSERT|UPDATE|ALTER|EXEC|UNION|SELECT)\b)",
        re.IGNORECASE,
    )
    if dangerous.search(value):
        raise ValueError(f"Le champ '{field_name}' contient des caractères non autorisés.")
    return value


# ─────────────────────────────────────────────────────────────
#  ADMIN
# ─────────────────────────────────────────────────────────────

class AdminCreate(BaseModel):
    cuid: str
    password: str

    @validator("cuid")
    def cuid_valide(cls, v):
        v = sanitize_input(v)
        if not v:
            raise ValueError("Le CUID ne peut pas être vide")
        if len(v) > 100:
            raise ValueError("Le CUID ne doit pas dépasser 100 caractères")
        validate_no_sql_injection(v, "cuid")
        return v

    @validator("password")
    def password_longueur(cls, v):
        v = sanitize_input(v)
        if not v:
            raise ValueError("Le mot de passe ne peut pas être vide")
        if len(v) < 6:
            raise ValueError("Le mot de passe doit contenir au moins 6 caractères")
        if len(v) > 128:
            raise ValueError("Le mot de passe ne doit pas dépasser 128 caractères")
        return v


class AdminLogin(BaseModel):
    cuid: str
    password: str

    @validator("cuid")
    def cuid_valide(cls, v):
        v = sanitize_input(v)
        if not v:
            raise ValueError("Le CUID ne peut pas être vide")
        validate_no_sql_injection(v, "cuid")
        return v

    @validator("password")
    def password_valide(cls, v):
        if not v or not v.strip():
            raise ValueError("Le mot de passe ne peut pas être vide")
        return v.strip()


class Token(BaseModel):
    access_token: str
    token_type: str


# ─────────────────────────────────────────────────────────────
#  UTILISATEUR (authentification externe)
# ─────────────────────────────────────────────────────────────

class UserLogin(BaseModel):
    cuid: str
    password: str
    adresse_mac: Optional[str] = None

    @validator("cuid")
    def cuid_valide(cls, v):
        v = sanitize_input(v)
        if not v:
            raise ValueError("Le CUID ne peut pas être vide")
        if len(v) > 100:
            raise ValueError("Le CUID ne doit pas dépasser 100 caractères")
        validate_no_sql_injection(v, "cuid")
        return v

    @validator("password")
    def password_valide(cls, v):
        if not v or not v.strip():
            raise ValueError("Le mot de passe ne peut pas être vide")
        return v.strip()

    @validator("adresse_mac")
    def mac_valide(cls, v):
        if v is None:
            return v
        v = sanitize_input(v)
        if len(v) > 50:
            raise ValueError("L'adresse MAC ne doit pas dépasser 50 caractères")
        return v


class UserLoginResponse(BaseModel):
    success: bool
    message: str
    access_token: Optional[str] = None
    data: Optional[Any] = None


# ─────────────────────────────────────────────────────────────
#  RENSEIGNEMENTS
# ─────────────────────────────────────────────────────────────

from config import STATUTS_VALIDES


class PlateformeItem(BaseModel):
    id: Optional[Any] = None
    text: str
    description: str

    @validator("text")
    def text_valide(cls, v):
        v = sanitize_input(v)
        if not v:
            raise ValueError("Le nom de la plateforme est obligatoire")
        if len(v) > 200:
            raise ValueError("Le nom de la plateforme ne doit pas dépasser 200 caractères")
        validate_no_sql_injection(v, "plateforme")
        return v

    @validator("description")
    def description_valide(cls, v):
        v = sanitize_input(v)
        if not v:
            raise ValueError("La description est obligatoire")
        if len(v) > 500:
            raise ValueError("La description ne doit pas dépasser 500 caractères")
        return v


class RenseignementCreate(BaseModel):
    cuid: str
    nom: str
    prenom: str
    statut: str
    entreprise_partenaire: Optional[str] = None
    direction: str
    adresse_mac: Optional[str] = None
    plateformes: List[PlateformeItem]

    @validator("adresse_mac", pre=True)
    def mac_valide(cls, v):
        if v is None:
            return v
        v = sanitize_input(str(v))
        if len(v) > 50:
            raise ValueError("L'adresse MAC ne doit pas dépasser 50 caractères")
        return v

    @validator("cuid", "nom", "prenom", "direction", pre=True)
    def champ_non_vide(cls, v, field):
        if not v or not str(v).strip():
            raise ValueError(f"Le champ '{field.name}' est obligatoire et ne peut pas être vide")
        v = sanitize_input(str(v))
        if len(v) > 100:
            raise ValueError(f"Le champ '{field.name}' ne doit pas dépasser 100 caractères")
        validate_no_sql_injection(v, field.name)
        return v

    @validator("plateformes", pre=True)
    def plateformes_non_vide(cls, v):
        if not v or (isinstance(v, list) and len(v) == 0):
            raise ValueError("Au moins une plateforme est obligatoire")
        return v

    @validator("statut", pre=True)
    def statut_valide(cls, v):
        if not v:
            raise ValueError("Le champ 'statut' est obligatoire")
        v_lower = str(v).strip().lower()
        if v_lower not in STATUTS_VALIDES:
            raise ValueError(
                f"Statut invalide '{v}'. Valeurs acceptées : {', '.join(STATUTS_VALIDES)}"
            )
        return v_lower


class RenseignementOut(BaseModel):
    id: int
    CUID: str
    Nom: str
    prenom: str
    statut: str
    entreprise_partenaire: Optional[str] = None
    direction: str
    plateforme: Optional[str] = None
    description: str

    class Config:
        orm_mode = True


# ─────────────────────────────────────────────────────────────
#  SERVICES / DIRECTIONS
# ─────────────────────────────────────────────────────────────

class ServicesListOut(BaseModel):
    services: List[str] = []
    plateformes: List[str] = []
    partenaires: List[str] = []

class AjouterValeurRequest(BaseModel):
    cle: str
    valeur: str

    @validator("cle")
    def cle_valide(cls, v):
        v = sanitize_input(v)
        if not v:
            raise ValueError("La clé est obligatoire")
        if len(v) > 50:
            raise ValueError("La clé ne doit pas dépasser 50 caractères")
        return v

    @validator("valeur")
    def valeur_valide(cls, v):
        v = sanitize_input(v)
        if not v:
            raise ValueError("La valeur est obligatoire")
        if len(v) > 200:
            raise ValueError("La valeur ne doit pas dépasser 200 caractères")
        validate_no_sql_injection(v, "valeur")
        return v

class ServicesUpdate(BaseModel):
    name: List[str]

    @validator("name")
    def liste_non_vide(cls, v):
        cleaned = [sanitize_input(s) for s in v if sanitize_input(s)]
        if not cleaned:
            raise ValueError("La liste ne peut pas être vide")
        for item in cleaned:
            if len(item) > 200:
                raise ValueError(f"'{item}' ne doit pas dépasser 200 caractères")
            validate_no_sql_injection(item, "name")
        return cleaned


class ServiceDeleteRequest(BaseModel):
    name: str
    type_: str

    @validator("name", "type_")
    def service_non_vide(cls, v, field):
        v = sanitize_input(v)
        if not v:
            raise ValueError(f"Le champ '{field.name}' est obligatoire")
        if len(v) > 200:
            raise ValueError(f"Le champ '{field.name}' ne doit pas dépasser 200 caractères")
        validate_no_sql_injection(v, field.name)
        return v
