from flask import Blueprint, jsonify
from db import get_connection
from middleware import role_required
from config import (
    DPI_WEIGHT_SUCCESSFUL,
    DPI_WEIGHT_FAILED,
    DPI_WEIGHT_DISTANCE,
    DELIVERY_EMAIL_DOMAIN,
)

manager_bp = Blueprint('manager', __name__)


def _serialize(rows):
    out = []
    for row in rows:
        r = {}
        for k, v in row.items():
            if hasattr(v, 'isoformat'):
                r[k] = v.isoformat()
            elif hasattr(v, '__float__'):
                r[k] = float(v)
            else:
                r[k] = v
        out.append(r)
    return out


# ── GET /api/manager/dpi  – Delivery Performance Index leaderboard ──────────
@manager_bp.route('/api/manager/dpi', methods=['GET'])
@role_required('Manager')
def dpi_leaderboard():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    u.user_id,
                    u.full_name,
                    u.vehicle_type,
                    COUNT(CASE WHEN o.status = 'Delivered'     THEN 1 END)  AS successful,
                    COUNT(CASE WHEN o.status = 'Not Delivered' THEN 1 END)  AS failed,
                    COALESCE(SUM(o.distance_km), 0)                         AS total_km,
                    (
                        %s * COUNT(CASE WHEN o.status = 'Delivered'     THEN 1 END)
                       - %s * COUNT(CASE WHEN o.status = 'Not Delivered' THEN 1 END)
                       + %s * COALESCE(SUM(o.distance_km), 0)
                    )                                                        AS dpi
                FROM users u
                LEFT JOIN orders o ON u.user_id = o.partner_id
                WHERE u.email LIKE %s
                GROUP BY u.user_id, u.full_name, u.vehicle_type
                ORDER BY dpi DESC
                """,
                (
                    DPI_WEIGHT_SUCCESSFUL,
                    DPI_WEIGHT_FAILED,
                    DPI_WEIGHT_DISTANCE,
                    f'%@{DELIVERY_EMAIL_DOMAIN}',
                )
            )
            rows = cur.fetchall()
        return jsonify(_serialize(rows)), 200
    finally:
        conn.close()
