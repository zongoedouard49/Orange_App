import time
from collections import defaultdict

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse

from database import Base, engine, SessionLocal
import auth
import models
from config import RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW, DEFAULT_ADMIN_CUID, DEFAULT_ADMIN_PASSWORD, ALLOWED_ORIGINS
from csrf import CSRFMiddleware, router as csrf_router
import realtime
from sqlalchemy import inspect, text
import users
import services
import renseignements
import admin
_ip_requests: dict[str, list[float]] = defaultdict(list)
_blocked_ips: set[str] = set()


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"

        if client_ip in _blocked_ips:
            return JSONResponse(
                status_code=429,
                content={"detail": "Votre adresse IP a été bloquée pour activité suspecte."},
            )

        now = time.time()
        _ip_requests[client_ip] = [t for t in _ip_requests[client_ip] if now - t < RATE_LIMIT_WINDOW]
        _ip_requests[client_ip].append(now)

        if len(_ip_requests[client_ip]) > RATE_LIMIT_REQUESTS:
            _blocked_ips.add(client_ip)
            # Log the block
            try:
                db = SessionLocal()
                db.add(models.BlockedIP(
                    adresse_ip=client_ip,
                    raison=f"Plus de {RATE_LIMIT_REQUESTS} requêtes/seconde",
                ))
                db.commit()
                db.close()
            except Exception:
                pass
            return JSONResponse(
                status_code=429,
                content={"detail": "Votre adresse IP a été bloquée pour activité suspecte."},
            )

        return await call_next(request)

# Création automatique des tables
Base.metadata.create_all(bind=engine)

# Migrations légères
inspector = inspect(engine)

# Migration: colonne actif
if "actif" not in {c["name"] for c in inspector.get_columns("users")}:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN actif BOOLEAN NOT NULL DEFAULT 1"))

# Migration: colonne created_at sur users
if "created_at" not in {c["name"] for c in inspector.get_columns("users")}:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))

# Migration: colonne direction sur renseignements (renommage de service)
if "renseignements" in inspector.get_table_names():
    rens_cols = {c["name"] for c in inspector.get_columns("renseignements")}
    if "service" in rens_cols and "direction" not in rens_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE renseignements RENAME COLUMN service TO direction"))
    if "entreprise_partenaire" not in rens_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE renseignements ADD COLUMN entreprise_partenaire VARCHAR(100)"))
    if "plateforme" not in rens_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE renseignements ADD COLUMN plateforme VARCHAR(200)"))
    if "poste" not in rens_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE renseignements ADD COLUMN poste VARCHAR(100)"))
    if "referent" not in rens_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE renseignements ADD COLUMN referent VARCHAR(100)"))
    # Remove unique constraint on CUID (SQLite: recreate table)
    try:
        indexes = inspector.get_indexes("renseignements")
        unique_indexes = [idx for idx in indexes if idx.get("unique") and "CUID" in idx.get("column_names", [])]
        if unique_indexes:
            for idx in unique_indexes:
                with engine.begin() as conn:
                    conn.execute(text(f"DROP INDEX IF EXISTS {idx['name']}"))
    except Exception:
        pass

# Migration: colonne action sur login_logs
if "login_logs" in inspector.get_table_names():
    log_cols = {c["name"] for c in inspector.get_columns("login_logs")}
    if "action" not in log_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE login_logs ADD COLUMN action VARCHAR(50) NOT NULL DEFAULT 'login'"))

# Migration: colonnes statut et tentatives sur login_logs
if "login_logs" in inspector.get_table_names():
    log_cols2 = {c["name"] for c in inspector.get_columns("login_logs")}
    if "statut" not in log_cols2:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE login_logs ADD COLUMN statut VARCHAR(20) NOT NULL DEFAULT 'success'"))
    if "tentatives" not in log_cols2:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE login_logs ADD COLUMN tentatives INTEGER NOT NULL DEFAULT 0"))

# Migration: colonne created_at sur renseignements
if "renseignements" in inspector.get_table_names():
    rens_cols2 = {c["name"] for c in inspector.get_columns("renseignements")}
    if "created_at" not in rens_cols2:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE renseignements ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))

# Création du compte admin par défaut si aucun admin n'existe
with SessionLocal() as db:
    if db.query(models.Admin).count() == 0:
        db.add(models.Admin(cuid=DEFAULT_ADMIN_CUID, password=auth.hash_password(DEFAULT_ADMIN_PASSWORD), actif=True))
        db.commit()

app = FastAPI(
    title="API Renseignements",
    version="1.0.0",
    contact={"name": "Administration système"},
)

# Ordre : le dernier middleware ajouté est le plus externe. CORS doit être le plus
# externe pour que même les réponses 403/429 portent les en-têtes CORS.
app.add_middleware(CSRFMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # liste explicite (.env) : "*" est incompatible avec les cookies
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(csrf_router)
app.include_router(realtime.router)
app.include_router(admin.router)
app.include_router(users.router)
app.include_router(renseignements.router)
app.include_router(services.router)


@app.get("/", tags=["Root"], include_in_schema=False)
def root():
    return {"api": "Renseignements v1.0.0", "documentation": "/docs"}
