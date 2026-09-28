from flask import Blueprint, request, jsonify
from db import get_connection
from middleware import role_required
from config import MANAGER_EMAIL_DOMAIN, DELIVERY_EMAIL_DOMAIN

users_bp = Blueprint('users', __name__)


# ── GET /api/users  (Manager) ───────────────────────────────────────────────
@users_bp.route('/api/users', methods=['GET'])
@role_required('Manager')
def get_users():
    role = request.args.get('role', '').strip()

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if role in ('Customer', 'Customers'):
                cur.execute(
                    '''SELECT user_id, full_name, email, phone, account_status, vehicle_type
                       FROM users
                       WHERE email NOT LIKE %s AND email NOT LIKE %s
                       ORDER BY user_id''',
                    (f'%@{MANAGER_EMAIL_DOMAIN}', f'%@{DELIVERY_EMAIL_DOMAIN}')
                )
            elif role in ('Manager', 'Managers'):
                cur.execute(
                    '''SELECT user_id, full_name, email, phone, account_status, vehicle_type
                       FROM users
                       WHERE email LIKE %s
                       ORDER BY user_id''',
                    (f'%@{MANAGER_EMAIL_DOMAIN}',)
                )
            elif role in ('Delivery Partner', 'Delivery Partners'):
                cur.execute(
                    '''SELECT user_id, full_name, email, phone, account_status, vehicle_type
                       FROM users
                       WHERE email LIKE %s
                       ORDER BY user_id''',
                    (f'%@{DELIVERY_EMAIL_DOMAIN}',)
                )
            else:
                cur.execute(
                    '''SELECT user_id, full_name, email, phone, account_status, vehicle_type
                       FROM users ORDER BY user_id'''
                )
            users = cur.fetchall()
        return jsonify(users), 200
    finally:
        conn.close()


# ── PUT /api/users/<id>/suspend  – Toggle Active / Suspended ────────────────
@users_bp.route('/api/users/<int:user_id>/suspend', methods=['PUT'])
@role_required('Manager')
def toggle_suspend(user_id):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT account_status FROM users WHERE user_id = %s', (user_id,))
            user = cur.fetchone()
            if not user:
                return jsonify({'error': 'User not found.'}), 404
            new_status = 'Active' if user['account_status'] == 'Suspended' else 'Suspended'
            cur.execute(
                'UPDATE users SET account_status = %s WHERE user_id = %s',
                (new_status, user_id)
            )
        conn.commit()
        return jsonify({'message': f'User status updated to {new_status}.', 'account_status': new_status}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ── GET /api/delivery-partners  (Manager – for dispatch dropdown) ───────────
@users_bp.route('/api/delivery-partners', methods=['GET'])
@role_required('Manager')
def get_delivery_partners():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT user_id, full_name, email, phone, vehicle_type
                   FROM users
                   WHERE email LIKE %s
                     AND account_status = 'Active'
                   ORDER BY full_name''',
                (f'%@{DELIVERY_EMAIL_DOMAIN}',)
            )
            partners = cur.fetchall()
        return jsonify(partners), 200
    finally:
        conn.close()
