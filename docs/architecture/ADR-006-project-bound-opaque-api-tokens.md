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
the selector, an HMAC-SHA-256 digest, and lifecycle metadata. It displays the
raw credential in the create response exactly once.
No list, audit, log, trace, metric label, URL, browser storage, or error
response may contain the credential, selector, or digest.

## Lifecycle and audit

- Go auth applies a 90-day default when no expiry is supplied; the maximum is
  365 days.
- Revocation is permanent and idempotent. Introspection locks the token row
  while it verifies and records use, so every introspection beginning after a
  revoke or delete commits rejects the credential. A request already
  authorized before that linearization point may finish.
- Re-enabling is not supported; rotation means issuing a replacement then
  revoking the old token.
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
token principals. Invalid, malformed, unknown, expired, revoked, and deleted tokens all return
indistinguishable `401` responses. Auth/Vault/database availability failures
return `503`. A token routed to another project returns non-disclosing `404`.
All public-v1 and browser token-management responses are `Cache-Control:
no-store`.

`READ` and `READ_WRITE` tokens can use the explicit project-scoped read
allowlist. `READ_WRITE` additionally permits task creation, updates (including
rank/status moves and assignee changes), and deletion through
`/api/public/v1/projects/:projectId/tasks`. A valid `READ` token attempting
one of those writes receives `403`. No token may access token management,
project lifecycle, membership/role operations, user/session/auth endpoints,
WebSockets, uploads, global endpoints, or OWNER-only actions.

## Consequences

This creates a separate credential lifecycle and an auth-service dependency
for machine requests, but preserves immediate revocation and avoids stale
project roles in JWT claims. Vault stores one auth-only `pepper` value,
readable only by Go auth; the NestJS database role is explicitly denied
token-table access. There is no pepper keyring, versioning, or secret
migration: changing the Vault pepper invalidates existing token HMACs, so
replacement tokens must be issued.
