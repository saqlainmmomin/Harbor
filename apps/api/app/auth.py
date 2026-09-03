"""Auditor authentication boundary — verifies the Clerk session JWT the
frontend attaches as `Authorization: Bearer <token>` on every auditor-facing
request.

Product decision (see tasks/handoffs/2026-09-03-scope-rfi-fixes-implementation.md,
"Constraints and decisions" #2): this app has one Clerk instance shared by
every signed-in auditor at the firm, and (as documented in main.py's
list_engagements) there is no per-auditor engagement ownership model yet --
any authenticated auditor can see any engagement, matching the existing
"single firm, all auditors see all engagements" product shape. This module
therefore answers two questions -- "is this a real, currently valid Clerk
session" AND "does it belong to this firm's auditor org/allowlist"
(CLERK_AUDITOR_ORG_ID / CLERK_AUDITOR_USER_IDS below) -- not "does this
auditor own this engagement." The first Codex review pass only checked the
former: any newly signed-up Clerk user (sign-up is public) got auditor-wide
access. Resource-level correctness (a stakeholder_id must belong to the
engagement it's attached to, a file/request/engagement chain must be
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
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from fastapi import Header, HTTPException

CLERK_ISSUER = os.getenv("CLERK_ISSUER")
# Allow overriding the JWKS URL directly (e.g. for a test double); derived
# from CLERK_ISSUER by default per Clerk's documented layout.
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL") or (f"{CLERK_ISSUER.rstrip('/')}/.well-known/jwks.json" if CLERK_ISSUER else None)
_JWKS_TTL_SECONDS = 3600

# Who counts as "an auditor at this firm", not just "some real Clerk user".
# Codex review finding P0#1: verifying the JWT signature alone only proves
# the caller has *a* Clerk account -- the app's own sign-up page lets anyone
# create one, and every auditor route used to accept that. Two independent,
# additive membership checks (either is sufficient):
#   - CLERK_AUDITOR_ORG_ID: the Clerk Organization id representing the
#     firm's auditor team -- satisfied if the token's `org_id` claim
#     (present on an organization-scoped Clerk session token) matches.
#   - CLERK_AUDITOR_USER_IDS: a comma-separated allowlist of Clerk user ids
#     (the `sub` claim), for a deployment that hasn't set up Clerk
#     Organizations yet.
# Fails closed, like the JWKS check below: if neither is configured, no
# token is treated as an auditor (503, not "allow everyone").
CLERK_AUDITOR_ORG_ID = os.getenv("CLERK_AUDITOR_ORG_ID")
CLERK_AUDITOR_USER_IDS = {
    uid.strip() for uid in (os.getenv("CLERK_AUDITOR_USER_IDS") or "").split(",") if uid.strip()
}

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


class AuthUpstreamError(RuntimeError):
    """The JWKS fetch itself failed (network/timeout, non-2xx, or a
    malformed response body) -- distinct from AuthConfigurationError (no
    issuer configured at all) and from jwt.PyJWTError (a real, fetched key
    that just doesn't validate the token). Codex review finding P1#8: none
    of httpx's own exceptions are jwt.PyJWTError subclasses, so without this
    they fell through to FastAPI's generic 500 handler -- an upstream Clerk
    outage looked identical to a real bug in this service. Caught in
    get_current_auditor_id below and turned into a fail-closed 503, same
    fail-closed posture as AuthConfigurationError."""


def _fetch_jwks(force: bool = False) -> list[dict]:
    now = time.monotonic()
    if not force and _jwks_cache["keys"] is not None and now - _jwks_cache["fetched_at"] < _JWKS_TTL_SECONDS:
        return _jwks_cache["keys"]
    if not CLERK_JWKS_URL:
        raise AuthConfigurationError("CLERK_ISSUER (or CLERK_JWKS_URL) is not configured")
    try:
        resp = httpx.get(CLERK_JWKS_URL, timeout=5.0)
        resp.raise_for_status()
        body = resp.json()
    except httpx.TimeoutException as exc:
        raise AuthUpstreamError(f"JWKS fetch timed out: {exc}") from exc
    except httpx.HTTPStatusError as exc:
        raise AuthUpstreamError(f"JWKS endpoint returned {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise AuthUpstreamError(f"JWKS fetch failed: {exc}") from exc
    except (json.JSONDecodeError, ValueError) as exc:
        raise AuthUpstreamError(f"JWKS response was not valid JSON: {exc}") from exc
    if not isinstance(body, dict) or not isinstance(body.get("keys"), list):
        raise AuthUpstreamError("JWKS response did not contain a 'keys' array")
    keys = body["keys"]
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


@dataclass(frozen=True)
class AuditorIdentity:
    """The verified caller, resolved entirely from the Clerk token's own
    (signature-verified) claims -- never from anything the client can set
    directly in a request body. `display_name` is what gets persisted/shown
    as the actor for an auditor action (e.g. a review decision); see
    main.py's submit_decision and Codex review finding "audit-trail actor
    remains caller-controlled" (a `decided_by` request-body field used to be
    trusted and persisted as-is)."""

    id: str
    display_name: str


def _resolve_display_name(claims: dict[str, Any]) -> str:
    """Best-effort human-readable name from the verified token's own claims.
    Clerk session tokens don't universally carry profile-name claims unless
    a custom JWT template adds them (`name`, `first_name`/`last_name`, or an
    email claim) -- fall through the common shapes, then to the bare
    subject id so this always returns a deterministic, non-empty value."""
    name = claims.get("name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    first = claims.get("first_name") or claims.get("given_name")
    last = claims.get("last_name") or claims.get("family_name")
    combined = " ".join(p.strip() for p in (first, last) if isinstance(p, str) and p.strip())
    if combined:
        return combined
    email = claims.get("email") or claims.get("primary_email_address") or claims.get("email_address")
    if isinstance(email, str) and email.strip():
        return email.strip()
    return str(claims.get("sub"))


def _is_auditor(claims: dict[str, Any]) -> bool:
    """Membership check, separate from signature/issuer/expiry validity --
    see the CLERK_AUDITOR_ORG_ID / CLERK_AUDITOR_USER_IDS module docstring
    above. Fails closed: if neither is configured, nobody passes."""
    if CLERK_AUDITOR_ORG_ID:
        if claims.get("org_id") == CLERK_AUDITOR_ORG_ID:
            return True
    if CLERK_AUDITOR_USER_IDS:
        sub = claims.get("sub")
        if isinstance(sub, str) and sub in CLERK_AUDITOR_USER_IDS:
            return True
    return False


def _authenticate(authorization: str | None) -> dict[str, Any]:
    """Shared header-parsing + verification + membership check for both
    dependencies below. Raises HTTPException on any failure."""
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
    except AuthUpstreamError as exc:
        # The JWKS fetch itself failed (Clerk outage, network blip,
        # malformed response) -- not a real verdict on this token. Fail
        # closed with a distinct, retryable status rather than a raw 500.
        raise HTTPException(status_code=503, detail=f"Auth is temporarily unavailable: {exc}") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {exc}") from exc

    sub = claims.get("sub")
    if not sub or not isinstance(sub, str):
        raise HTTPException(status_code=401, detail="Token missing subject claim")

    if not CLERK_AUDITOR_ORG_ID and not CLERK_AUDITOR_USER_IDS:
        raise HTTPException(status_code=503, detail="Auditor authorization is not configured")
    if not _is_auditor(claims):
        # A real, currently-valid Clerk session -- just not one that belongs
        # to this firm's auditor org/allowlist. This is the fix for Codex
        # review finding P0#1 ("any valid Clerk user receives auditor-wide
        # access"): signature validity alone used to be sufficient here.
        raise HTTPException(status_code=403, detail="This account is not authorized as an auditor")

    return claims


def get_current_auditor_id(authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency for every auditor-facing route. Returns the Clerk
    user id (`sub` claim) on success. Never accepts a caller-supplied
    identity by any other means (query param, body field, etc.) -- the
    Authorization header is the only input."""
    claims = _authenticate(authorization)
    return claims["sub"]


def get_current_auditor(authorization: str | None = Header(default=None)) -> AuditorIdentity:
    """Same verification as get_current_auditor_id, but also resolves a
    display name from the token's own claims -- for routes that need to
    record *who* took an action (e.g. submit_decision) without trusting a
    client-supplied name field."""
    claims = _authenticate(authorization)
    return AuditorIdentity(id=claims["sub"], display_name=_resolve_display_name(claims))
