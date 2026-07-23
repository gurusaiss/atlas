"""Order placement and lookup routes."""

from flask import Blueprint, jsonify, request

from models import ORDERS, PRODUCTS, Order, next_id

orders_bp = Blueprint("orders", __name__)


@orders_bp.route("/orders", methods=["POST"])
def create_order():
    data = request.get_json(force=True)
    product = PRODUCTS.get(data["product_id"])
    if product is None:
        return jsonify({"error": "Product not found"}), 404
    if product.stock < data["quantity"]:
        return jsonify({"error": "Insufficient stock"}), 400

    order_id = next_id("order")
    order = Order(id=order_id, user_id=data["user_id"], product_id=product.id, quantity=data["quantity"])
    ORDERS[order_id] = order
    product.stock -= data["quantity"]
    return jsonify(order.__dict__), 201


@orders_bp.route("/orders/<int:order_id>")
def get_order(order_id):
    # VULNERABILITY 2: insecure direct object reference (OWASP A01 - Broken Access
    # Control) -- any authenticated (or unauthenticated) caller can fetch any order
    # by ID, with no check that the requester is the order's own user_id.
    order = ORDERS.get(order_id)
    if order is None:
        return jsonify({"error": "Order not found"}), 404
    return jsonify(order.__dict__)
