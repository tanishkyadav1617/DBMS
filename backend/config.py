import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

# ── Server Execution ────────────────────────────────────────────────────────
FLASK_ENV   = os.getenv('FLASK_ENV', 'development')
FLASK_HOST  = os.getenv('FLASK_HOST', '0.0.0.0')
FLASK_PORT  = int(os.getenv('FLASK_PORT', 8000))
FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'false').lower() in ('true', '1', 't')

# ── Database Connection ─────────────────────────────────────────────────────
# Primary DB_* keys with fallback to legacy MYSQL_* keys for full backwards compatibility
DB_HOST     = os.getenv('DB_HOST') or os.getenv('MYSQL_HOST', 'localhost')
DB_PORT     = int(os.getenv('DB_PORT') or os.getenv('MYSQL_PORT', 3306))
DB_NAME     = os.getenv('DB_NAME') or os.getenv('MYSQL_DATABASE', 'inventory_db')
DB_USER     = os.getenv('DB_USER') or os.getenv('MYSQL_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD') if os.getenv('DB_PASSWORD') is not None else os.getenv('MYSQL_PASSWORD', '')
DB_POOL_SIZE = int(os.getenv('DB_POOL_SIZE', 10))

# Legacy aliases used in older modules
MYSQL_HOST     = DB_HOST
MYSQL_PORT     = DB_PORT
MYSQL_DATABASE = DB_NAME
MYSQL_USER     = DB_USER
MYSQL_PASSWORD = DB_PASSWORD

# ── Security & CORS ─────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS_RAW = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000,https://dbms-plum.vercel.app')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_RAW.split(',') if origin.strip()]

JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY') or os.getenv('SECRET_KEY', 'dev-secret-change-me')
SECRET_KEY     = JWT_SECRET_KEY

_jwt_expires_raw = os.getenv('JWT_ACCESS_TOKEN_EXPIRES_MINUTES', '0')
try:
    _jwt_expires_min = int(_jwt_expires_raw)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=_jwt_expires_min) if _jwt_expires_min > 0 else False
except (ValueError, TypeError):
    JWT_ACCESS_TOKEN_EXPIRES = False

# ── Domain & Business Logic Rules (RBAC) ────────────────────────────────────
MANAGER_EMAIL_DOMAIN  = os.getenv('MANAGER_EMAIL_DOMAIN', 'manager.com').strip().lstrip('@')
CUSTOMER_EMAIL_DOMAIN = os.getenv('CUSTOMER_EMAIL_DOMAIN', 'customer.com').strip().lstrip('@')
DELIVERY_EMAIL_DOMAIN = os.getenv('DELIVERY_EMAIL_DOMAIN', 'delpart.com').strip().lstrip('@')

DOMAIN_ROLE_MAP = {
    MANAGER_EMAIL_DOMAIN:  'Manager',
    CUSTOMER_EMAIL_DOMAIN: 'Customer',
    DELIVERY_EMAIL_DOMAIN: 'Delivery Partner',
}

ROLE_DOMAIN_MAP = {
    'Customer':          f'@{CUSTOMER_EMAIL_DOMAIN}',
    'Customers':         f'@{CUSTOMER_EMAIL_DOMAIN}',
    'Delivery Partner':  f'@{DELIVERY_EMAIL_DOMAIN}',
    'Delivery Partners': f'@{DELIVERY_EMAIL_DOMAIN}',
    'Manager':           f'@{MANAGER_EMAIL_DOMAIN}',
    'Managers':          f'@{MANAGER_EMAIL_DOMAIN}',
}

# ── Delivery Performance Index (DPI) Constants ──────────────────────────────
DPI_WEIGHT_SUCCESSFUL = float(os.getenv('DPI_WEIGHT_SUCCESSFUL', 10.0))
DPI_WEIGHT_FAILED     = float(os.getenv('DPI_WEIGHT_FAILED', 5.0))
DPI_WEIGHT_DISTANCE   = float(os.getenv('DPI_WEIGHT_DISTANCE', 1.0))

# ── Order Limits & Thresholds ───────────────────────────────────────────────
MIN_ORDER_DISTANCE_KM = float(os.getenv('MIN_ORDER_DISTANCE_KM', 0.1))
MIN_ETA_MINUTES       = int(os.getenv('MIN_ETA_MINUTES', 1))
