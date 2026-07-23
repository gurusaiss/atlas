"""EcommerceAPI -- Flask sample repository used as a second Atlas demo target.

Deliberately structured as a small monolith (users/products/orders all in one
Flask app) so the Decomposition Agent has real bounded-context seams to find.
"""

from flask import Flask

from routes.orders import orders_bp
from routes.products import products_bp
from routes.users import users_bp

app = Flask(__name__)

# VULNERABILITY 4: debug mode enabled (OWASP A05 - Security Misconfiguration).
# Flask's debug mode exposes the Werkzeug interactive debugger, which allows
# arbitrary code execution if reached in a deployed environment.
app.config["DEBUG"] = True

app.register_blueprint(users_bp)
app.register_blueprint(products_bp)
app.register_blueprint(orders_bp)


@app.route("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
