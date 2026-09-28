from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt


def role_required(*roles):
    """Decorator: verifies JWT and checks the 'role' claim against allowed roles."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request()
            except Exception:
                return jsonify({'error': 'Missing or invalid token. Please log in.'}), 401
            claims = get_jwt()
            if claims.get('role') not in roles:
                return jsonify({'error': 'Access denied: insufficient permissions.'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator
