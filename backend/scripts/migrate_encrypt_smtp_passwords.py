"""One-off migration: widens smtp_profiles.password to TEXT and encrypts every
plain-text SMTP password in place with SMTP_ENCRYPTION_KEY. Safe to re-run
(already-encrypted rows are skipped). Take a database backup first.
Run with: PYTHONPATH=. venv/bin/python3 scripts/migrate_encrypt_smtp_passwords.py
"""
import sys

from sqlalchemy import text

from app.core.config import settings
from app.core.crypto import PREFIX, decrypt_secret, encrypt_secret
from app.core.database import engine

if not settings.SMTP_ENCRYPTION_KEY:
    sys.exit("SMTP_ENCRYPTION_KEY is not set in .env - refusing to run (nothing would be encrypted)")

with engine.begin() as conn:
    # Fernet tokens are longer than the plain password; the old varchar(255) could overflow.
    conn.execute(text("ALTER TABLE smtp_profiles ALTER COLUMN password TYPE TEXT"))

    rows = conn.execute(text("SELECT id, password FROM smtp_profiles ORDER BY id")).fetchall()
    converted = skipped = 0
    for row_id, stored in rows:
        if stored.startswith(PREFIX):
            skipped += 1
            continue
        encrypted = encrypt_secret(stored)
        if decrypt_secret(encrypted) != stored:
            raise SystemExit(f"round-trip check failed for smtp_profiles.id={row_id} - nothing was committed")
        conn.execute(text("UPDATE smtp_profiles SET password = :p WHERE id = :i"), {"p": encrypted, "i": row_id})
        converted += 1

print(f"smtp_profiles: {converted} password(s) encrypted, {skipped} already encrypted, {len(rows)} total")
