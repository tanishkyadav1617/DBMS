from flask import Flask
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

# ── JWT ─────────────────────────────────────────────────────────────────────
app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = JWT_ACCESS_TOKEN_EXPIRES

JWTManager(app)

# ── CORS ─────────────────────────────────────────────────────────────────────
CORS(app, origins=CORS_ALLOWED_ORIGINS, supports_credentials=True)

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
