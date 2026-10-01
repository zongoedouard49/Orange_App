"""
Protection CSRF — « double submit cookie » signé.

Principe :
  1. Le frontend appelle GET /csrf-token : le serveur génère un jeton signé (HMAC),
     le dépose dans un cookie HttpOnly et le renvoie aussi dans le corps JSON.
  2. Pour toute requête modifiante (POST/PUT/PATCH/DELETE), le frontend renvoie ce
     jeton dans l'en-tête X-CSRF-Token (nom configurable).
  3. Le middleware n'accepte la requête que si l'en-tête == cookie ET si la
     signature est valide. Si un en-tête Origin est présent, il doit aussi
     appartenir à ALLOWED_ORIGINS.

Un site tiers ne peut ni lire le jeton (CORS restreint à ALLOWED_ORIGINS), ni forger
l'en-tête personnalisé : la requête forgée est rejetée avec un 403.
"""
import hashlib
import hmac
import logging
import secrets

from fastapi import APIRouter, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from config import (
    ALLOWED_ORIGINS,
    CSRF_COOKIE_NAME,
    CSRF_COOKIE_SAMESITE,
    CSRF_COOKIE_SECURE,
    CSRF_ENABLED,
    CSRF_HEADER_NAME,
    CSRF_TOKEN_MAX_AGE,
    SECRET_KEY,
)

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

log = logging.getLogger("csrf")
router = APIRouter(tags=["Sécurité"])


def _sign(value: str) -> str:
    return hmac.new(SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()


def generate_token() -> str:
    raw = secrets.token_urlsafe(32)
    return f"{raw}.{_sign(raw)}"


def _is_valid_signature(token: str) -> bool:
    raw, sep, sig = token.partition(".")
    return bool(sep) and hmac.compare_digest(sig, _sign(raw))


def _forbidden(message: str) -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": message, "code": "csrf_invalid"})


@router.get("/csrf-token", summary="Obtenir un jeton CSRF", include_in_schema=False)
def get_csrf_token(request: Request, response: Response):
    # Réutilise le jeton du cookie s'il est encore valide, sinon en génère un nouveau
    token = request.cookies.get(CSRF_COOKIE_NAME)
    if not token or not _is_valid_signature(token):
        token = generate_token()
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        max_age=CSRF_TOKEN_MAX_AGE,
        httponly=True,
        secure=CSRF_COOKIE_SECURE,
        samesite=CSRF_COOKIE_SAMESITE,
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return {"csrf_token": token, "header_name": CSRF_HEADER_NAME}


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not CSRF_ENABLED or request.method in SAFE_METHODS:
            return await call_next(request)

        # 1) Contrôle de l'origine quand le navigateur la fournit
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") not in ALLOWED_ORIGINS:
            log.warning("CSRF : origine %r absente de ALLOWED_ORIGINS=%s (%s %s)", origin, ALLOWED_ORIGINS, request.method, request.url.path)
            return _forbidden("Origine non autorisée.")

        # 2) Contrôle du jeton (cookie == en-tête, signature valide)
        cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
        header_token = request.headers.get(CSRF_HEADER_NAME)
        if (
            not cookie_token
            or not header_token
            or not hmac.compare_digest(cookie_token, header_token)
            or not _is_valid_signature(cookie_token)
        ):
            return _forbidden("Jeton CSRF invalide ou manquant. Rechargez la page et réessayez.")

        return await call_next(request)
