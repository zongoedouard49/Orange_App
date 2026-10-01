import ipaddress
import os
import re
import shlex
import subprocess
import time
from collections import defaultdict
from datetime import timedelta

import requests
from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy.orm import Session
from fastapi import Depends

import auth
import models
import schemas
from config import EXTERNAL_API_URL, EXTERNAL_API_TIMEOUT, ACCESS_TOKEN_EXPIRE_MINUTES, LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW, ARP_COMMAND, ARP_OPTION
from database import get_db

router = APIRouter(prefix="/user", tags=["Utilisateur"])

# Rate limiting: {cuid: [(timestamp, ...)] }
_login_attempts: dict[str, list[float]] = defaultdict(list)
_failed_counts: dict[str, int] = defaultdict(int)
RATE_LIMIT_MAX = LOGIN_RATE_LIMIT_MAX
RATE_LIMIT_WINDOW = LOGIN_RATE_LIMIT_WINDOW

# Regex pour valider une adresse MAC (format xx:xx:xx:xx:xx:xx ou xx-xx-xx-xx-xx-xx)
_MAC_RE = re.compile(r"([0-9a-fA-F]{2}[:\-]){5}[0-9a-fA-F]{2}")
END_POINT_API_AD_OBF=os.environ.get("EXTERNAL_API_URL")

def get_mac_from_arp(ip: str) -> str:
    """Récupère l'adresse MAC d'un client via la table ARP du serveur (réseau local)."""
    if not ip or ip in ("unknown", "127.0.0.1", "::1"):
        return "unknown"
    try:
        ipaddress.ip_address(ip)  # refuse toute valeur qui n'est pas une IP (évite l'injection d'options)
        # Commande et option(s) configurables dans .env (ARP_COMMAND / ARP_OPTION) : varient selon l'OS
        result = subprocess.run(
            [ARP_COMMAND, *shlex.split(ARP_OPTION), ip],
            capture_output=True, text=True, timeout=5,
        )
        match = _MAC_RE.search(result.stdout)
        if match:
            return match.group(0).lower()
    except Exception:
        pass
    return "unknown"


def _check_rate_limit(cuid: str):
    now = time.time()
    attempts = _login_attempts[cuid]
    _login_attempts[cuid] = [t for t in attempts if now - t < RATE_LIMIT_WINDOW]
    if len(_login_attempts[cuid]) >= RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Trop de tentatives de connexion. Réessayez dans 30 minutes."
        )


@router.post(
    "/login",
    response_model=schemas.UserLoginResponse,
    summary="Vérifier l'identité d'un utilisateur via l'API externe",
)
def login_user(credentials: schemas.UserLogin, request: Request, db: Session = Depends(get_db)):
    cuid = credentials.cuid
    password=credentials.password
    _check_rate_limit(cuid)

    client_ip = request.client.host if request.client else "---"
    mac_address = get_mac_from_arp(client_ip)

    # Bloquer l'accès si ce CUID a déjà été bloqué (3 tentatives sans description)
    if db.query(models.BlockedAccount).filter(models.BlockedAccount.cuid == cuid).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Votre compte a été bloqué suite à plusieurs tentatives non conformes. Veuillez contacter l'administrateur.",
        )

    # --- Appel API externe (simulé pour le moment) ---
    # success = requests.post(url=END_POINT_API_AD_OBF,headers={'Content-Type':'application/json'},json=credentials.dict())
            # data={"cuid": cuid,'password': password})#'mac_address':mac_address})

    # print(success.ok,success.status_code,success.reason,success.content)
    success=True

    if not success:
        _login_attempts[cuid].append(time.time())
        _failed_counts[cuid] += 1

        # Log failed attempt
        db.add(models.LoginLog(
            cuid=cuid,
            action="login",
            statut="echec",
            tentatives=_failed_counts[cuid],
            adresse_ip=client_ip,
            adresse_mac=mac_address,
        ))
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects ou accès refusé."
        )

    # Reset failed count on success
    _failed_counts[cuid] = 0

    # Check if CUID already submitted renseignements
    deja_soumis = db.query(models.Renseignement).filter(
        models.Renseignement.CUID == cuid
    ).first() is not None

    # Générer un token JWT pour l'utilisateur
    token = auth.create_access_token(
        data={"sub": cuid, "role": "user"},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    # Log successful login
    db.add(models.LoginLog(
        cuid=cuid,
        action="login",
        statut="success",
        tentatives=0,
        adresse_ip=client_ip,
        adresse_mac=mac_address,
    ))
    db.commit()

    return schemas.UserLoginResponse(
        success=True,
        message="Vous avez déjà soumis vos renseignements." if deja_soumis else "Identité vérifiée avec succès.",
        access_token=token,
        data={"cuid": cuid, "deja_soumis": deja_soumis},
    )


@router.get(
    "/check-soumission/{cuid}",
    summary="Vérifier si un CUID a déjà soumis des renseignements",
)
def check_soumission(cuid: str, db: Session = Depends(get_db)):
    exists = db.query(models.Renseignement).filter(
        models.Renseignement.CUID == cuid
    ).first() is not None
    return {"deja_soumis": exists}
