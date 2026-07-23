"""User registration/login/profile routes."""

from flask import Blueprint, jsonify, request

from models import USERS, User, next_id
from utils.auth import authenticate, create_session, hash_password

users_bp = Blueprint("users", __name__)


@users_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(force=True)
    user_id = next_id("user")
    user = User(
        id=user_id,
        username=data["username"],
        email=data["email"],
        password_hash=hash_password(data["password"]),
    )
    USERS[user_id] = user
    return jsonify({"id": user.id, "username": user.username}), 201


@users_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    user_id = authenticate(data.get("username", ""), data.get("password", ""))
    if user_id is None:
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_session(user_id)
    return jsonify({"session_token": token})


@users_bp.route("/profile/<int:user_id>")
def profile(user_id):
    user = USERS.get(user_id)
    if user is None:
        return jsonify({"error": "User not found"}), 404

    # VULNERABILITY 1: reflected XSS (OWASP A03 - Injection) -- the username is
    # interpolated directly into an HTML response with no escaping.
    html = f"<h1>Welcome, {user.username}!</h1><p>Email: {user.email}</p>"
    return html, 200, {"Content-Type": "text/html"}
