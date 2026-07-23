"""Integration test: register -> create project -> add repository -> create job
-> verify findings/ownership enforcement. Celery's .delay() is mocked so this
test never actually dispatches a worker task or touches the LLM pipeline.

Requires a real Postgres (DATABASE_URL) -- see conftest.py.
"""

from unittest.mock import MagicMock, patch


async def _register_and_login(client, email: str, password: str = "realpassword1") -> str:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    login_resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return login_resp.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_full_project_repository_job_flow(client, db_session):
    token = await _register_and_login(client, "owner@example.com")
    headers = _auth_headers(token)

    project_resp = await client.post("/api/v1/projects", json={"name": "Atlas Demo"}, headers=headers)
    assert project_resp.status_code == 201
    project_id = project_resp.json()["id"]

    with patch("app.routers.jobs.run_full_analysis") as mock_task:
        mock_task.delay = MagicMock(return_value=MagicMock(id="fake-celery-task-id"))

        # Directly insert a "ready" repository via the DB session rather than a real
        # upload, to isolate this test from ZIP handling (covered separately).
        from app.models.repository import Repository

        repo = Repository(project_id=project_id, name="demo-repo", status="ready", upload_path="/tmp/demo")
        db_session.add(repo)
        await db_session.commit()
        await db_session.refresh(repo)

        job_resp = await client.post("/api/v1/jobs", json={"repository_id": str(repo.id)}, headers=headers)
        assert job_resp.status_code == 201
        job_body = job_resp.json()
        assert job_body["status"] == "queued"
        mock_task.delay.assert_called_once()

    list_resp = await client.get("/api/v1/jobs", headers=headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1


async def test_user_cannot_access_another_users_project(client):
    token_a = await _register_and_login(client, "usera@example.com")
    token_b = await _register_and_login(client, "userb@example.com")

    project_resp = await client.post(
        "/api/v1/projects", json={"name": "Private Project"}, headers=_auth_headers(token_a)
    )
    project_id = project_resp.json()["id"]

    forbidden_resp = await client.get(f"/api/v1/projects/{project_id}", headers=_auth_headers(token_b))
    assert forbidden_resp.status_code == 403


async def test_project_not_found_returns_404(client):
    token = await _register_and_login(client, "nofound@example.com")
    resp = await client.get(
        "/api/v1/projects/00000000-0000-0000-0000-000000000000", headers=_auth_headers(token)
    )
    assert resp.status_code == 404


async def test_demo_endpoints_require_no_auth(client):
    resp = await client.get("/api/v1/demo/status")
    assert resp.status_code == 200
    assert "loaded" in resp.json()


async def test_health_check(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
