import os
import sys
import json
from urllib.parse import quote as url_quote
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, make_response, g
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import (
    JWT_SECRET_KEY,
    JWT_ACCESS_TOKEN_EXPIRES,
    CORS_ALLOWED_ORIGINS,
    FLASK_HOST,
    FLASK_PORT,
    FLASK_DEBUG,
    SHOW_SQL_QUERIES,
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

# ── Preflight Handler (OPTIONS → 204 immediately) ─────────────────────────────
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
def after_request_hook(response):
    """1) Inject X-Executed-Queries header when SHOW_SQL_QUERIES is enabled.
       2) Ensure every response carries the required CORS headers."""

    # ── SQL Telemetry Header ─────────────────────────────────────────────────
    if SHOW_SQL_QUERIES:
        queries = getattr(g, 'sql_queries', [])
        if queries:
            try:
                serialized = json.dumps(queries, default=str, ensure_ascii=False)
                response.headers['X-Executed-Queries'] = url_quote(serialized)
            except Exception:
                pass  # Never let telemetry crash a real response

    # ── CORS Headers ─────────────────────────────────────────────────────────
    origin = request.headers.get("Origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept"
    response.headers["Access-Control-Expose-Headers"] = "X-Executed-Queries"
    return response


# ── Flask-CORS (belt-and-suspenders for edge cases) ───────────────────────────
CORS(app,
     resources={r"/*": {"origins": "*"}},
     supports_credentials=True,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
     expose_headers=["X-Executed-Queries"])



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
