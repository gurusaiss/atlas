"""Auth endpoint tests: register, login, lockout, refresh, logout.

Requires a real Postgres (DATABASE_URL) -- see conftest.py. Not runnable
without a live DB; CI provides one as a service container.
"""


async def test_register_creates_user(client):
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "alice@example.com", "password": "supersecret1", "full_name": "Alice"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "alice@example.com"


async def test_register_rejects_duplicate_email(client):
    payload = {"email": "bob@example.com", "password": "supersecret1"}
    first = await client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201

    second = await client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409


async def test_register_rejects_short_password(client):
    resp = await client.post(
        "/api/v1/auth/register", json={"email": "short@example.com", "password": "abc"}
    )
    assert resp.status_code == 422


async def test_login_succeeds_with_correct_credentials(client):
    await client.post(
        "/api/v1/auth/register", json={"email": "carol@example.com", "password": "correct-horse-1"}
    )
    resp = await client.post(
        "/api/v1/auth/login", json={"email": "carol@example.com", "password": "correct-horse-1"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


async def test_login_fails_with_wrong_password(client):
    await client.post("/api/v1/auth/register", json={"email": "dave@example.com", "password": "realpassword1"})
    resp = await client.post("/api/v1/auth/login", json={"email": "dave@example.com", "password": "wrongpassword"})
    assert resp.status_code == 401


async def test_account_locks_after_five_failed_attempts(client):
    await client.post("/api/v1/auth/register", json={"email": "eve@example.com", "password": "realpassword1"})

    for _ in range(5):
        resp = await client.post("/api/v1/auth/login", json={"email": "eve@example.com", "password": "wrong"})
        assert resp.status_code == 401

    # 6th attempt (even with the CORRECT password) should be locked out now.
    locked_resp = await client.post(
        "/api/v1/auth/login", json={"email": "eve@example.com", "password": "realpassword1"}
    )
    assert locked_resp.status_code == 423


async def test_me_requires_authentication(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_me_returns_current_user(client):
    await client.post("/api/v1/auth/register", json={"email": "frank@example.com", "password": "realpassword1"})
    login_resp = await client.post(
        "/api/v1/auth/login", json={"email": "frank@example.com", "password": "realpassword1"}
    )
    access_token = login_resp.json()["access_token"]

    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "frank@example.com"


async def test_refresh_rotates_token(client):
    await client.post("/api/v1/auth/register", json={"email": "grace@example.com", "password": "realpassword1"})
    login_resp = await client.post(
        "/api/v1/auth/login", json={"email": "grace@example.com", "password": "realpassword1"}
    )
    refresh_cookie = login_resp.cookies.get("refresh_token")
    assert refresh_cookie is not None

    refresh_resp = await client.post("/api/v1/auth/refresh", cookies={"refresh_token": refresh_cookie})
    assert refresh_resp.status_code == 200

    # The old refresh token must now be revoked (rotation) -- reusing it fails.
    reuse_resp = await client.post("/api/v1/auth/refresh", cookies={"refresh_token": refresh_cookie})
    assert reuse_resp.status_code == 401


async def test_logout_revokes_refresh_token(client):
    await client.post("/api/v1/auth/register", json={"email": "henry@example.com", "password": "realpassword1"})
    login_resp = await client.post(
        "/api/v1/auth/login", json={"email": "henry@example.com", "password": "realpassword1"}
    )
    refresh_cookie = login_resp.cookies.get("refresh_token")

    logout_resp = await client.post("/api/v1/auth/logout", cookies={"refresh_token": refresh_cookie})
    assert logout_resp.status_code == 200

    reuse_resp = await client.post("/api/v1/auth/refresh", cookies={"refresh_token": refresh_cookie})
    assert reuse_resp.status_code == 401
