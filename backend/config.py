import os
from dotenv import load_dotenv

# Charger le fichier .env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ─── Clé secrète JWT ─────────────────────────────────────────────────────────
SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-changez-moi-en-production-2024")
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

# ─── API externe d'authentification utilisateur ──────────────────────────────
EXTERNAL_API_URL: str = os.getenv("EXTERNAL_API_URL", "http://localhost:8001/verify")
EXTERNAL_API_TIMEOUT: int = int(os.getenv("EXTERNAL_API_TIMEOUT", "10"))

# ─── Rate Limiting (IP) ─────────────────────────────────────────────────────
RATE_LIMIT_REQUESTS: int = int(os.getenv("RATE_LIMIT_REQUESTS", "20"))
RATE_LIMIT_WINDOW: int = int(os.getenv("RATE_LIMIT_WINDOW", "1"))

# ─── Rate Limiting Login (CUID) ─────────────────────────────────────────────
LOGIN_RATE_LIMIT_MAX: int = int(os.getenv("LOGIN_RATE_LIMIT_MAX", "5"))
LOGIN_RATE_LIMIT_WINDOW: int = int(os.getenv("LOGIN_RATE_LIMIT_WINDOW", "1800"))

# ─── Base de données ────────────────────────────────────────────────────────
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")

# ─── Admin par défaut ────────────────────────────────────────────────────────
DEFAULT_ADMIN_CUID: str = os.getenv("DEFAULT_ADMIN_CUID", "admin")
DEFAULT_ADMIN_PASSWORD: str = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")

# ─── Statuts valides ────────────────────────────────────────────────────────
STATUTS_VALIDES: set = set(
    s.strip() for s in os.getenv("STATUTS_VALIDES", "employé,prestataire,stagiaire,contractuel").split(",") if s.strip()
)

# ─── Fichier JSON des services ───────────────────────────────────────────────
SERVICES_FILE: str = os.path.join(os.path.dirname(__file__), "data", "services.json")


# ─── Pagination ──────────────────────────────────────────────────────────────
DEFAULT_PAGE_SIZE: int = int(os.getenv("DEFAULT_PAGE_SIZE", "20"))
MAX_PAGE_SIZE: int = max(int(os.getenv("MAX_PAGE_SIZE", "100")), DEFAULT_PAGE_SIZE)

# ─── Commande ARP (dépend de l'OS) ───────────────────────────────────────────
# Commande + option(s) passées avant l'adresse IP. Exemples :
#   Windows : ARP_COMMAND=arp   ARP_OPTION=-a
#   Linux   : ARP_COMMAND=arp   ARP_OPTION=-n      (ou -a)
ARP_COMMAND: str = os.getenv("ARP_COMMAND", "arp").strip() or "arp"
ARP_OPTION: str = os.getenv("ARP_OPTION", "-a").strip()

# ─── CORS / CSRF ─────────────────────────────────────────────────────────────
# Origines du frontend autorisées (séparées par des virgules). "*" est interdit
# car les cookies (jeton CSRF) sont envoyés avec les requêtes.
ALLOWED_ORIGINS: list = [
    o.strip().rstrip("/")
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if o.strip() and o.strip() != "*"
]
CSRF_ENABLED: bool = os.getenv("CSRF_ENABLED", "true").strip().lower() in ("1", "true", "yes", "on")
CSRF_COOKIE_NAME: str = os.getenv("CSRF_COOKIE_NAME", "csrf_token")
CSRF_HEADER_NAME: str = os.getenv("CSRF_HEADER_NAME", "X-CSRF-Token")
CSRF_TOKEN_MAX_AGE: int = int(os.getenv("CSRF_TOKEN_MAX_AGE", "28800"))  # secondes (8 h)
CSRF_COOKIE_SAMESITE: str = os.getenv("CSRF_COOKIE_SAMESITE", "lax").strip().lower()  # lax | strict | none
CSRF_COOKIE_SECURE: bool = os.getenv("CSRF_COOKIE_SECURE", "false").strip().lower() in ("1", "true", "yes", "on")

# ─── Temps réel (WebSocket) ──────────────────────────────────────────────────
REALTIME_ENABLED: bool = os.getenv("REALTIME_ENABLED", "true").strip().lower() in ("1", "true", "yes", "on")
REALTIME_MAX_CONNECTIONS: int = int(os.getenv("REALTIME_MAX_CONNECTIONS", "500"))
