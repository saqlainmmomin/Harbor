# apps/api — FastAPI backend

Not built yet. Phase 0 is UI-only; the web app runs entirely on
`apps/web/src/lib/mock-data.ts`.

Planned layout when we start plumbing:

```
app/
  main.py               # FastAPI app, CORS for the Vercel origin
  core/                 # settings, Clerk JWT verification, magic-link token signing
  api/v1/
    engagements.py      # CRUD + checklist generation from control_library
    requests.py         # evidence_requests, assignment, send
    uploads.py          # presigned URLs; magic-link auth, no Clerk session
    reviews.py          # ai_reviews read, review_decisions write
  models/               # SQLAlchemy models mirroring the Postgres schema
  schemas/              # Pydantic — keep field names identical to apps/web/src/lib/types.ts
  services/
    ai_review.py        # extract → classify → summarize → map control → flag
    email.py            # Resend
    storage.py          # Supabase Storage / S3
    activity.py         # single writer for activity_log
  workers/
    process_upload.py   # queued on upload
    daily_reminders.py  # escalation for overdue requests
alembic/
```

Two rules worth locking in early:

1. **Every state change goes through `services/activity.py`.** The audit trail is
   the product; nothing should be able to mutate a request without logging.
2. **`ai_reviews` rows are immutable suggestions.** Auditor decisions live in
   `review_decisions`. Never overwrite an AI output with a human correction —
   defensibility depends on being able to show what the model said and what the
   auditor did about it.
