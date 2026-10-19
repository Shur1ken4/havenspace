"""Worker tests use the psych_test database and a temporary storage folder.
Run `node scripts/migrate.mjs --test` first (npm test does this)."""
from __future__ import annotations

import os
import re
import secrets
import tempfile

# Must be set before worker modules read their config.
from worker import config  # noqa: E402

os.environ["WORKER_DATABASE_URL"] = re.sub(r"/[^/]+$", "/psych_test", os.environ.get("WORKER_DATABASE_URL", ""))
config.DATABASE_URL = os.environ["WORKER_DATABASE_URL"]
_tmp = tempfile.mkdtemp()
os.environ["LOCAL_STORAGE_DIR"] = _tmp
os.environ["STORAGE_DRIVER"] = "local"

import pytest  # noqa: E402

from worker import db  # noqa: E402


@pytest.fixture()
def conn():
    c = db.connect()
    yield c
    c.close()


@pytest.fixture()
def storage_dir():
    return _tmp


@pytest.fixture()
def therapist(conn):
    tid = secrets.token_hex(12)
    conn.execute('insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values (%s, %s, %s, true, now(), now())',
                 (tid, "t", f"{tid}@example.test"))
    conn.execute("insert into therapists (id, onboarding_completed_at, modalities, access_status) values (%s, now(), '{cbt}', 'approved')", (tid,))
    return tid


@pytest.fixture()
def client_with_consent(conn, therapist):
    cid = conn.execute("insert into clients (therapist_id, pseudonym) values (%s, 'Client T') returning id", (therapist,)).fetchone()["id"]
    conn.execute("insert into consents (therapist_id, client_id, consent_version, method) values (%s, %s, 'v1', 'verbal_in_session')",
                 (therapist, cid))
    return cid
