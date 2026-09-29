import pymysql
import pymysql.cursors
from flask import g
from config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, SHOW_SQL_QUERIES


class _TrackedCursor:
    """
    Wraps a PyMySQL DictCursor and, when SHOW_SQL_QUERIES is True, records
    every (query, params) pair into flask.g.sql_queries for header injection.
    Route handlers are NOT modified – they use cur.execute() as before.
    """

    def __init__(self, real_cursor):
        self._cur = real_cursor

    def execute(self, query, args=None):
        if SHOW_SQL_QUERIES:
            try:
                # Store raw query + params (serialised later by after_request hook)
                if not hasattr(g, 'sql_queries'):
                    g.sql_queries = []
                # Flatten Decimal / datetime values that may appear in args
                safe_args = None
                if args is not None:
                    safe_args = [str(a) if not isinstance(a, (str, int, float, bool, type(None))) else a
                                 for a in args]
                g.sql_queries.append({'sql': query.strip(), 'params': safe_args})
            except RuntimeError:
                # No active application context (e.g. startup migration) – skip recording
                pass
        return self._cur.execute(query, args)

    # ── Delegate everything else directly to the real cursor ──────────────────
    def fetchone(self):              return self._cur.fetchone()
    def fetchall(self):              return self._cur.fetchall()
    def fetchmany(self, size=None):  return self._cur.fetchmany(size)
    def __iter__(self):              return iter(self._cur)
    def __enter__(self):             return self
    def __exit__(self, *args):       return self._cur.__exit__(*args)

    @property
    def lastrowid(self):  return self._cur.lastrowid
    @property
    def rowcount(self):   return self._cur.rowcount
    @property
    def description(self): return self._cur.description


class _TrackedConnection:
    """Wraps a PyMySQL connection; returns _TrackedCursor from cursor()."""

    def __init__(self, real_conn):
        self._conn = real_conn

    def cursor(self):
        return _TrackedCursor(self._conn.cursor())

    # context-manager support that existing code relies on: `with conn.cursor() as cur:`
    def __enter__(self): return self
    def __exit__(self, *a): return self._conn.__exit__(*a)

    def commit(self):     self._conn.commit()
    def rollback(self):   self._conn.rollback()
    def close(self):      self._conn.close()


def get_connection():
    """Return a new PyMySQL connection with DictCursor and autocommit OFF.

    When SHOW_SQL_QUERIES is enabled the connection is wrapped so every
    cur.execute() call is transparently recorded into flask.g.sql_queries.
    """
    raw = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        charset='utf8mb4',
    )
    if SHOW_SQL_QUERIES:
        return _TrackedConnection(raw)
    return raw
