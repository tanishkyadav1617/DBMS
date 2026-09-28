from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token
from db import get_connection
from config import (
    DOMAIN_ROLE_MAP,
    MANAGER_EMAIL_DOMAIN,
    CUSTOMER_EMAIL_DOMAIN,
    DELIVERY_EMAIL_DOMAIN,
)

auth_bp = Blueprint('auth', __name__)

VALID_VEHICLE_TYPES = ('Two-Wheeler', 'Van', 'Truck')


def get_role(email: str):
    try:
        parts = email.split('@')
        if len(parts) < 2 or not parts[1]:
            return None
        domain = parts[1].strip().lower()
        if domain == MANAGER_EMAIL_DOMAIN:
            return 'Manager'
        elif domain == DELIVERY_EMAIL_DOMAIN:
            return 'Delivery Partner'
        else:
            return 'Customer'
    except Exception:
        return None


# ── Register ────────────────────────────────────────────────────────────────
@auth_bp.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    full_name    = data.get('full_name', '').strip()
    email        = data.get('email', '').strip().lower()
    password     = data.get('password', '')
    phone        = data.get('phone', '').strip()
    vehicle_type = data.get('vehicle_type', None)

    if not all([full_name, email, password, phone]):
        return jsonify({'error': 'full_name, email, password, and phone are required.'}), 400

    role = get_role(email)
    if not role:
        return jsonify({'error': 'Please provide a valid email address.'}), 400

    if role == 'Delivery Partner':
        if not vehicle_type or vehicle_type not in VALID_VEHICLE_TYPES:
            return jsonify({'error': f'vehicle_type is required for delivery partners. Choose: {VALID_VEHICLE_TYPES}'}), 400
    else:
        vehicle_type = None  # Non-partners never get a vehicle

    hashed_pw = generate_password_hash(password, method='pbkdf2:sha256')

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT user_id FROM users WHERE email = %s', (email,))
            if cur.fetchone():
                return jsonify({'error': 'Email already registered.'}), 409
            cur.execute(
                '''INSERT INTO users (full_name, email, password, phone, vehicle_type)
                   VALUES (%s, %s, %s, %s, %s)''',
                (full_name, email, hashed_pw, phone, vehicle_type)
            )
        conn.commit()
        return jsonify({'message': 'Registration successful. You can now log in.'}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ── Login ───────────────────────────────────────────────────────────────────
@auth_bp.route('/api/login', methods=['POST'])
def login():
    data     = request.get_json() or {}
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT * FROM users WHERE email = %s', (email,))
            user = cur.fetchone()
    finally:
        conn.close()

    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    if user['account_status'] == 'Suspended':
        return jsonify({'error': 'Your account has been suspended. Please contact the manager.'}), 403

    role = get_role(email)
    token = create_access_token(
        identity=str(user['user_id']),
        additional_claims={
            'role':      role,
            'email':     user['email'],
            'full_name': user['full_name'],
        }
    )

    return jsonify({
        'token':        token,
        'user_id':      user['user_id'],
        'full_name':    user['full_name'],
        'email':        user['email'],
        'role':         role,
        'vehicle_type': user.get('vehicle_type'),
    }), 200
