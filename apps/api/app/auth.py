"""Auditor authentication boundary — verifies the Clerk session JWT the
frontend attaches as `Authorization: Bearer <token>` on every auditor-facing
request.

Product decision (see tasks/handoffs/2026-09-03-scope-rfi-fixes-implementation.md,
"Constraints and decisions" #2): this app has one Clerk instance shared by
every signed-in auditor at the firm, and (as documented in main.py's
list_engagements) there is no per-auditor engagement ownership model yet --
any authenticated auditor can see any engagement, matching the existing
"single firm, all auditors see all engagements" product shape. This module
therefore answers exactly one question -- "is this a real, currently valid
Clerk session for *some* signed-in auditor?" -- not "does this auditor own
this engagement." Resource-level correctness (a stakeholder_id must belong
to the engagement it's attached to, a file/request/engagement chain must be
internally consistent) is enforced separately, at each call site that reads
or writes those rows, because that's a data-integrity property, not an
identity one.

Verification is done by hand (PyJWT + a cached JWKS fetch) rather than a
Clerk Python SDK: there isn't one that does FastAPI-side JWT verification
out of the box, and this is the same RS256-JWKS check any OIDC-compatible
verifier would do. Clerk's session token `iss` claim is the Frontend API
URL for the instance (e.g. https://your-app.clerk.accounts.dev); its JWKS
lives at `{iss}/.well-known/jwks.json`.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

import httpx
import jwt
from fastapi import Header, HTTPException

CLERK_ISSUER = os.getenv("CLERK_ISSUER")
# Allow overriding the JWKS URL directly (e.g. for a test double); derived
# from CLERK_ISSUER by default per Clerk's documented layout.
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL") or (f"{CLERK_ISSUER.rstrip('/')}/.well-known/jwks.json" if CLERK_ISSUER else None)
_JWKS_TTL_SECONDS = 3600

# Deliberately NOT added to main.py's REQUIRED_ENV_VARS / _check_required_env_vars:
# that check hard-exits the whole process at import time, which would make it
# impossible to boot this API at all (including /health) in any environment
# that hasn't configured Clerk yet -- local dev, CI, or this review's own
# environment. Instead, an unconfigured auth boundary fails *closed* on each
# authenticated request (503, see below) rather than failing open or crashing
# the server. Real deployments must set CLERK_ISSUER.
_jwks_cache: dict[str, Any] = {"keys": None, "fetched_at": 0.0}


class AuthConfigurationError(RuntimeError):
    pass


def _fetch_jwks(force: bool = False) -> list[dict]:
    now = time.monotonic()
    if not force and _jwks_cache["keys"] is not None and now - _jwks_cache["fetched_at"] < _JWKS_TTL_SECONDS:
        return _jwks_cache["keys"]
    if not CLERK_JWKS_URL:
        raise AuthConfigurationError("CLERK_ISSUER (or CLERK_JWKS_URL) is not configured")
    resp = httpx.get(CLERK_JWKS_URL, timeout=5.0)
    resp.raise_for_status()
    keys = resp.json().get("keys", [])
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys


def _signing_key_for(kid: str) -> Any:
    keys = _fetch_jwks()
    match = next((k for k in keys if k.get("kid") == kid), None)
    if match is None:
        # Key rotation: refresh once before giving up, same pattern as any
        # JWKS consumer -- a brand-new signing key can appear between our
        # cache's TTL windows.
        keys = _fetch_jwks(force=True)
        match = next((k for k in keys if k.get("kid") == kid), None)
    if match is None:
        raise jwt.InvalidKeyError(f"No JWKS key found for kid={kid!r}")
    return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(match))


def verify_bearer_token(token: str) -> dict[str, Any]:
    """Verify a Clerk session JWT and return its claims. Raises jwt.PyJWTError
    (or a subclass) on anything invalid -- expired, wrong issuer, bad
    signature, malformed. Split out from the FastAPI dependency below so
    tests can call it directly with deterministic fixtures instead of
    exercising the network-bound JWKS fetch."""
    if not CLERK_JWKS_URL or not CLERK_ISSUER:
        raise AuthConfigurationError("CLERK_ISSUER (or CLERK_JWKS_URL) is not configured")
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    if not kid:
        raise jwt.InvalidTokenError("Token header missing 'kid'")
    key = _signing_key_for(kid)
    claims = jwt.decode(
        token,
        key=key,
        algorithms=["RS256"],
        issuer=CLERK_ISSUER,
        options={"require": ["exp", "iat", "iss", "sub"]},
    )
    return claims


def get_current_auditor_id(authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency for every auditor-facing route. Returns the Clerk
    user id (`sub` claim) on success. Never accepts a caller-supplied
    identity by any other means (query param, body field, etc.) -- the
    Authorization header is the only input."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        claims = verify_bearer_token(token)
    except AuthConfigurationError as exc:
        # Fail closed, not open -- a misconfigured server refuses
        # authenticated requests rather than silently accepting anyone.
        raise HTTPException(status_code=503, detail=f"Auth is not configured: {exc}") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {exc}") from exc

    sub = claims.get("sub")
    if not sub or not isinstance(sub, str):
        raise HTTPException(status_code=401, detail="Token missing subject claim")
    return sub
