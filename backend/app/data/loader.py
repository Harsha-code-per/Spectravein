"""
@deprecated
CSV-based data loader has been retired from the API request path.

All `/api/targets` reads now come directly from PostgreSQL/Supabase
through SQLAlchemy in `app/api/endpoints.py`.
"""
