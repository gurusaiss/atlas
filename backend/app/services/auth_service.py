"""Registration, login, JWT issuance, and refresh-token rotation."""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import RefreshToken, User

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "email": user.email,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "type": "access",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise AuthError("Invalid or expired token") from exc
    if payload.get("type") != "access":
        raise AuthError("Invalid token type")
    return payload


async def register_user(db: AsyncSession, email: str, password: str, full_name: str | None) -> User:
    existing = await db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise AuthError("An account with this email already exists", status_code=409)

    user = User(email=email, hashed_password=hash_password(password), full_name=full_name)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _issue_refresh_token(db: AsyncSession, user: User) -> str:
    raw_token = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    record = RefreshToken(user_id=user.id, token_hash=_hash_token(raw_token), expires_at=expires_at)
    db.add(record)
    await db.commit()
    return raw_token


async def authenticate_user(db: AsyncSession, email: str, password: str) -> tuple[User, str, str]:
    user = await db.scalar(select(User).where(User.email == email))
    if user is None:
        raise AuthError("Invalid email or password")

    now = datetime.now(timezone.utc)
    if user.locked_until is not None and user.locked_until > now:
        remaining = int((user.locked_until - now).total_seconds() // 60) + 1
        raise AuthError(f"Account locked. Try again in {remaining} minute(s).", status_code=423)

    if not user.is_active:
        raise AuthError("Account is disabled", status_code=403)

    if not verify_password(password, user.hashed_password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            user.failed_login_attempts = 0
        await db.commit()
        raise AuthError("Invalid email or password")

    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    access_token = create_access_token(user)
    refresh_token = await _issue_refresh_token(db, user)
    return user, access_token, refresh_token


async def rotate_refresh_token(db: AsyncSession, raw_refresh_token: str) -> tuple[User, str, str]:
    token_hash = _hash_token(raw_refresh_token)
    record = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))

    now = datetime.now(timezone.utc)
    if record is None or record.is_revoked or record.expires_at < now:
        raise AuthError("Invalid or expired refresh token")

    user = await db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise AuthError("Invalid or expired refresh token")

    record.is_revoked = True
    await db.commit()

    access_token = create_access_token(user)
    new_refresh_token = await _issue_refresh_token(db, user)
    return user, access_token, new_refresh_token


async def revoke_refresh_token(db: AsyncSession, raw_refresh_token: str) -> None:
    token_hash = _hash_token(raw_refresh_token)
    record = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if record is not None:
        record.is_revoked = True
        await db.commit()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)
