from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.auth import LoginRequest, RegisterRequest, RegisterResponse, TokenResponse, UserResponse
from app.services import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
settings = get_settings()

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_MAX_AGE = settings.refresh_token_expire_days * 24 * 60 * 60


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.app_env != "development",
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/api/v1/auth",
    )


@router.post("/register", response_model=RegisterResponse, status_code=201)
@limiter.limit("10/minute")
async def register(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await auth_service.register_user(db, body.email, body.password, body.full_name)
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return RegisterResponse(user_id=user.id, email=user.email, message="Account created successfully")


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request, body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    try:
        user, access_token, refresh_token = await auth_service.authenticate_user(
            db, body.email, body.password
        )
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    _set_refresh_cookie(response, refresh_token)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
):
    if refresh_token is None:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    try:
        user, access_token, new_refresh_token = await auth_service.rotate_refresh_token(db, refresh_token)
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    _set_refresh_cookie(response, new_refresh_token)
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/logout")
async def logout(
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
):
    if refresh_token is not None:
        await auth_service.revoke_refresh_token(db, refresh_token)
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/api/v1/auth")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user
