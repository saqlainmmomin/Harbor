"""Deterministic tests for app/auth.py's Clerk JWT verification -- no real
Clerk instance or network call. A throwaway RSA keypair stands in for
Clerk's signing key; app.auth._fetch_jwks is monkeypatched to return its
public half as a JWKS document, so verify_bearer_token exercises the real
signature/issuer/expiry checks against a token we sign ourselves."""

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app import auth as auth_module

_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_KID = "test-key-1"
_ISSUER = "https://verify-test.clerk.accounts.dev"


def _jwk_public() -> dict:
    numbers = _PRIVATE_KEY.public_key().public_numbers()

    def b64(n: int) -> str:
        import base64
        raw = n.to_bytes((n.bit_length() + 7) // 8, "big")
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    return {"kty": "RSA", "kid": _KID, "use": "sig", "alg": "RS256", "n": b64(numbers.n), "e": b64(numbers.e)}


def _sign(claims: dict, kid: str = _KID) -> str:
    return jwt.encode(claims, _PRIVATE_KEY, algorithm="RS256", headers={"kid": kid})


@pytest.fixture(autouse=True)
def _patch_jwks(monkeypatch):
    monkeypatch.setattr(auth_module, "CLERK_ISSUER", _ISSUER)
    monkeypatch.setattr(auth_module, "CLERK_JWKS_URL", f"{_ISSUER}/.well-known/jwks.json")
    monkeypatch.setattr(auth_module, "_fetch_jwks", lambda force=False: [_jwk_public()])
    auth_module._jwks_cache["keys"] = None
    yield


def _base_claims(**overrides) -> dict:
    now = int(time.time())
    claims = {"iss": _ISSUER, "sub": "user_abc123", "iat": now, "exp": now + 300}
    claims.update(overrides)
    return claims


def test_valid_token_returns_subject():
    token = _sign(_base_claims())
    claims = auth_module.verify_bearer_token(token)
    assert claims["sub"] == "user_abc123"


def test_expired_token_rejected():
    now = int(time.time())
    token = _sign(_base_claims(iat=now - 1000, exp=now - 100))
    with pytest.raises(jwt.PyJWTError):
        auth_module.verify_bearer_token(token)


def test_wrong_issuer_rejected():
    token = _sign(_base_claims(iss="https://not-this-app.clerk.accounts.dev"))
    with pytest.raises(jwt.PyJWTError):
        auth_module.verify_bearer_token(token)


def test_missing_required_claim_rejected():
    now = int(time.time())
    token = _sign({"iss": _ISSUER, "iat": now, "exp": now + 300})  # no `sub`
    with pytest.raises(jwt.PyJWTError):
        auth_module.verify_bearer_token(token)


def test_tampered_signature_rejected():
    token = _sign(_base_claims())
    # Flip a character in the signature segment.
    header, payload, signature = token.split(".")
    tampered_sig = ("A" if signature[0] != "A" else "B") + signature[1:]
    with pytest.raises(jwt.PyJWTError):
        auth_module.verify_bearer_token(f"{header}.{payload}.{tampered_sig}")


def test_get_current_auditor_id_rejects_missing_header():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        auth_module.get_current_auditor_id(authorization=None)
    assert exc_info.value.status_code == 401


def test_get_current_auditor_id_rejects_non_bearer_header():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        auth_module.get_current_auditor_id(authorization="Basic abc123")
    assert exc_info.value.status_code == 401


def test_get_current_auditor_id_accepts_valid_token():
    token = _sign(_base_claims())
    result = auth_module.get_current_auditor_id(authorization=f"Bearer {token}")
    assert result == "user_abc123"


def test_get_current_auditor_id_rejects_expired_token():
    from fastapi import HTTPException

    now = int(time.time())
    token = _sign(_base_claims(iat=now - 1000, exp=now - 100))
    with pytest.raises(HTTPException) as exc_info:
        auth_module.get_current_auditor_id(authorization=f"Bearer {token}")
    assert exc_info.value.status_code == 401


def test_unconfigured_auth_fails_closed(monkeypatch):
    from fastapi import HTTPException

    monkeypatch.setattr(auth_module, "CLERK_ISSUER", None)
    monkeypatch.setattr(auth_module, "CLERK_JWKS_URL", None)
    token = _sign(_base_claims())
    with pytest.raises(HTTPException) as exc_info:
        auth_module.get_current_auditor_id(authorization=f"Bearer {token}")
    assert exc_info.value.status_code == 503
