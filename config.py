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
