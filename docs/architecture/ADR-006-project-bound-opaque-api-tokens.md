# ADR-006: Project-bound opaque API tokens

**Status:** Accepted  
**Date:** 2026-08-05  
**Task:** TR-85

## Decision

The public API uses project-bound opaque credentials, not browser JWTs,
OAuth grants, refresh tokens, service users, or impersonated users. A token
has exactly one immutable project binding and either `READ` or `READ_WRITE`
permission. It is an admin-level machine principal only within that project.

Go auth owns credential generation, Vault-peppered HMAC verification,
expiry, revocation, deletion, and the internal introspection contract. NestJS
authenticates a human browser JWT before allowing a project `OWNER` or `ADMIN`
to issue, list, revoke, or delete a token. NestJS also owns project existence,
project-path containment, and the explicit public-v1 route allowlist.

Tokens have the versioned form `trp_v1_<selector>.<secret>`. Both components
are generated with `crypto/rand`; the secret is at least 256 bits. Go stores
the selector, an HMAC-SHA-256 digest, the Vault pepper version, and lifecycle
metadata. It displays the raw credential in the create response exactly once.
No list, audit, log, trace, metric label, URL, browser storage, or error
response may contain the credential, selector, or digest.

## Lifecycle and audit

- Default expiry is 90 days; the maximum is 365 days.
- Revocation is immediate, permanent, and idempotent. Re-enabling is not
  supported; rotation means issuing a replacement then revoking the old token.
- Deletion removes the credential record and therefore invalidates it
  immediately. A separate append-only event record retains audit evidence.
- Demoting, removing, disabling, or deleting the issuing user does not affect
  the token: it belongs to its project, not its issuer.
- Archived and deleted projects block token use. Project deletion cascades
  active token records; audit records deliberately have no project/token
  foreign keys and remain.

## Request boundary

Tokens travel only in `X-API-Key` over TLS. Browser JWT routes remain bearer
JWT-only; public routes live under `/api/public/v1` and accept only project
token principals. Invalid, malformed, unknown, expired, revoked, and deleted
tokens all return indistinguishable `401` responses. Auth/Vault/database
availability failures return `503`. A token routed to another project returns
non-disclosing `404`.

The first public-v1 slice is read-only. No token may access token management,
project lifecycle, membership/role operations, user/session/auth endpoints,
WebSockets, uploads, global endpoints, or OWNER-only actions. Write routes
require an explicit later allowlist review.

## Consequences

This creates a separate credential lifecycle and an auth-service dependency
for machine requests, but preserves immediate revocation and avoids stale
project roles in JWT claims. The Vault pepper is readable only by Go auth;
the NestJS database role is explicitly denied token-table access. A future
pepper rotation keeps per-token versions and accepts the old version until
affected credentials are replaced or expire.
