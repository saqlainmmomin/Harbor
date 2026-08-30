import os
import sys
from datetime import datetime, timezone

import psycopg

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Same failure mode as app/main.py's startup check: no silent fallback to
    # a hardcoded personal machine's connection string. This script doesn't
    # load apps/api/.env itself (unlike main.py) -- export DATABASE_URL first,
    # e.g. `export $(grep -v '^#' .env | xargs) && python seed.py`.
    print("FATAL: DATABASE_URL is not set. See apps/api/README.md.", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS engagements (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    client_name TEXT NOT NULL,
                    framework TEXT NOT NULL,
                    period_start DATE NOT NULL,
                    period_end DATE NOT NULL,
                    lead_auditor TEXT NOT NULL
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS stakeholders (
                    id TEXT PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    role_title TEXT NOT NULL
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS evidence_requests (
                    id TEXT PRIMARY KEY,
                    engagement_id TEXT NOT NULL REFERENCES engagements(id),
                    stakeholder_id TEXT NOT NULL REFERENCES stakeholders(id),
                    control_ref TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    status TEXT NOT NULL,
                    due_date DATE NOT NULL,
                    sent_at TIMESTAMPTZ,
                    reminder_count INT NOT NULL DEFAULT 0,
                    token TEXT,
                    last_activity_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS activity_log (
                    id TEXT PRIMARY KEY,
                    request_id TEXT REFERENCES evidence_requests(id),
                    actor TEXT NOT NULL,
                    actor_type TEXT NOT NULL,
                    action TEXT NOT NULL,
                    detail TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            cur.execute("SELECT id FROM engagements WHERE id = %s", ("eng_001",))
            if cur.fetchone() is None:
                cur.execute(
                    """
                    INSERT INTO engagements (id, name, client_name, framework, period_start, period_end, lead_auditor)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    ("eng_001", "SOC 2 Type II — FY26", "Northwind Logistics, Inc.", "SOC2", "2025-07-01", "2026-06-30", "A. Rao"),
                )

            cur.execute("SELECT id FROM stakeholders WHERE id = %s", ("s1",))
            if cur.fetchone() is None:
                cur.execute(
                    """
                    INSERT INTO stakeholders (id, full_name, email, role_title)
                    VALUES (%s, %s, %s, %s)
                    """,
                    ("s1", "Marcus Webb", "m.webb@northwind.example", "IT Manager"),
                )

            cur.execute("SELECT id FROM evidence_requests WHERE id = %s", ("req_seed_001",))
            if cur.fetchone() is None:
                cur.execute(
                    """
                    INSERT INTO evidence_requests (
                        id, engagement_id, stakeholder_id, control_ref, title, description, status, due_date, sent_at, reminder_count, token, last_activity_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        "req_seed_001",
                        "eng_001",
                        "s1",
                        "CC6.2",
                        "Seeded test request",
                        "Seeded test evidence request for the FastAPI slice",
                        "awaiting_upload",
                        "2026-07-31",
                        None,
                        0,
                        None,
                        datetime.now(timezone.utc),
                    ),
                )

            cur.execute(
                "SELECT id FROM activity_log WHERE id = %s",
                ("act_seed_001",),
            )
            if cur.fetchone() is None:
                cur.execute(
                    """
                    INSERT INTO activity_log (id, request_id, actor, actor_type, action, detail)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    ("act_seed_001", "req_seed_001", "system", "system", "created", "Seeded test evidence request"),
                )

        conn.commit()

    print("Seeded one engagement, one stakeholder, one evidence request")


if __name__ == "__main__":
    main()
