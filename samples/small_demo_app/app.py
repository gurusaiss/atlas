"""SmallDemoApp — a minimal Flask service used for Atlas's live interview demo.

Intentionally contains three planted vulnerabilities (SQL injection, hardcoded
API key, command injection) so the Security Agent has real findings to report
in under 3 minutes on free-tier LLM rate limits.
"""

import os
import sqlite3
import subprocess

from flask import Flask, jsonify, request

app = Flask(__name__)

# --- VULNERABILITY 2: hardcoded API key (OWASP A02 - Cryptographic Failures) ---
API_KEY = "sk-prod-12345abc"

DB_PATH = "demo.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, email TEXT)"
    )
    conn.execute("INSERT OR IGNORE INTO users (id, username, email) VALUES (1, 'admin', 'admin@demo.local')")
    conn.commit()
    conn.close()


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/users/<user_id>")
def get_user(user_id):
    # --- VULNERABILITY 1: SQL injection (OWASP A03 - Injection) ---
    conn = get_db()
    query = f"SELECT * FROM users WHERE id = {user_id}"
    cursor = conn.execute(query)
    row = cursor.fetchone()
    conn.close()

    if row is None:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"id": row["id"], "username": row["username"], "email": row["email"]})


@app.route("/users", methods=["POST"])
def create_user():
    data = request.get_json(force=True)
    username = data.get("username")
    email = data.get("email")

    conn = get_db()
    conn.execute("INSERT INTO users (username, email) VALUES (?, ?)", (username, email))
    conn.commit()
    conn.close()
    return jsonify({"message": "User created"}), 201


@app.route("/ping")
def ping():
    host = request.args.get("host", "127.0.0.1")
    # --- VULNERABILITY 3: command injection (OWASP A03 - Injection) ---
    result = os.system(f"ping -n 1 {host}")
    return jsonify({"exit_code": result})


@app.route("/config")
def config():
    return jsonify({"api_key_configured": bool(API_KEY)})


def calculate_discount(price, is_member, coupon_code=None):
    """Compute a checkout discount. Used to demonstrate cyclomatic complexity."""
    discount = 0.0
    if is_member:
        discount += 0.1
    if coupon_code:
        if coupon_code == "SAVE10":
            discount += 0.1
        elif coupon_code == "SAVE20":
            discount += 0.2
        elif coupon_code == "SAVE30":
            discount += 0.3
        else:
            discount += 0.0
    if price > 100:
        discount += 0.05
    if discount > 0.5:
        discount = 0.5
    return price * (1 - discount)


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
