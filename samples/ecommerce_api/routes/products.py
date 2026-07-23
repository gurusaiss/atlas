"""Product catalog routes."""

from flask import Blueprint, jsonify, request

from models import PRODUCTS, Product, next_id

products_bp = Blueprint("products", __name__)


@products_bp.route("/products")
def list_products():
    return jsonify([p.__dict__ for p in PRODUCTS.values()])


@products_bp.route("/products/<int:product_id>")
def get_product(product_id):
    product = PRODUCTS.get(product_id)
    if product is None:
        return jsonify({"error": "Product not found"}), 404
    return jsonify(product.__dict__)


@products_bp.route("/products", methods=["POST"])
def create_product():
    data = request.get_json(force=True)
    product_id = next_id("product")
    product = Product(
        id=product_id,
        name=data["name"],
        description=data.get("description", ""),
        price=float(data["price"]),
        stock=int(data.get("stock", 0)),
    )
    PRODUCTS[product_id] = product
    return jsonify(product.__dict__), 201
