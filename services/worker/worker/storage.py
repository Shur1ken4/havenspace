"""Short-lived audio storage: local folder in development, S3-compatible EU storage in production."""
from __future__ import annotations

import re
from pathlib import Path

from . import config

_KEY = re.compile(r"^[a-zA-Z0-9/_.-]+$")


def _safe(key: str) -> str:
    if not _KEY.match(key) or ".." in key:
        raise ValueError("invalid storage key")
    return key


class LocalStore:
    def __init__(self) -> None:
        base = Path(config.env("LOCAL_STORAGE_DIR", ".data/storage"))
        self.base = base if base.is_absolute() else config.REPO_ROOT / base

    def get(self, key: str) -> bytes:
        return (self.base / _safe(key)).read_bytes()

    def remove(self, keys: list[str]) -> None:
        for key in keys:
            (self.base / _safe(key)).unlink(missing_ok=True)


class S3Store:
    def __init__(self) -> None:
        import boto3

        self.bucket = config.env("S3_BUCKET")
        self.client = boto3.client(
            "s3",
            region_name=config.env("S3_REGION") or None,
            endpoint_url=config.env("S3_ENDPOINT") or None,
            aws_access_key_id=config.env("S3_ACCESS_KEY_ID"),
            aws_secret_access_key=config.env("S3_SECRET_ACCESS_KEY"),
        )

    def get(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=_safe(key))["Body"].read()

    def remove(self, keys: list[str]) -> None:
        for i in range(0, len(keys), 1000):
            batch = [{"Key": _safe(k)} for k in keys[i : i + 1000]]
            if batch:
                self.client.delete_objects(Bucket=self.bucket, Delete={"Objects": batch, "Quiet": True})


class DbStore:
    """Pilot fallback: objects kept in Postgres (blob_store) until EU object storage is connected."""

    def __init__(self) -> None:
        self._conn = None

    def _run(self, sql: str, args: tuple):
        import psycopg

        for attempt in (1, 2):  # reconnect once if the database closed an idle connection
            try:
                if self._conn is None or self._conn.closed:
                    self._conn = psycopg.connect(config.DATABASE_URL, autocommit=True)
                return self._conn.execute(sql, args)
            except psycopg.OperationalError:
                self._conn = None
                if attempt == 2:
                    raise
        raise RuntimeError("unreachable")

    def get(self, key: str) -> bytes:
        row = self._run("select body from blob_store where key = %s", (_safe(key),)).fetchone()
        if row is None:
            raise FileNotFoundError(key)
        return bytes(row[0])

    def remove(self, keys: list[str]) -> None:
        if keys:
            self._run("delete from blob_store where key = any(%s)", ([_safe(k) for k in keys],))


_store: LocalStore | S3Store | DbStore | None = None


def store() -> LocalStore | S3Store | DbStore:
    global _store
    if _store is None:
        driver = config.env("STORAGE_DRIVER")
        _store = S3Store() if driver == "s3" else DbStore() if driver == "db" else LocalStore()
    return _store
