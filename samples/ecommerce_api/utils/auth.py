"""Session/auth helpers for the EcommerceAPI demo."""

import hashlib

from models import USERS

SESSION_STORE: dict[str, int] = {}  # session_token -> user_id


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def create_session(user_id: int) -> str:
    import secrets

    token = secrets.token_hex(16)
    SESSION_STORE[token] = user_id
    return token


def get_current_user_id(session_token: str) -> int | None:
    return SESSION_STORE.get(session_token)


def authenticate(username: str, password: str) -> int | None:
    # VULNERABILITY 3: no rate limiting on login attempts (OWASP A04 - Insecure Design).
    # An attacker can brute-force credentials here with no lockout, throttle, or CAPTCHA.
    hashed = hash_password(password)
    for user in USERS.values():
        if user.username == username and user.password_hash == hashed:
            return user.id
    return None
