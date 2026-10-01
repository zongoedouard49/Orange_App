from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, func
from database import Base


class Admin(Base):
    __tablename__ = "users"

    id       = Column(Integer, primary_key=True, index=True, autoincrement=True)
    cuid     = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    actif    = Column(Boolean, nullable=False, default=False, server_default="0")
    created_at = Column(DateTime, default=func.now())


class Renseignement(Base):
    __tablename__ = "renseignements"

    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    CUID        = Column(String(50),  index=True, nullable=False)
    Nom         = Column(String(100), nullable=False)
    prenom      = Column(String(100), nullable=False)
    statut      = Column(String(50),  nullable=False)
    entreprise_partenaire = Column(String(100), nullable=True)
    direction   = Column(String(100), nullable=False)
    poste       = Column(String(100), nullable=True)
    referent    = Column(String(100), nullable=True)
    plateforme  = Column(String(200), nullable=True)
    description = Column(String(500), nullable=False)
    created_at  = Column(DateTime, default=func.now())


class RenseignementLog(Base):
    __tablename__ = "renseignement_logs"

    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    cuid        = Column(String(100), nullable=False, index=True)
    adresse_ip  = Column(String(45), nullable=True)
    adresse_mac = Column(String(50), nullable=True)
    date_creation = Column(DateTime, default=func.now())


class LoginLog(Base):
    __tablename__ = "login_logs"

    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    cuid        = Column(String(100), nullable=False, index=True)
    action      = Column(String(50), nullable=False, default="login")
    statut      = Column(String(20), nullable=False, default="success")
    tentatives  = Column(Integer, nullable=False, default=0)
    adresse_ip  = Column(String(45), nullable=True)
    adresse_mac = Column(String(50), nullable=True)
    date_creation = Column(DateTime, default=func.now())


class BlockedAccount(Base):
    __tablename__ = "blocked_accounts"

    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    cuid        = Column(String(100), nullable=False, index=True)
    nom         = Column(String(100), nullable=True)
    prenom      = Column(String(100), nullable=True)
    direction   = Column(String(100), nullable=True)
    statut      = Column(String(50), nullable=True)
    entreprise_partenaire = Column(String(100), nullable=True)
    plateformes = Column(Text, nullable=True)  # JSON: liste des plateformes sélectionnées (avec description si fournie)
    raison      = Column(String(200), nullable=False, default="Description de plateforme non renseignée après 3 tentatives")
    created_at  = Column(DateTime, default=func.now())


class BlockedIP(Base):
    __tablename__ = "blocked_ips"

    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    adresse_ip  = Column(String(45), nullable=False, index=True)
    cuid        = Column(String(100), nullable=True)
    adresse_mac = Column(String(50), nullable=True)
    raison      = Column(String(200), nullable=False, default="rate_limit")
    date_creation = Column(DateTime, default=func.now())
