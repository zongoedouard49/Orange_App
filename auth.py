from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

import models
from database import get_db
from config import SECRET_KEY, ALGORITHM

# ─── Contexte bcrypt ─────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── Schéma OAuth2 — pointe vers l'endpoint de login admin ──────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/admin/login")


def hash_password(password: str) -> str:
    """Retourne le hash bcrypt du mot de passe."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Vérifie qu'un mot de passe en clair correspond au hash."""
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crée et signe un token JWT avec les données fournies."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=10))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.Admin:
    """
    Dépendance FastAPI.
    Décode le token JWT et retourne l'admin correspondant.
    Lève HTTP 401 si le token est invalide, expiré ou si l'admin n'existe plus.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré. Veuillez vous reconnecter.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        nom: str = payload.get("sub")
        if nom is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    admin = db.query(models.Admin).filter(models.Admin.cuid == nom).first()
    if admin is None or not admin.actif:
        raise credentials_exception

    return admin


def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> dict:
    """
    Dépendance FastAPI.
    Décode le token JWT et retourne les infos utilisateur.
    Accepte les tokens avec role=user (pas admin).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré. Veuillez vous reconnecter.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub: str = payload.get("sub")
        role: str = payload.get("role", "")
        if sub is None:
            raise credentials_exception
        return {"cuid": sub, "role": role}
    except JWTError:
        raise credentials_exception
