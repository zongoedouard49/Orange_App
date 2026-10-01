"""
Temps réel (WebSocket).

Fonctionnement :
  • Chaque commit SQLAlchemy est détecté automatiquement (événements de Session) :
    toute création / modification / suppression sur une table suivie déclenche un
    message « change » envoyé aux clients connectés. Aucune route n'a besoin d'être
    modifiée, et les écritures faites hors routes (middleware, etc.) sont couvertes.
  • Les écritures de services.json (hors base) publient explicitement "services".
  • Le message ne contient AUCUNE donnée métier : seulement {resource, action}.
    Le client recharge alors ses données via l'API (déjà protégée par JWT).

Sécurité :
  • Origine du navigateur contrôlée (ALLOWED_ORIGINS) contre le détournement de WebSocket.
  • Authentification par JWT envoyé dans le 1er message (pas dans l'URL → pas dans les logs).
  • Connexion fermée à l'expiration du token ; admin désactivé = refusé.
  • Admin : reçoit tout. Utilisateur : reçoit "services" (listes publiques) et les
    changements qui concernent son propre CUID (ex. blocage de son compte).

Limite : le hub est en mémoire → un seul processus uvicorn (pas de --workers > 1).
Pour plusieurs processus, brancher un bus (Redis pub/sub) derrière Hub.publish.
"""
import asyncio
import json
import logging
import time
from typing import Iterable, Optional

from fastapi import APIRouter, WebSocket
from jose import JWTError, jwt
from sqlalchemy import event
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

import models
from config import (
    ALGORITHM,
    ALLOWED_ORIGINS,
    REALTIME_ENABLED,
    REALTIME_MAX_CONNECTIONS,
    SECRET_KEY,
)

log = logging.getLogger("realtime")
router = APIRouter()

# table SQL -> nom de ressource envoyé au client
WATCHED_TABLES = {
    "users": "admins",
    "renseignements": "renseignements",
    "renseignement_logs": "renseignement_logs",
    "login_logs": "login_logs",
    "blocked_accounts": "blocked_accounts",
    "blocked_ips": "blocked_ips",
}
PUBLIC_RESOURCES = {"services"}                       # visibles aussi par les utilisateurs
USER_SCOPED_RESOURCES = {"blocked_accounts"}          # visibles par l'utilisateur concerné

AUTH_TIMEOUT = 10        # s pour envoyer le message d'authentification
IDLE_TIMEOUT = 90        # s sans message (le client envoie un ping toutes les 25 s)
SEND_TIMEOUT = 5


class Connection:
    def __init__(self, ws: WebSocket, role: str, cuid: str):
        self.ws, self.role, self.cuid = ws, role, cuid.strip().upper()

    def wants(self, resource: str, cuids: set) -> bool:
        if self.role == "admin":
            return True
        if resource in PUBLIC_RESOURCES:
            return True
        return resource in USER_SCOPED_RESOURCES and self.cuid in cuids


class Hub:
    def __init__(self):
        self.connections: set[Connection] = set()
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    # ── appelable depuis n'importe quel thread (routes sync, middleware…) ──
    def publish(self, resource: str, action: str, cuids: Iterable[str] = ()) -> None:
        if not REALTIME_ENABLED or self.loop is None or not self.connections:
            return
        message = {"type": "change", "resource": resource, "action": action, "ts": int(time.time() * 1000)}
        cuid_set = {c.strip().upper() for c in cuids if c}
        try:
            self.loop.call_soon_threadsafe(
                lambda: asyncio.ensure_future(self._broadcast(message, cuid_set))
            )
        except RuntimeError:  # boucle fermée (arrêt du serveur)
            pass

    async def _broadcast(self, message: dict, cuids: set) -> None:
        payload = json.dumps(message)
        for conn in list(self.connections):
            if not conn.wants(message["resource"], cuids):
                continue
            try:
                await asyncio.wait_for(conn.ws.send_text(payload), SEND_TIMEOUT)
            except Exception:
                self.connections.discard(conn)


hub = Hub()


def publish(resource: str, action: str = "update", cuids: Iterable[str] = ()) -> None:
    """Raccourci pour les modifications hors base de données (ex. services.json)."""
    hub.publish(resource, action, cuids)


# ─── Détection automatique des modifications en base ────────────────────────
def _cuid_of(obj) -> Optional[str]:
    return getattr(obj, "cuid", None) or getattr(obj, "CUID", None)


@event.listens_for(Session, "after_flush")
def _collect_changes(session: Session, _ctx) -> None:
    changes = session.info.setdefault("rt_changes", {})
    groups = (
        ("insert", list(session.new)),
        ("update", [o for o in session.dirty if session.is_modified(o)]),
        ("delete", list(session.deleted)),
    )
    for action, objs in groups:
        for obj in objs:
            resource = WATCHED_TABLES.get(getattr(obj, "__tablename__", ""))
            if not resource:
                continue
            cuids = changes.setdefault((resource, action), set())
            cuid = _cuid_of(obj)
            if cuid:
                cuids.add(str(cuid))


@event.listens_for(Session, "after_commit")
def _publish_changes(session: Session) -> None:
    changes = session.info.pop("rt_changes", None)
    for (resource, action), cuids in (changes or {}).items():
        hub.publish(resource, action, cuids)


@event.listens_for(Session, "after_rollback")
def _discard_changes(session: Session) -> None:
    session.info.pop("rt_changes", None)


# ─── Endpoint WebSocket ─────────────────────────────────────────────────────
def _authenticate(token: str) -> Optional[tuple]:
    """Retourne (role, cuid, exp) ou None. Exécuté dans un thread (accès base)."""
    from database import SessionLocal
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    sub, exp = payload.get("sub"), payload.get("exp")
    if not sub or not exp:
        return None
    if payload.get("role") == "user":
        return "user", str(sub), float(exp)
    db = SessionLocal()
    try:
        admin = db.query(models.Admin).filter(models.Admin.cuid == sub).first()
        if admin is None or not admin.actif:
            return None
        return "admin", str(sub), float(exp)
    finally:
        db.close()


@router.websocket("/ws")
async def realtime_endpoint(ws: WebSocket):
    origin = ws.headers.get("origin")
    if not REALTIME_ENABLED:
        await ws.close(code=4403)
        return
    if origin and origin.rstrip("/") not in ALLOWED_ORIGINS:
        log.warning("WebSocket refusé : origine %r absente de ALLOWED_ORIGINS=%s", origin, ALLOWED_ORIGINS)
        await ws.close(code=4403)
        return
    if len(hub.connections) >= REALTIME_MAX_CONNECTIONS:
        await ws.close(code=4429)
        return

    hub.loop = asyncio.get_running_loop()
    await ws.accept()

    # 1) authentification par le premier message
    try:
        first = json.loads(await asyncio.wait_for(ws.receive_text(), AUTH_TIMEOUT))
        identity = await run_in_threadpool(_authenticate, str(first.get("token", ""))) \
            if first.get("type") == "auth" else None
    except Exception:
        identity = None
    if not identity or identity[2] <= time.time():
        await ws.close(code=4401)
        return

    role, cuid, exp = identity
    conn = Connection(ws, role, cuid)
    hub.connections.add(conn)
    try:
        await ws.send_text(json.dumps({"type": "ready", "role": role}))
        # 2) boucle : ping/pong, fermeture à l'expiration du token ou en cas d'inactivité
        while True:
            remaining = exp - time.time()
            if remaining <= 0:
                await ws.close(code=4401)
                return
            try:
                text = await asyncio.wait_for(ws.receive_text(), min(IDLE_TIMEOUT, remaining))
            except asyncio.TimeoutError:
                await ws.close(code=4401 if exp - time.time() <= 0 else 4408)
                return
            if text == "ping":
                await ws.send_text("pong")
    except Exception:
        pass  # déconnexion du client
    finally:
        hub.connections.discard(conn)
