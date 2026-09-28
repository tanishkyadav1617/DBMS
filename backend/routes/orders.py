from collections import defaultdict
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from db import get_connection
from middleware import role_required
from config import MIN_ORDER_DISTANCE_KM, MIN_ETA_MINUTES

orders_bp = Blueprint('orders', __name__)


def _attach_order_items(cur, rows):
    """Fetch order_items for given orders and calculate aggregate weights and summaries."""
    if not rows:
        return rows
    order_ids = [r['order_id'] for r in rows if 'order_id' in r]
    if not order_ids:
        return rows

    format_strings = ','.join(['%s'] * len(order_ids))
    try:
        cur.execute(f'''
            SELECT oi.item_id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price, oi.total_price,
                   p.product_name, p.category, p.selling_unit, p.weight_per_unit_kg,
                   ROUND(oi.quantity * p.weight_per_unit_kg, 2) AS item_weight_kg
            FROM order_items oi
            JOIN products p ON oi.product_id = p.product_id
            WHERE oi.order_id IN ({format_strings})
            ORDER BY oi.item_id ASC
        ''', tuple(order_ids))
        items = cur.fetchall()
    except Exception:
        # Fallback if order_items table does not exist yet
        items = []

    items_map = defaultdict(list)
    for it in items:
        serialized_it = {}
        for k, v in it.items():
            if hasattr(v, '__float__'):
                serialized_it[k] = float(v)
            else:
                serialized_it[k] = v
        items_map[it['order_id']].append(serialized_it)

    for r in rows:
        oid = r.get('order_id')
        if oid in items_map and items_map[oid]:
            r['items'] = items_map[oid]
            r['items_count'] = len(items_map[oid])
            r['package_weight_kg'] = round(sum(float(it.get('item_weight_kg') or 0) for it in items_map[oid]), 2)
            r['product_summary'] = ', '.join(f"{it['product_name']} ({it['quantity']} {it['selling_unit']})" for it in items_map[oid])
            # If order level product_name wasn't set, pick the first
            if not r.get('product_name') and items_map[oid]:
                r['product_name'] = items_map[oid][0]['product_name']
        else:
            # Fallback for single-product legacy records
            fallback_name = r.get('product_name') or 'Product'
            fallback_unit = r.get('selling_unit') or 'unit'
            fallback_qty = float(r.get('quantity') or 1)
            fallback_weight = round(fallback_qty * float(r.get('weight_per_unit_kg') or 0), 2)
            r['items'] = [{
                'item_id': 0,
                'order_id': oid,
                'product_id': r.get('product_id'),
                'product_name': fallback_name,
                'category': r.get('category') or 'General',
                'selling_unit': fallback_unit,
                'quantity': fallback_qty,
                'unit_price': float(r.get('price_per_unit') or 0),
                'total_price': float(r.get('total_price') or 0),
                'weight_per_unit_kg': float(r.get('weight_per_unit_kg') or 0),
                'item_weight_kg': fallback_weight,
            }]
            r['items_count'] = 1
            r['package_weight_kg'] = fallback_weight
            r['product_summary'] = f"{fallback_name} ({fallback_qty} {fallback_unit})"
    return rows


def _serialize(rows):
    """Convert Decimal / datetime fields to JSON-safe types."""
    out = []
    for row in rows:
        r = {}
        for k, v in row.items():
            if k == 'items' and isinstance(v, list):
                r[k] = v
            elif hasattr(v, 'isoformat'):
                r[k] = v.isoformat()
            elif hasattr(v, '__float__'):
                r[k] = float(v)
            else:
                r[k] = v
        out.append(r)
    return out


# ════════════════════════════════════════════════════════════════════════════
#  CUSTOMER
# ════════════════════════════════════════════════════════════════════════════

@orders_bp.route('/api/place-order', methods=['POST'])
@role_required('Customer')
def place_order():
    """
    ACID transaction:
    Supports multi-item checkout payload:
      {
        "items": [
          {"product_id": 1, "quantity": 2},
          {"product_id": 5, "quantity": 1}
        ],
        "delivery_address": "...",
        "payment_mode": "..."
      }
    Or backward-compatible single item:
      {
        "product_id": 1,
        "quantity": 2,
        "delivery_address": "...",
        "payment_mode": "..."
      }
    Locks product rows in sorted primary key order to prevent deadlocks.
    """
    data             = request.get_json() or {}
    customer_id      = int(get_jwt_identity())
    delivery_address = data.get('delivery_address', '').strip()
    payment_mode     = data.get('payment_mode', '').strip()

    if not delivery_address or not payment_mode:
        return jsonify({'error': 'delivery_address and payment_mode are required.'}), 400

    raw_items = data.get('items')
    if raw_items is None:
        pid = data.get('product_id')
        qty = data.get('quantity')
        if pid is not None and qty is not None:
            raw_items = [{'product_id': pid, 'quantity': qty}]
        else:
            return jsonify({'error': 'No items provided in order.'}), 400

    if not isinstance(raw_items, list) or len(raw_items) == 0:
        return jsonify({'error': 'Order must contain at least one item.'}), 400

    item_quantities = defaultdict(float)
    for idx, item in enumerate(raw_items):
        pid = item.get('product_id')
        try:
            qty = float(item.get('quantity', 0))
        except (ValueError, TypeError):
            return jsonify({'error': f'Invalid quantity for item at position {idx + 1}.'}), 400
        if not pid or qty <= 0:
            return jsonify({'error': 'Valid product_id and quantity > 0 required for all items.'}), 400
        item_quantities[int(pid)] += qty

    # Sort product IDs to prevent deadlock between concurrent multi-item transactions
    sorted_pids = sorted(item_quantities.keys())

    conn = get_connection()
    try:
        conn.begin()
        with conn.cursor() as cur:
            order_items_to_insert = []
            total_order_price = 0.0

            for pid in sorted_pids:
                req_qty = item_quantities[pid]
                cur.execute(
                    'SELECT product_id, product_name, price_per_unit, stock_quantity, selling_unit, weight_per_unit_kg '
                    'FROM products WHERE product_id = %s FOR UPDATE',
                    (pid,)
                )
                product = cur.fetchone()
                if not product:
                    conn.rollback()
                    return jsonify({'error': f'Product ID {pid} not found.'}), 404

                available_stock = float(product['stock_quantity'])
                if available_stock < req_qty:
                    conn.rollback()
                    return jsonify({
                        'error': f"Insufficient stock for '{product['product_name']}'. Available: {available_stock} {product['selling_unit']}, requested: {req_qty}"
                    }), 409

                unit_price = float(product['price_per_unit'])
                item_total = round(req_qty * unit_price, 2)
                total_order_price += item_total

                # Deduct stock
                cur.execute(
                    'UPDATE products SET stock_quantity = stock_quantity - %s WHERE product_id = %s',
                    (req_qty, pid)
                )

                order_items_to_insert.append({
                    'product_id': pid,
                    'quantity': req_qty,
                    'unit_price': unit_price,
                    'total_price': item_total,
                })

            total_order_price = round(total_order_price, 2)
            first_pid = sorted_pids[0]
            first_qty = item_quantities[first_pid]

            # Insert order header
            cur.execute(
                '''INSERT INTO orders
                   (customer_id, product_id, quantity, total_price,
                    delivery_address, payment_mode, status, dispatch_mode)
                   VALUES (%s, %s, %s, %s, %s, %s, 'Pending Review', 'Pending Review')''',
                (customer_id, first_pid, first_qty, total_order_price, delivery_address, payment_mode)
            )
            order_id = cur.lastrowid

            # Insert order items
            for it in order_items_to_insert:
                cur.execute(
                    '''INSERT INTO order_items
                       (order_id, product_id, quantity, unit_price, total_price)
                       VALUES (%s, %s, %s, %s, %s)''',
                    (order_id, it['product_id'], it['quantity'], it['unit_price'], it['total_price'])
                )

        conn.commit()
        return jsonify({
            'message': 'Order placed successfully!',
            'order_id': order_id,
            'total_price': total_order_price,
            'items_count': len(order_items_to_insert),
        }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@orders_bp.route('/api/orders/my', methods=['GET'])
@role_required('Customer')
def my_orders():
    customer_id = int(get_jwt_identity())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT o.*,
                          p.product_name, p.selling_unit, p.weight_per_unit_kg, p.price_per_unit,
                          u.full_name AS partner_name,
                          u.phone     AS partner_phone
                   FROM orders o
                   LEFT JOIN products p ON o.product_id = p.product_id
                   LEFT JOIN users u ON o.partner_id = u.user_id
                   WHERE o.customer_id = %s
                   ORDER BY o.created_at DESC''',
                (customer_id,)
            )
            rows = cur.fetchall()
            _attach_order_items(cur, rows)
        return jsonify(_serialize(rows)), 200
    finally:
        conn.close()


# ════════════════════════════════════════════════════════════════════════════
#  MANAGER
# ════════════════════════════════════════════════════════════════════════════

@orders_bp.route('/api/orders/pending-review', methods=['GET'])
@role_required('Manager')
def pending_review():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT o.*,
                          p.product_name, p.category, p.weight_per_unit_kg, p.selling_unit, p.price_per_unit,
                          (o.quantity * p.weight_per_unit_kg) AS package_weight_kg,
                          c.full_name AS customer_name,
                          c.phone    AS customer_phone
                   FROM orders o
                   LEFT JOIN products p ON o.product_id = p.product_id
                   JOIN users    c ON o.customer_id = c.user_id
                   WHERE o.status = 'Pending Review'
                   ORDER BY o.created_at ASC'''
            )
            rows = cur.fetchall()
            _attach_order_items(cur, rows)
        return jsonify(_serialize(rows)), 200
    finally:
        conn.close()


@orders_bp.route('/api/orders/<int:order_id>/dispatch', methods=['PUT'])
@role_required('Manager')
def dispatch_order(order_id):
    """
    Body: {
      distance_km: float,
      dispatch_mode: 'General' | 'Exclusive',
      partner_id: int | null,          # direct assign (Exclusive)
      vehicle_type_filter: str | null  # e.g. 'Truck' (Exclusive by vehicle)
    }
    """
    data          = request.get_json() or {}
    distance_km   = data.get('distance_km')
    dispatch_mode = data.get('dispatch_mode', '').strip()
    partner_id    = data.get('partner_id', None)
    vt_filter     = data.get('vehicle_type_filter', None)

    if distance_km is None or not dispatch_mode:
        return jsonify({'error': 'distance_km and dispatch_mode are required.'}), 400
    try:
        if float(distance_km) < MIN_ORDER_DISTANCE_KM:
            return jsonify({'error': f'distance_km must be at least {MIN_ORDER_DISTANCE_KM} km.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid distance_km value.'}), 400
    if dispatch_mode not in ('General', 'Exclusive'):
        return jsonify({'error': 'dispatch_mode must be "General" or "Exclusive".'}), 400

    effective_mode      = dispatch_mode
    effective_partner   = None

    if dispatch_mode == 'Exclusive':
        if partner_id:
            effective_partner = int(partner_id)
        elif vt_filter:
            effective_mode = f'Exclusive:{vt_filter}'   # e.g. 'Exclusive:Truck'
        else:
            return jsonify({'error': 'Exclusive dispatch needs partner_id or vehicle_type_filter.'}), 400

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                '''UPDATE orders
                   SET distance_km = %s, dispatch_mode = %s,
                       partner_id  = %s, status = 'Pending Delivery'
                   WHERE order_id = %s AND status = 'Pending Review' ''',
                (distance_km, effective_mode, effective_partner, order_id)
            )
            if cur.rowcount == 0:
                conn.rollback()
                return jsonify({'error': 'Order not found or already dispatched.'}), 404
        conn.commit()
        return jsonify({'message': 'Order dispatched successfully.'}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@orders_bp.route('/api/orders/all', methods=['GET'])
@role_required('Manager')
def all_orders():
    status = request.args.get('status', '').strip()
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            base_sql = '''
                SELECT o.*,
                       p.product_name, p.category, p.selling_unit, p.price_per_unit, p.weight_per_unit_kg,
                       c.full_name  AS customer_name,
                       dp.full_name AS partner_name
                FROM orders o
                LEFT JOIN products p ON o.product_id = p.product_id
                JOIN users    c ON o.customer_id = c.user_id
                LEFT JOIN users dp ON o.partner_id = dp.user_id
                {where}
                ORDER BY o.created_at DESC
            '''
            if status:
                cur.execute(base_sql.format(where='WHERE o.status = %s'), (status,))
            else:
                cur.execute(base_sql.format(where=''))
            rows = cur.fetchall()
            _attach_order_items(cur, rows)
        return jsonify(_serialize(rows)), 200
    finally:
        conn.close()


# ════════════════════════════════════════════════════════════════════════════
#  DELIVERY PARTNER
# ════════════════════════════════════════════════════════════════════════════

@orders_bp.route('/api/orders/open-board', methods=['GET'])
@role_required('Delivery Partner')
def open_board():
    """
    Returns Pending Delivery orders visible to this partner:
    - dispatch_mode = 'General'  (open to everyone)
    - partner_id    = self       (directly assigned)
    - dispatch_mode = 'Exclusive:<partner vehicle_type>'
    """
    partner_id = int(get_jwt_identity())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT vehicle_type FROM users WHERE user_id = %s', (partner_id,))
            row = cur.fetchone()
            vehicle_type = row['vehicle_type'] if row else None

            cur.execute(
                '''SELECT o.*,
                          p.product_name, p.selling_unit, p.weight_per_unit_kg, p.price_per_unit,
                          (o.quantity * p.weight_per_unit_kg) AS package_weight_kg,
                          c.full_name AS customer_name
                   FROM orders o
                   LEFT JOIN products p ON o.product_id = p.product_id
                   JOIN users    c ON o.customer_id = c.user_id
                   WHERE o.status = 'Pending Delivery'
                     AND (
                           o.dispatch_mode = 'General'
                        OR o.partner_id    = %s
                        OR o.dispatch_mode = %s
                     )
                   ORDER BY o.created_at ASC''',
                (partner_id, f'Exclusive:{vehicle_type}')
            )
            rows = cur.fetchall()
            _attach_order_items(cur, rows)
        return jsonify(_serialize(rows)), 200
    finally:
        conn.close()


@orders_bp.route('/api/orders/my-deliveries', methods=['GET'])
@role_required('Delivery Partner')
def my_deliveries():
    partner_id = int(get_jwt_identity())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT o.*,
                          p.product_name, p.selling_unit, p.weight_per_unit_kg, p.price_per_unit,
                          (o.quantity * p.weight_per_unit_kg) AS package_weight_kg,
                          c.full_name AS customer_name,
                          c.phone    AS customer_phone
                   FROM orders o
                   LEFT JOIN products p ON o.product_id = p.product_id
                   JOIN users    c ON o.customer_id = c.user_id
                   WHERE o.partner_id = %s
                   ORDER BY o.created_at DESC''',
                (partner_id,)
            )
            rows = cur.fetchall()
            _attach_order_items(cur, rows)
        return jsonify(_serialize(rows)), 200
    finally:
        conn.close()


@orders_bp.route('/api/orders/<int:order_id>/accept', methods=['PUT'])
@role_required('Delivery Partner')
def accept_order(order_id):
    """No single-order restriction: partner can accept even if they have active orders."""
    partner_id = int(get_jwt_identity())
    data = request.get_json() or {}
    eta = data.get('estimated_delivery')
    if not eta:
        return jsonify({'error': 'estimated_delivery (minutes) is required.'}), 400
    try:
        eta_int = int(eta)
        if eta_int < MIN_ETA_MINUTES:
            return jsonify({'error': f'estimated_delivery must be at least {MIN_ETA_MINUTES} minute(s).'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid estimated_delivery value.'}), 400

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                '''UPDATE orders
                   SET partner_id = %s, estimated_delivery = %s, status = 'In Transit'
                   WHERE order_id = %s AND status = 'Pending Delivery' ''',
                (partner_id, int(eta), order_id)
            )
            if cur.rowcount == 0:
                conn.rollback()
                return jsonify({'error': 'Order not found or no longer available.'}), 404
        conn.commit()
        return jsonify({'message': 'Order accepted. Status set to In Transit.'}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@orders_bp.route('/api/orders/<int:order_id>/finalize', methods=['PUT'])
@role_required('Delivery Partner')
def finalize_order(order_id):
    partner_id   = int(get_jwt_identity())
    data         = request.get_json() or {}
    final_status = data.get('status', '')

    if final_status not in ('Delivered', 'Not Delivered'):
        return jsonify({'error': 'status must be "Delivered" or "Not Delivered".'}), 400

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                '''UPDATE orders SET status = %s
                   WHERE order_id = %s AND partner_id = %s AND status = 'In Transit' ''',
                (final_status, order_id, partner_id)
            )
            if cur.rowcount == 0:
                conn.rollback()
                return jsonify({'error': 'Order not found or not currently In Transit.'}), 404
        conn.commit()
        return jsonify({'message': f'Order marked as {final_status}.'}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
