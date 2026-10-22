"""Transparent at-rest encryption for secrets stored in the database (SMTP passwords).

Values are stored as "enc:v1:<fernet token>". Reads accept both that form and
legacy plain text, so turning encryption on never breaks existing rows - the
migration script (scripts/migrate_encrypt_smtp_passwords.py) converts them.
"""
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.types import Text, TypeDecorator

from app.core.config import settings

PREFIX = "enc:v1:"


def _fernet():
    key = settings.SMTP_ENCRYPTION_KEY
    return Fernet(key.encode("utf-8")) if key else None


def encrypt_secret(plain):
    f = _fernet()
    if f is None or plain is None:
        return plain
    return PREFIX + f.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_secret(stored):
    if stored is None or not stored.startswith(PREFIX):
        return stored
    f = _fernet()
    if f is None:
        raise RuntimeError("Stored passwords are encrypted but SMTP_ENCRYPTION_KEY is not set")
    try:
        return f.decrypt(stored[len(PREFIX):].encode("utf-8")).decode("utf-8")
    except InvalidToken:
        raise RuntimeError("Could not decrypt a stored password - SMTP_ENCRYPTION_KEY does not match the key it was encrypted with")


class EncryptedString(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt_secret(value)

    def process_result_value(self, value, dialect):
        return decrypt_secret(value)
