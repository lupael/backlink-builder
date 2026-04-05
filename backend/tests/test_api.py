"""
Backend tests for Backlink Builder API.
"""
import pytest
import json
from app import app, db, User, BacklinkOpportunity, BacklinkSubmission


@pytest.fixture
def client():
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["JWT_SECRET_KEY"] = "test-secret"
    with app.app_context():
        db.create_all()
        yield app.test_client()
        db.session.remove()
        db.drop_all()


def _register_and_login(client, email="admin@test.io", password="TestPass123!"):
    """Helper: register a user and return the access token."""
    res = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "name": "Test Admin",
    })
    assert res.status_code in (200, 201)
    data = json.loads(res.data)
    return data["access_token"], data["user"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ── Health ────────────────────────────────────────────────────────────────

def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["status"] == "ok"


# ── Auth ──────────────────────────────────────────────────────────────────

def test_register_first_user_is_admin(client):
    token, user = _register_and_login(client)
    assert user["role"] == "admin"
    assert token is not None


def test_register_second_user_is_viewer(client):
    _register_and_login(client)
    res = client.post("/api/auth/register", json={
        "email": "viewer@test.io",
        "password": "ViewerPass!1",
        "name": "Viewer",
    })
    assert res.status_code == 201
    data = json.loads(res.data)
    assert data["user"]["role"] == "viewer"


def test_login_invalid_credentials(client):
    _register_and_login(client)
    res = client.post("/api/auth/login", json={
        "email": "admin@test.io",
        "password": "wrongpassword",
    })
    assert res.status_code == 401


def test_login_success(client):
    _register_and_login(client)
    res = client.post("/api/auth/login", json={
        "email": "admin@test.io",
        "password": "TestPass123!",
    })
    assert res.status_code == 200
    data = json.loads(res.data)
    assert "access_token" in data
    assert data["user"]["email"] == "admin@test.io"


def test_me_requires_auth(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_me_returns_user(client):
    token, _ = _register_and_login(client)
    res = client.get("/api/auth/me", headers=_auth_headers(token))
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["user"]["email"] == "admin@test.io"


def test_register_duplicate_email(client):
    _register_and_login(client)
    res = client.post("/api/auth/register", json={
        "email": "admin@test.io",
        "password": "AnotherPass!1",
        "name": "Duplicate",
    })
    assert res.status_code == 409


# ── Opportunities ─────────────────────────────────────────────────────────

def test_list_opportunities_requires_auth(client):
    res = client.get("/api/opportunities")
    assert res.status_code == 401


def test_create_opportunity(client):
    token, _ = _register_and_login(client)
    res = client.post("/api/opportunities", json={
        "name": "Test Directory",
        "url": "https://testdirectory.com",
        "category": "directory",
        "domain_authority": 55,
        "spam_score": 3,
    }, headers=_auth_headers(token))
    assert res.status_code == 201
    data = json.loads(res.data)
    assert data["opportunity"]["name"] == "Test Directory"
    assert data["opportunity"]["domain_authority"] == 55


def test_list_opportunities(client):
    token, _ = _register_and_login(client)
    client.post("/api/opportunities", json={
        "name": "Dir A", "url": "https://dira.com", "category": "directory",
        "domain_authority": 60, "spam_score": 2,
    }, headers=_auth_headers(token))
    res = client.get("/api/opportunities", headers=_auth_headers(token))
    assert res.status_code == 200
    data = json.loads(res.data)
    assert len(data["opportunities"]) == 1


def test_filter_opportunities_by_category(client):
    token, _ = _register_and_login(client)
    for cat in ["directory", "blog", "forum"]:
        client.post("/api/opportunities", json={
            "name": f"{cat} site", "url": f"https://{cat}.com",
            "category": cat, "domain_authority": 40, "spam_score": 2,
        }, headers=_auth_headers(token))
    res = client.get("/api/opportunities?category=blog", headers=_auth_headers(token))
    data = json.loads(res.data)
    assert len(data["opportunities"]) == 1
    assert data["opportunities"][0]["category"] == "blog"


# ── Submissions ───────────────────────────────────────────────────────────

def test_create_submission(client):
    token, _ = _register_and_login(client)
    res = client.post("/api/submissions", json={
        "target_url": "https://mysite.com",
        "anchor_text": "My Site",
    }, headers=_auth_headers(token))
    assert res.status_code == 201
    data = json.loads(res.data)
    assert data["submission"]["status"] == "pending"
    assert data["submission"]["target_url"] == "https://mysite.com"


def test_list_submissions(client):
    token, _ = _register_and_login(client)
    client.post("/api/submissions", json={"target_url": "https://mysite.com"},
                headers=_auth_headers(token))
    res = client.get("/api/submissions", headers=_auth_headers(token))
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["total"] == 1


def test_update_submission_status(client):
    token, _ = _register_and_login(client)
    res = client.post("/api/submissions", json={"target_url": "https://mysite.com"},
                      headers=_auth_headers(token))
    sub_id = json.loads(res.data)["submission"]["id"]
    res = client.patch(f"/api/submissions/{sub_id}", json={"status": "submitted"},
                       headers=_auth_headers(token))
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["submission"]["status"] == "submitted"


def test_retry_submission(client):
    token, _ = _register_and_login(client)
    res = client.post("/api/submissions", json={"target_url": "https://mysite.com"},
                      headers=_auth_headers(token))
    sub_id = json.loads(res.data)["submission"]["id"]
    # Set to failed first
    client.patch(f"/api/submissions/{sub_id}", json={"status": "failed"},
                 headers=_auth_headers(token))
    # Retry
    res = client.post(f"/api/submissions/{sub_id}/retry", headers=_auth_headers(token))
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["submission"]["status"] == "pending"
    assert data["submission"]["retry_count"] == 1


# ── Bulk submit ───────────────────────────────────────────────────────────

def test_bulk_submit(client):
    token, _ = _register_and_login(client)
    # Create a qualifying opportunity
    client.post("/api/opportunities", json={
        "name": "Good Dir", "url": "https://gooddir.com", "category": "directory",
        "domain_authority": 50, "spam_score": 3,
    }, headers=_auth_headers(token))
    res = client.post("/api/submit", json={
        "target_url": "https://newsite.com",
        "anchor_text": "New Site",
        "min_da": 20,
        "max_spam": 10,
    }, headers=_auth_headers(token))
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["queued"] == 1


def test_bulk_submit_no_duplicates(client):
    token, _ = _register_and_login(client)
    client.post("/api/opportunities", json={
        "name": "Good Dir", "url": "https://gooddir.com", "category": "directory",
        "domain_authority": 50, "spam_score": 3,
    }, headers=_auth_headers(token))
    # Submit twice
    client.post("/api/submit", json={"target_url": "https://newsite.com", "min_da": 20, "max_spam": 10},
                headers=_auth_headers(token))
    res = client.post("/api/submit", json={"target_url": "https://newsite.com", "min_da": 20, "max_spam": 10},
                      headers=_auth_headers(token))
    data = json.loads(res.data)
    assert data["queued"] == 0  # No duplicates


# ── Dashboard ─────────────────────────────────────────────────────────────

def test_dashboard(client):
    token, _ = _register_and_login(client)
    res = client.get("/api/dashboard", headers=_auth_headers(token))
    assert res.status_code == 200
    data = json.loads(res.data)
    assert "total_submissions" in data
    assert "success_rate" in data
    assert "daily_submissions" in data


# ── Reports ───────────────────────────────────────────────────────────────

def test_export_csv(client):
    token, _ = _register_and_login(client)
    client.post("/api/submissions", json={"target_url": "https://mysite.com"},
                headers=_auth_headers(token))
    res = client.get("/api/reports/export?format=csv", headers=_auth_headers(token))
    assert res.status_code == 200
    assert "text/csv" in res.content_type


def test_export_json(client):
    token, _ = _register_and_login(client)
    client.post("/api/submissions", json={"target_url": "https://mysite.com"},
                headers=_auth_headers(token))
    res = client.get("/api/reports/export?format=json", headers=_auth_headers(token))
    assert res.status_code == 200
    data = json.loads(res.data)
    assert "submissions" in data
    assert "exported_at" in data


# ── RBAC ─────────────────────────────────────────────────────────────────

def test_viewer_cannot_create_opportunity(client):
    # Register admin (first user)
    _register_and_login(client)
    # Register viewer
    res = client.post("/api/auth/register", json={
        "email": "viewer@test.io", "password": "ViewerPass!1", "name": "Viewer",
    })
    viewer_token = json.loads(res.data)["access_token"]
    res = client.post("/api/opportunities", json={
        "name": "Test Dir", "url": "https://test.com",
    }, headers=_auth_headers(viewer_token))
    assert res.status_code == 403


def test_viewer_cannot_list_users(client):
    _register_and_login(client)
    res = client.post("/api/auth/register", json={
        "email": "v2@test.io", "password": "ViewerPass!1", "name": "V2",
    })
    viewer_token = json.loads(res.data)["access_token"]
    res = client.get("/api/users", headers=_auth_headers(viewer_token))
    assert res.status_code == 403
