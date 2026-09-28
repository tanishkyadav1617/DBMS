import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, make_response
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import (
    JWT_SECRET_KEY,
    JWT_ACCESS_TOKEN_EXPIRES,
    CORS_ALLOWED_ORIGINS,
    FLASK_HOST,
    FLASK_PORT,
    FLASK_DEBUG,
)
from auth import auth_bp
from routes.products import products_bp
from routes.orders import orders_bp
from routes.users import users_bp
from routes.manager import manager_bp

app = Flask(__name__)
# Prevent 301/308 redirects on trailing slash discrepancies which break CORS preflights
app.url_map.strict_slashes = False

# ── JWT ─────────────────────────────────────────────────────────────────────
app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = JWT_ACCESS_TOKEN_EXPIRES

JWTManager(app)

# ── Preflight & CORS Handlers ─────────────────────────────────────────────────
@app.before_request
def handle_preflight():
    """Immediately resolve OPTIONS preflight requests with 204 to avoid routing redirects."""
    if request.method == "OPTIONS":
        response = make_response()
        origin = request.headers.get("Origin")
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        else:
            response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = (
            request.headers.get("Access-Control-Request-Headers")
            or "Content-Type, Authorization, X-Requested-With, Accept"
        )
        response.headers["Access-Control-Max-Age"] = "86400"
        return response, 204

@app.after_request
def add_cors_headers(response):
    """Ensure all responses include standard CORS headers."""
    origin = request.headers.get("Origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept"
    return response

# Also register Flask-CORS middleware for comprehensive coverage
CORS(app,
     resources={r"/*": {"origins": "*"}},
     supports_credentials=True,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"])


# ── Blueprints ───────────────────────────────────────────────────────────────
app.register_blueprint(auth_bp)
app.register_blueprint(products_bp)
app.register_blueprint(orders_bp)
app.register_blueprint(users_bp)
app.register_blueprint(manager_bp)

# ── Auto-Migration ──────────────────────────────────────────────────────────
try:
    from migrate_db import run_migration
    run_migration()
except Exception as e:
    print(f"Startup migration notice: {e}")


if __name__ == '__main__':
    app.run(host=FLASK_HOST, port=FLASK_PORT, debug=FLASK_DEBUG)
