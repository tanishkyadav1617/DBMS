from flask import Blueprint, request, jsonify
from flask_jwt_extended import verify_jwt_in_request
from db import get_connection
from middleware import role_required

products_bp = Blueprint('products', __name__)

VALID_CATEGORIES   = ('Grocery', 'Electronics', 'Smartphones', 'Accessories', 'Wearables', 'General')
VALID_UNITS        = ('kg', 'liter', 'piece', 'box')


def _serialize(rows):
    """Convert Decimal / datetime fields so json.dumps is happy."""
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


# ── GET /api/products  (any authenticated user) ─────────────────────────────
@products_bp.route('/api/products', methods=['GET'])
def get_products():
    try:
        verify_jwt_in_request()
    except Exception:
        return jsonify({'error': 'Unauthorized'}), 401

    category = request.args.get('category', '').strip()
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if category:
                cur.execute(
                    'SELECT * FROM products WHERE category = %s ORDER BY product_name',
                    (category,)
                )
            else:
                cur.execute('SELECT * FROM products ORDER BY category, product_name')
            rows = cur.fetchall()
        return jsonify(_serialize(rows)), 200
    finally:
        conn.close()


# ── POST /api/products  (Manager only) ─────────────────────────────────────
@products_bp.route('/api/products', methods=['POST'])
@role_required('Manager')
def add_product():
    data = request.get_json() or {}
    required = ['product_name', 'category', 'selling_unit', 'price_per_unit',
                'weight_per_unit_kg', 'stock_quantity']
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({'error': f'Missing fields: {missing}'}), 400

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                '''INSERT INTO products
                   (product_name, category, selling_unit, price_per_unit, weight_per_unit_kg, stock_quantity)
                   VALUES (%s, %s, %s, %s, %s, %s)''',
                (data['product_name'], data['category'], data['selling_unit'],
                 data['price_per_unit'], data['weight_per_unit_kg'], data['stock_quantity'])
            )
            pid = cur.lastrowid
        conn.commit()
        return jsonify({'message': 'Product added.', 'product_id': pid}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ── PUT /api/products/<id>  (Manager only) ─────────────────────────────────
@products_bp.route('/api/products/<int:product_id>', methods=['PUT'])
@role_required('Manager')
def update_product(product_id):
    data = request.get_json() or {}
    allowed = ['product_name', 'category', 'selling_unit', 'price_per_unit',
               'weight_per_unit_kg', 'stock_quantity']
    fields, values = [], []
    for key in allowed:
        if key in data:
            fields.append(f'{key} = %s')
            values.append(data[key])
    if not fields:
        return jsonify({'error': 'No updatable fields provided.'}), 400

    values.append(product_id)
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f'UPDATE products SET {", ".join(fields)} WHERE product_id = %s',
                values
            )
            if cur.rowcount == 0:
                return jsonify({'error': 'Product not found.'}), 404
        conn.commit()
        return jsonify({'message': 'Product updated.'}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ── DELETE /api/products/<id>  (Manager only) ──────────────────────────────
@products_bp.route('/api/products/<int:product_id>', methods=['DELETE'])
@role_required('Manager')
def delete_product(product_id):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM products WHERE product_id = %s', (product_id,))
            if cur.rowcount == 0:
                return jsonify({'error': 'Product not found.'}), 404
        conn.commit()
        return jsonify({'message': 'Product deleted.'}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
