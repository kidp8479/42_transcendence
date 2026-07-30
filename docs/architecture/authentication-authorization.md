# Authentication and Authorization Architecture

**Status:** Accepted target architecture
**Scope:** ft_transcendence local credentials, 42 OAuth2, Google OIDC, browser/API authentication, authorization, WebSockets, and secret management.
**Implementation status:** 7.1 (Vault and runtime secrets) and the 7.2 persistence migrations are delivered. TR-80 / 7.2.1 is delivered: `ACTIVE` is enforced in the current local-login and opaque-session path. The JWT/refresh cutover begins only after the remaining 7.2 runtime invariants are complete.

> This is the approved target architecture. `docs/architecture/authentication-authorization.yaml` and `docs/contracts/auth-service.openapi.yaml` remain the current opaque-session runtime contracts until the JWT/refresh cutover. Any interim change to the opaque path, including TR-80, must update the relevant legacy contract in its implementation PR rather than replacing it with this target design early.

## 1. Executive decisions

| Area | Decision | Alternatives considered and tradeoff |
|---|---|---|
| Browser API credential | A 15-minute access JWT is held in JavaScript memory and sent in `Authorization: Bearer <token>`. | An HttpOnly access-token cookie makes every mutation CSRF-sensitive. `localStorage` exposes persistent bearer data to XSS. Memory limits XSS theft to the 15-minute access-token lifetime. |
| Refresh credential | A rotating refresh token is an HttpOnly, Secure, SameSite cookie. | Browser-stored refresh tokens are vulnerable to XSS exfiltration. Opaque server sessions are simpler but do not meet the selected bearer-JWT contract. |
| Authentication boundary | NestJS forwards every bearer access JWT to Go for read-only introspection. Go owns authentication, token/session state, revocation, and coarse global authorization. | Local NestJS JWT verification avoids the call but gives less meaningful Go ownership and complicates centralized state. Per-request introspection adds latency and availability dependency; the team accepts this deliberately. |
| Domain authorization | NestJS owns current project membership, ownership, project role, and object-level checks. | Letting Go load arbitrary project data centralizes too much domain logic in the auth service. JWT project claims are stale and do not prevent IDOR. |
| Token signing | Go obtains Ed25519 signatures from Vault Transit. It publishes public keys through internal JWKS. | Shared HMAC lets every verifier mint tokens. A Go-loaded private key is simpler but exposes it on Go compromise. Transit adds a signing network call but keeps private keys in Vault. |
| Revocation | Go introspection initially reads authoritative PostgreSQL state for every protected request and does not cache successful revocation-sensitive state. | Redis/local caches reduce database traffic but make revocation bounded rather than immediate. They are intentional future optimizations behind the same contract. |
| CSRF | Reuse the existing readable `tr_csrf` double-submit pattern, bound to the refresh-token family. Apply it with exact Origin validation only to cookie-authenticated refresh, logout, and session-management endpoints. | CSRF on every feature API is unnecessary because bearer headers are not ambient credentials. Origin-only checks are weaker. |
| OAuth scopes | 42 requests `public`; Google requests `openid email profile`. | Provider/library defaults can drift. Broader scopes expose unnecessary data. |
| Global roles | `User.globalRole` is a single enum: `USER` or `PLATFORM_ADMIN`; all changes are audited. | A normalized role-assignment table is appropriate only once multiple independent global roles are needed. |
| Project roles | Project roles are `OWNER`, `ADMIN`, and `MEMBER`, stored only in the application database. | Project roles/scopes in JWTs become stale, make tokens large, and cannot decide object access. |
| Vault | Vault is a prerequisite phase. Services call Vault directly using AppRole and short-lived renewable tokens; Secret IDs are mounted as protected files. | Vault Agent sidecars avoid application Vault code but add deployment components. Environment-secret authority is rejected for runtime secrets. |

## 2. Trust boundaries and threat model

### Trust boundaries

| Boundary | Trust assumption | Required controls |
|---|---|---|
| Browser -> nginx | Browser input, headers, URLs, and WebSocket messages are untrusted. | TLS/WSS outside local development, strict CSP, request limits, exact Origin checks, no credential/token logging, server-side authorization. |
| nginx -> Go auth / NestJS | Internal network connectivity is not authorization. | Only nginx is public ingress; `/auth/internal/*` is denied publicly; preserve required host/protocol/client headers; redact WebSocket query strings; internal services authenticate each other. |
| NestJS -> Go auth | NestJS is an authenticated caller, but Go remains the authority for bearer-token validity and global roles. | Continue the current static internal bearer credential until mTLS is implemented; use a versioned transport-independent introspection contract, strict 2-second configurable timeout, fail closed, and no raw-token logging. |
| Go auth -> PostgreSQL | Go needs only authentication records and current global roles/account state. | Vault-issued dynamic database credentials, least-privilege database role, parameterized queries, migrations owned separately. |
| NestJS -> PostgreSQL | NestJS owns application/project/resource data. | Separate dynamic database role, object-level query/policy checks, no password-hash access. |
| Go auth -> Vault | Go needs signing and secrets, not Vault root access. | AppRole, mounted Secret-ID file, renewable Vault client token, narrow Transit/KV/database policies, no secret values in logs. |
| Go auth -> 42 / Google | Providers are external identity assertions. | Fixed/discovered trusted endpoints, TLS certificate validation, exact callbacks, state, minimum scopes, provider-specific validation, server-side code exchange. |

### Primary threats and responses

| Threat | Response |
|---|---|
| Stolen access JWT | Access token is memory-only and expires in 15 minutes. Go introspection rejects disabled/revoked subject/session state. |
| Stolen refresh token | HttpOnly cookie prevents direct JavaScript read. Rotation, family tracking, replay detection, account-wide compromise revocation, and audit events contain reuse. |
| Cross-site request forgery | Refresh/logout/session-management requests require exact allowed Origin and `X-CSRF-Token` matching the readable double-submit token. |
| XSS | Restrictive CSP, safe rendering, no raw HTML without sanitization, no access-token persistence, and no browser-console logging of auth failures. HttpOnly refresh cookies still permit XSS-triggered requests, so CSP and safe rendering remain essential. |
| OAuth callback or account-link attack | Single-use state, short transaction expiry, server-side exchange, exact callback URL, PKCE/nonce for Google, atomic callback consumption, and safe return-path validation. |
| IDOR / stale authorization | NestJS checks current membership and role against the parent project/resource on every domain operation; client IDs, JWT project claims, and UI state never authorize. |
| Introspection outage | Protected routes return `503`; public routes remain available; NestJS never accepts stale cached authorization results. |
| WebSocket ticket leakage | Tickets are random, opaque, single use, audience-bound, 60 seconds maximum, stored hashed, and redacted from infrastructure logs. |
| Privilege escalation | Global role and account status come only from Go introspection; project permissions come only from NestJS current data; role changes and admin actions are audited. |

## 3. Authentication flows

### 3.1 Local registration

1. Browser submits email, username, and password through the shared frontend `apiClient`.
2. Go validates exact Origin, input size, username, password policy, and registration rate limits.
3. Go creates `User` with `ACTIVE` status, `LOCAL` identity, and Argon2id password credential transactionally. Seeded users use this same registration path and therefore receive the same status.
4. Local email verification is deferred. Until that milestone, local accounts receive full initial access, including project creation and joining.
5. When email verification is introduced, an account becomes `ACTIVE` only after the email is confirmed and either its domain is on the campus allowlist or a `PLATFORM_ADMIN` activates it. Until then, `PENDING_APPROVAL` is expected only for Google OIDC identities; `DISABLED` denies every provider.
6. Go creates a refresh-token family, CSRF token, and 15-minute access JWT. It sets the refresh and CSRF cookies and returns the access JWT only in the response body.
7. The frontend keeps the access JWT only in memory.

**Tradeoff:** allowing all local registrations to start active makes first use and local seeding simple, but accepts the risk that a registrant may not control the supplied mailbox until the verification milestone.

### 3.2 Local login

1. Go validates Origin and applies per-IP and per-normalized-email limits.
2. It performs bounded Argon2id verification, using a decoy hash for unknown accounts to reduce account enumeration timing differences.
3. On success it creates a new independent device refresh-token family and access JWT.
4. A login does not revoke sessions on other devices.

### 3.3 Access-token refresh

1. The shared `apiClient` holds the access JWT in memory.
2. On an ordinary API `401`, it serializes one refresh attempt across concurrent requests.
3. `POST /auth/refresh` receives the ambient refresh cookie plus exact Origin and `X-CSRF-Token`.
4. Go rotates the refresh token, issues a fresh access JWT, updates the CSRF token/family state, and returns the access JWT.
5. The original request is retried once only. Network failures and non-`401` responses are not retried automatically.
6. If refresh fails, the client clears local auth state and redirects to sign-in without console warnings/errors.

### 3.4 42 OAuth2

1. Go creates an `OAuthTransaction` with a random state value, stores only its hash, and redirects to the exact registered 42 callback using scope `public`.
2. Go validates and atomically consumes the returned state before exchanging the authorization code server-side.
3. Go calls 42 `/v2/me` and uses the immutable numeric 42 user ID as `providerSubject`.
4. 42 identity is treated as a verified 42 identity. Provider access tokens are discarded after profile retrieval in v1.
5. Go resolves an existing `(FORTY_TWO, providerSubject)` first. For a new identity, it applies the linking/provisioning rules below.
6. Go creates the refresh family/access JWT and redirects to the stored safe return path.

42 is OAuth2, not OIDC. The design must not expect an ID token or assume PKCE support until provider support is verified.

### 3.5 Google OIDC

1. Go reads trusted OIDC endpoints from Google discovery and creates a single-use 15-minute transaction with random state, PKCE S256 verifier/challenge, and nonce.
2. It requests `openid email profile`.
3. On callback, Go validates state, authorization-code exchange, ID-token signature, issuer, audience, expiry, nonce, and reads the `email_verified` assertion.
4. It identifies the account by issuer plus immutable `sub`, never email or display name.
5. It evaluates a confirmed normalized email against the campus-domain allowlist. Google `hd` is a UX hint only, never an authorization proof.
6. An identity is `ACTIVE` only when its email is confirmed and either the domain is allowlisted or a `PLATFORM_ADMIN` activates it. An unverified or out-of-domain identity creates `PENDING_APPROVAL` without any app tokens or session; the callback displays a non-authenticated pending-approval page.
7. A platform administrator may activate a confirmed out-of-domain account, after which the user signs in again.

### 3.6 Account linking and provisioning

1. Existing provider identity lookup by `(provider, providerSubject)` always takes precedence.
2. A new provider identity automatically links to an existing local account when normalized email strings match, even if the local email is not verified.
3. The same email rule never uses usernames, display names, or mutable provider profile fields.
4. A provider username collision creates a sanitized base plus a random suffix. The unique constraint remains authoritative; collision retries are required. The user can rename it later.
5. Explicit linking remains available for authenticated account-management flows.
6. Linking, unlinking, and every identity conflict are audited.

**Accepted tradeoff:** automatic linking to an unverified local email improves convenience but creates more account-takeover risk than verified-email-only linking. Future verification can tighten this policy.

### 3.7 Safe OAuth return paths

The browser supplies its current application path before OAuth begins. Go stores a normalized path in the OAuth transaction and never trusts a callback-supplied return target.

Allowed prefixes are `/dashboard`, `/projects`, `/profile`, and `/settings`. Validation requires exactly one leading slash, rejects `//`, absolute URLs, backslashes, and control characters, normalizes before prefix comparison, and discards query strings and fragments. Invalid paths fall back to `/dashboard`.

## 4. Access-token and refresh-token lifecycle

| Token | Storage | Lifetime | Rotation/revocation |
|---|---|---|---|
| Access JWT | JavaScript memory only | 15 minutes | New token at login/register/refresh. No browser persistence. Its claims are a snapshot; Go introspection checks current state. |
| Refresh token | HttpOnly, Secure, SameSite cookie | 7-day idle lifetime; 30-day absolute family lifetime | Rotate on every refresh. Only hashes are stored. |
| CSRF token | Readable Secure, SameSite `tr_csrf` cookie and header | Bound to refresh family | Rotate with refresh-family changes. Never logs. |
| WebSocket ticket | URL query parameter only for `/ws`, server stores hash | 60 seconds | Exactly once; atomically consumed before connection acceptance. |

### Refresh rotation and replay detection

Each device has an independent refresh-token family. The database retains enough token history to distinguish the current token, immediately previous token, replaced tokens, and revoked family state.

1. A normal refresh atomically marks the presented token used and creates a replacement.
2. The immediately previous refresh token may be accepted for **5 seconds** to tolerate legitimate concurrent browser requests.
3. Reuse after the 5-second grace window is replay.
4. Confirmed replay revokes **all** refresh-token families for the account, invalidates account/session state for Go introspection, clears current browser cookies, and emits a redacted audit event.
5. The 5-second grace is an accepted risk. A stricter future hardening option is to treat every used token as replay and revoke all account sessions.

The frontend must still serialize refresh calls. The grace window is a resilience backstop, not a substitute for correct client behavior.

### Logout and revocation

| Event | Result |
|---|---|
| Normal logout | Revoke only the current device refresh-token family and clear browser state/cookies. A copied access JWT can remain usable for no more than 15 minutes. |
| Logout all devices | Revoke every refresh-token family for the user. |
| Confirmed refresh replay | Revoke every refresh-token family for the user and immediately make Go introspection reject affected access JWTs. |
| Identity unlink | Revoke every refresh-token family for the user. |
| Account disablement | Revoke every refresh-token family and immediately reject access through introspection. |
| Password change or reset | Existing sessions remain valid by deliberate product decision. New local-password use requires the new credential. |
| Global-role / assurance change | Rotate the affected refresh family and ensure Go introspection returns current role/assurance state. |

## 5. Token storage, CSRF, and XSS

### Browser storage strategy

- Access JWT: memory only; never `localStorage`, `sessionStorage`, IndexedDB, URL, or long-lived cookie.
- Refresh token: HttpOnly cookie, not readable by JavaScript.
- CSRF token: readable cookie plus `X-CSRF-Token` only for endpoints authenticated by the refresh cookie.
- OAuth provider tokens: never sent to React or NestJS and discarded after identity retrieval unless a later feature proves a continuing server-side provider API need.

### CSRF policy

`POST /auth/refresh`, logout, account/session management, and other refresh-cookie-authenticated mutations require:

1. exact allowed `Origin`;
2. readable CSRF cookie echoed in `X-CSRF-Token`;
3. server-side constant-time comparison against the refresh-family CSRF hash.

Bearer-authenticated application APIs use explicit `Authorization` and do not rely on cookies, so they do not require CSRF protection. Login/register remain Origin-checked and rate-limited.

### XSS policy

The production frontend CSP begins restrictive:

```text
default-src 'self';
connect-src 'self';
frame-ancestors 'none';
script-src <nonce-or-hash-based sources only>;
style-src <explicit sources>;
img-src <explicit sources>;
font-src <explicit sources>;
```

No `unsafe-inline` script policy is allowed. The exact asset directives must match the production build. React escaping and CSP do not make arbitrary HTML safe; any future rich text/Markdown feature needs dedicated sanitization. Expected auth failures must be represented as typed UI state and never logged as browser-console errors or warnings.

## 6. JWT format, signing, and introspection

### JWT rules

- Format: signed JWS, not encrypted JWE.
- Algorithm: Ed25519.
- Signing authority: Vault Transit; the private key never leaves Vault.
- Key rotation: active and previous public keys remain in internal JWKS for at least access-token lifetime plus clock skew. JWT `kid` identifies the key version.
- Required claims include `iss`, `aud`, `sub`, `sid`, `jti`, `iat`, `exp`, `auth_time`, and authentication-method/assurance facts.
- `global_roles` may be included only as an advisory UI snapshot. It is never an authorization allow decision.
- JWTs contain no project roles, project scopes, provider tokens, password information, or sensitive profile data.

TLS protects a JWT in transit. Encryption would add key-management and interoperability complexity while not protecting a browser-readable payload from the bearer that holds it. Sensitive values therefore do not belong in claims.

### Per-request Go introspection

NestJS extracts the bearer JWT and sends it to Go on every protected HTTP request and relevant WebSocket authorization action. Go:

1. validates JWT signature, issuer, audience, expiry, and token structure;
2. checks authoritative account status, refresh-family/session state, revocation state, and current global role;
3. returns a small versioned principal;
4. performs no project/resource lookup and writes no ordinary-request session activity state.

Initial response shape:

```json
{
  "active": true,
  "sub": "user-id",
  "sid": "session-id",
  "jti": "token-id",
  "exp": 1784729700,
  "auth_time": 1784728800,
  "global_roles": ["PLATFORM_ADMIN"]
}
```

There are no initial application scopes. This is a first-party browser session, not a delegated OAuth API credential. Scopes are deferred until a concrete need exists for service accounts, personal access tokens, CLI credentials, or third-party clients.

NestJS treats an inactive/expired access token as `401`, invalid Origin/CSRF as `403` on cookie-authenticated auth endpoints, and Go transport errors/timeouts/invalid introspection responses as `503`. Public endpoints are unaffected.

### Introspection performance and future optimization

The initial 2-second timeout is deployment-configurable and fails closed. Basic metrics record call volume, latency, failures, timeouts, auth-service availability, and PostgreSQL read load. Formal alert thresholds are deferred until actual project workload exists.

The caller-facing contract must remain stable enough to later introduce:

- cached immutable signing-key metadata;
- short-lived active-state cache with explicitly bounded revocation semantics;
- event-driven invalidation;
- Redis-backed revocation state;
- local JWT verification for selected routes.

No successful revocation-sensitive state is cached initially. “Immediate except for cache TTL” must never be described as immediate.

## 7. Authorization model and permission checks

### Security concepts

| Concept | Meaning | Authority |
|---|---|---|
| Identity | A local credential or external `(provider, subject)` assertion. | Go auth |
| User | Canonical internal security principal, identified only by stable `User.id`. | Go auth / application database |
| Profile/persona data | Username, avatar, campus, display fields, biography, locale, provider email. | Application/profile surface; never authorization authority |
| Global role | Current platform-wide `USER` or `PLATFORM_ADMIN`. | Go auth; reported by introspection |
| Project role | Current `OWNER`, `ADMIN`, or `MEMBER` for one project. | NestJS / application database |
| Scope | Delegated credential restriction, not a user/project role. | Deferred |
| Resource policy | Decision on one project/resource/action. | NestJS |

### Global roles

- `USER`: normal active account.
- `PLATFORM_ADMIN`: full audited operational access, including altering project membership and content.

The first `PLATFORM_ADMIN` can be provisioned by migration. If none exists, automatic bootstrap remains enabled until the first eligible registration atomically creates one. Once an administrator exists, automatic bootstrap closes. The final active platform administrator cannot be revoked, disabled, or deleted except through an audited migration-only break-glass procedure.

### Project policy

| Action | OWNER | ADMIN | MEMBER | PLATFORM_ADMIN |
|---|---:|---:|---:|---:|
| Read/contribute ordinary project content | Yes | Yes | Yes | Yes |
| Edit/delete any ordinary project content | Yes | Yes | Yes | Yes |
| Invite/remove MEMBERs | Yes | Yes | No | Yes |
| Promote/demote ADMINs | Yes | No | No | Yes |
| Transfer ownership | Yes, accepted by recipient | No | No | Yes |
| Delete project permanently | Yes | No | No | Yes |
| Manage project settings | Yes | Yes | No | Yes |

Any active account may create a project. Creation atomically makes the creator `OWNER`.

An owner transfer to an existing member requires recipient acceptance; the former owner becomes `ADMIN`. If an owner leaves, ownership automatically transfers to the next project `ADMIN` in deterministic order. If no project admin exists, ownership transfers to the longest-serving active `PLATFORM_ADMIN`, selected by role-grant time and then user ID. The recipient is granted/updated to `OWNER` transactionally and the exceptional transfer is audited.

Ordinary content is intentionally collaborative: every member may create, modify, and delete tasks, calendars, discovery blocks, and similar project content regardless of original author.

### NestJS authorization rule

Every protected controller begins with an introspected principal. Every domain operation then checks current state:

```text
requireAuthenticatedUser()
requireActiveAccount()
requireGlobalRole("PLATFORM_ADMIN")             // when relevant
requireProjectMembership(projectId)             // resource parent lookup
requireProjectRole(projectId, allowedRoles)     // when relevant
requireResourceBelongsToProject(resourceId, projectId)
```

User IDs always come from the principal, never a body/query/path value used as a substitute for identity. Queries must constrain child resources by both resource ID and authorized project ID.

## 8. WebSocket authentication and authorization

### Ticket flow

1. Frontend calls a bearer-authenticated endpoint such as `POST /auth/websocket-ticket`.
2. Go validates the access JWT using the normal authorization path and creates a random opaque ticket.
3. Server stores only:

```text
ticket_hash, sub, sid, audience, issued_at, expires_at, consumed_at
```

4. Ticket is bound to the user, session, intended WebSocket audience, and 60-second maximum expiry.
5. Browser connects to `/ws?ticket=<opaque-ticket>`.
6. nginx, backend, tracing, analytics, and error logs must redact query strings and never emit the full WebSocket URL.
7. NestJS/Go atomically consumes the ticket before accepting:

```sql
UPDATE "WebSocketTicket"
SET "consumedAt" = CURRENT_TIMESTAMP
WHERE "ticketHash" = $1
  AND "consumedAt" IS NULL
  AND "expiresAt" > CURRENT_TIMESTAMP
  AND "audience" = $2
RETURNING "sub", "sid", "audience";
```

8. Invalid, expired, reused, malformed, revoked, or audience-mismatched tickets reject the handshake.
9. Accepted socket state contains only the authenticated principal, not the ticket.

Access JWTs and refresh cookies are not accepted through the query parameter. If deployment cannot guarantee query-string redaction, use a dedicated short-lived WebSocket-ticket cookie instead.

### Connection authorization

- Require WSS outside local development.
- Validate browser `Origin` against the exact allowed origin before/at handshake.
- A connection maximum is 15 minutes; client obtains a new ticket and reconnects.
- Every project-room join and privileged message checks current project membership/role in NestJS.
- On a member removal in the initial single-backend deployment, the membership service directly evicts that user from the affected local room. Cross-instance propagation is deferred.
- Close connections for relevant session/account revocation and disablement events.

## 9. Data model and database changes

### User and identity

Extend `User` with:

- `status`: `ACTIVE`, `PENDING_APPROVAL`, or `DISABLED`;
- `globalRole`: `USER` or `PLATFORM_ADMIN`;
- security/revocation timestamps such as `accessNotBefore` where needed;
- existing profile fields retained on `User` but documented as non-authoritative.

`AuthIdentity` remains provider-specific and unique on `(provider, providerSubject)`. It maps to `User.id`; it does not supply domain authorization.

`PasswordCredential` retains Argon2id hashes. Password policy is 12-128 characters with no arbitrary composition rules. Frontend validation/hints, backend validation, API errors, and documentation must stay aligned.

### Refresh-token family

Replace the opaque-cookie session model with a device/session family model, while preserving a stable session ID (`sid`) for auditing and WebSockets:

- `AuthSession` or renamed `RefreshTokenFamily`: user ID, authentication method, assurance, creation time, idle/absolute expiry, revocation timestamp/reason, IP/user-agent metadata hashes, CSRF hash;
- `AuthRefreshToken`: family ID, token hash, issued/used/replaced/grace/expiry timestamps, predecessor/replacement relation, and replay-relevant state;
- indexes for active user families, token-hash lookup, expiry cleanup, and revocation operations.

Never persist raw refresh, access, CSRF, WebSocket, OAuth state, or one-time recovery tokens. Store SHA-256 hashes for opaque random values.

### OAuth, WebSocket, audit, and roles

- `OAuthTransaction`: provider, state hash, optional encrypted Google PKCE verifier, nonce hash, redirect URI, normalized return path, `purpose` (`LOGIN` or `LINK`), optional initiating user ID, creation/expiry, and atomic `consumedAt`.
- `WebSocketTicket`: hashed ticket, subject, session ID, audience, expiry, and atomic consumption timestamp.
- `AuthToken`: one-time email-verification/password-reset hash, expiry, and consumption state.
- `AuthEvent`: immutable redacted audit record with actor, target, event type, previous/new global role where relevant, optional reason, provider/session IDs, hashed IP metadata, and timestamp.
- `ProjectMemberRole`: add `OWNER` alongside `ADMIN` and `MEMBER`.

Audit events are retained for 180 days, then removed by a scheduled cleanup job.

### PostgreSQL access roles

Vault Database secrets engine issues renewable, dynamic 8-hour credentials for:

1. **Migration role:** DDL-capable Prisma migration execution only.
2. **Go auth runtime role:** authentication, identity, token/session, audit, global-role/account-status tables and required canonical-user security fields.
3. **NestJS runtime role:** project/resource/domain tables and the required user reads; no password credential access.

`make shell-db` remains a developer/operator path inside the database container using the bootstrap/superuser `POSTGRES_USER`. Runtime services never receive that credential. Production superuser use is an audited operational procedure.

## 10. Vault and secrets architecture

### Runtime authentication

Each Go/NestJS/migration workload:

1. receives a non-secret Role ID and an environment variable containing only the path to a mounted Secret-ID file;
2. reads the Secret ID from a protected Docker/deployment secret file;
3. authenticates using a least-privilege Vault AppRole;
4. receives a short-lived renewable Vault client token held only in memory;
5. renews leases before expiry and fails clearly if essential secret/credential renewal fails.

### Vault responsibilities

| Secret/material | Vault mechanism |
|---|---|
| JWT Ed25519 private key | Transit signing key; Go requests signatures, private material never leaves Vault |
| Public JWT keys | Go publishes internal JWKS containing active/previous public JWKs |
| OAuth client credentials | Vault KV secret with Go-only policy |
| PostgreSQL credentials | Vault Database secrets engine, renewable 8-hour service leases |
| Internal service credential / other runtime secrets | Vault KV or purpose-specific engine, least-privilege policy |

Vault initialization, unseal/key-custody design, and production runbook are intentionally deferred operational decisions. Vault must not be described as production-ready until those are approved.

## 11. Rate limiting and password protection

| Control | Initial policy |
|---|---|
| Login IP limit | 60/minute |
| Registration IP limit | 20/minute |
| Login normalized-email limit | 5/minute, regardless of source IP |
| Approved campus CIDRs | Five times only the IP limits; never bypass email limits or password-work concurrency |
| Campus CIDR configuration | Explicit deployment environment CIDR list, reviewed and deployed |
| Password work | Existing bounded Argon2id concurrency remains a global anti-DoS control |
| Future storage | In-process fixed-window limiter is accepted initially; shared/token-bucket rate limits are a later scaling hardening step |

The current in-process limiter resets on restart and is per replica. Its bounded map protects memory but can deny new keys after capacity exhaustion; this is accepted for the initial deployment and must be tested/documented.

## 12. Implementation phases

### Phase 0: Vault and operational prerequisite

- Vault AppRoles, policies, Secret-ID-file mounting, and direct client integration;
- Transit JWT-signing key and internal JWKS design;
- Database secrets engine, three database roles, 8-hour renewal behavior, Go/Prisma reconnection tests;
- deployment secret handling and `make shell-db` preservation;
- Vault initialization/unseal runbook remains a documented operational blocker.

### Phase 1: Account and authorization data model

- migrations for account status/global role, `OWNER`, refresh families/tokens, OAuth transaction purpose/consumption, WebSocket tickets, and audit fields;
- campus-domain eligibility and pending Google-account state;
- platform-admin bootstrap and last-admin invariant;
- centralized NestJS role/membership/resource policy helpers.

#### TR-69 persistence rollout

TR-69's migrations are forward-only. Before applying them, operators must
verify that every existing project has a member; a project without members
fails the migration rather than receiving a fabricated owner:

```sql
SELECT project.id
FROM "Project" AS project
WHERE NOT EXISTS (
  SELECT 1
  FROM "ProjectMember" AS member
  WHERE member."projectId" = project.id
);
```

For each eligible project, the migration promotes exactly one owner:
the oldest `ADMIN`, falling back to the oldest member, ordered by
`createdAt` and then `id`. A partial unique index then prevents a second
`OWNER`. Apply the migration through `make migrate`, which uses the
Vault-issued migration role and reapplies runtime grants afterwards.

Do not edit or replay a committed migration to recover from a failed
deployment. Resolve a failure before it is recorded and rerun `make migrate`;
after a recorded partial rollout, ship a reviewed corrective forward migration.
The current `AuthSession` opaque-cookie path remains authoritative throughout
this persistence rollout. The future refresh-family tables are inert until the
JWT/refresh cutover, so no browser cookie, session lifetime, or legacy session
lookup behavior changes merely by applying TR-69.

### Phase 2: JWT and refresh lifecycle

- Vault Transit-issued Ed25519 access JWTs and JWKS;
- in-memory browser token state and mandatory `apiClient`;
- refresh endpoint, CSRF adaptation, rotating family implementation, 5-second previous-token grace, replay revocation;
- versioned read-only Go introspection and NestJS bearer guard;
- 2-second configurable fail-closed timeout and basic metrics.

### Phase 3: Providers and account lifecycle

- 42 OAuth2 start/callback/profile flow;
- Google OIDC discovery, PKCE, nonce, verified-email/domain policy, pending approval;
- account linking, username-collision behavior, safe return paths;
- identity unlink, session inventory/logout-all, role/account-admin endpoints.

### Phase 4: WebSockets

- ticket issue/atomic consume;
- exact Origin validation and log redaction verification;
- principal connection state, room/message authorization, 15-minute reconnect;
- local membership-removal eviction and revocation disconnect hooks.

### Phase 5: Recovery and hardening

- email verification delivery and policy reconsideration;
- password reset/recovery UI and token flow;
- TOTP/recovery codes and assurance level;
- optional Redis/event-based revocation/cache implementation with explicit bounded-revocation semantics;
- multi-instance WebSocket invalidation, mTLS, distributed rate limiting, and production operational thresholds.

## 13. Security tests and failure cases

### Local credentials and rate limits

- Password lengths at 11, 12, 128, and 129; frontend/backend/error-message alignment.
- Campus-domain normalization, exact whole-domain matching, unsupported domains, and case/whitespace handling.
- Known and unknown account timing behavior; decoy hash use.
- Per-IP, per-account, campus-CIDR, limiter capacity, reset, restart, and concurrent Argon2-slot behavior.
- No browser-console warning/error on expected auth failures.

### JWT, refresh, and revocation

- Invalid signature, issuer, audience, `kid`, expiry, not-before, malformed claims, and unknown key.
- Access JWT never persists after refresh/reload; shared client attaches it correctly.
- Refresh success, idle expiry, absolute expiry, normal current-device logout, logout-all, family revocation.
- Concurrent refresh with immediate previous-token use inside and outside 5-second grace.
- Confirmed replay revokes all account families and makes introspection immediately reject access.
- Password reset preserves sessions as selected; disablement/unlink/replay revokes them.
- Introspection never writes ordinary-request session activity; Go timeout/outage/invalid response maps to `503`, never success.

### CSRF and XSS

- Missing/invalid Origin; missing/mismatched CSRF header/cookie; cross-site refresh/logout form.
- Bearer feature API does not accidentally accept refresh cookie authentication.
- CSP production build has no unsafe inline script dependency; rejected injected HTML/unsafe rendering.
- Tokens, provider codes, Secret IDs, and WebSocket tickets never appear in logs, metrics, errors, or browser console output.

### OAuth and linking

- State replay, expired transaction, callback replay, callback/provider mismatch, unsafe return paths.
- 42 code exchange/profile failures and immutable-subject lookup.
- Google wrong issuer/audience/nonce/signature, unverified email, `hd` mismatch, out-of-domain pending creation, and approval transition.
- Email-match automatic linking to unverified local identity is explicitly covered as accepted-risk behavior.
- Provider identity collision, username collision/retry, explicit linking, unlinking, and provider-token disposal.

### Authorization and WebSockets

- Default-deny protected controller coverage and public endpoint exceptions.
- IDOR tests for every project child resource, membership removal, `OWNER`/`ADMIN`/`MEMBER` boundaries, ownership transfer, owner departure, fallback platform-admin ownership, and permanent deletion.
- Platform-admin grant/revoke audit trail and final-administrator invariant.
- WebSocket ticket expiry/reuse/audience/subject/session mismatch, query redaction, Origin mismatch, connection lifetime, room-join authorization, privileged message authorization, membership removal eviction, and revocation disconnect.

### Vault and database

- AppRole policy denies cross-service secret access.
- Secret-ID file path is handled without logging the value.
- Vault Transit key rotation and JWKS overlap validate old and new access tokens correctly.
- Database credential issue/renewal/expiry triggers safe Go pool and Prisma reconnection.
- Runtime database roles cannot perform migration DDL or read password credentials outside authorization.

## 14. Outstanding operational decisions

These do not block review of the logical authentication model, but block production-readiness of their respective phases:

1. Vault initialization, unseal method, key-share custody, and emergency/root-token runbook.
2. Exact approved campus CIDR list and change-control owner.
3. Production hostnames and exact registered OAuth callback URIs.
4. Email-delivery provider and verification/reset delivery procedures.
5. Production nginx/logging/tracing configuration proving WebSocket query-string redaction.
6. Actual-workload operational thresholds for introspection latency/errors and any later caching decision.

## Links:

### Auth implementation features (decision records)
- [Authentication + Authorization Architecture](https://app.notion.com/p/7-Authentication-Authorization-Architecture-39cfe65eb3198128b7e7d8a2da92ef02)
- [7.1 Vault and runtime secrets foundation](https://app.notion.com/p/7-1-Vault-and-runtime-secrets-foundation-3a6fe65eb31981ec94d6c57f80b2cd44) — delivered.
- [7.2 Account, identity, and authorization data model](https://app.notion.com/p/7-2-Account-identity-and-authorization-data-model-3a6fe65eb31981fe80b8eea044302380) — in progress; persistence is partially delivered.
- [7.3 JWT browser session, refresh rotation, and apiClient](https://app.notion.com/p/7-3-JWT-browser-session-refresh-rotation-and-apiClient-3a6fe65eb31981eaae3ecf9b96b79b12) — follows the remaining 7.2 runtime work.
- [7.4 42 OAuth2 provider login and linking](https://app.notion.com/p/7-4-42-OAuth2-provider-login-and-linking-3a6fe65eb3198185a2b8e2b2f1d11508)
- [7.5 Google OIDC, campus eligibility, and approval](https://app.notion.com/p/7-5-Google-OIDC-campus-eligibility-and-approval-3a6fe65eb31981f2b7b8f2f8ae4f4790)
- [7.6 Account security, roles, and project ownership](https://app.notion.com/p/7-6-Account-security-roles-and-project-ownership-3a6fe65eb3198172a318fcffd927948c)
- [7.7 WebSocket tickets and realtime authorization](https://app.notion.com/p/7-7-WebSocket-tickets-and-realtime-authorization-3a6fe65eb3198187b551ca3a4c6c74b7)
- [7.8 Recovery, observability, and later hardening](https://app.notion.com/p/7-8-Recovery-observability-and-later-hardening-3a6fe65eb31981b5924af03d7b01ac2d)

### Taskrabbit tasks

- [TR-80: Enforce account status in current auth path](https://app.notion.com/p/Auth-7-2-1-Enforce-account-status-in-current-auth-path-3acfe65eb31981c18439fcf4f03fbc18)
- [TR-77: Vault runtime hardening and migration authoring](https://app.notion.com/p/Auth-7-1-Vault-runtime-hardening-and-migration-authoring-3a8fe65eb31981fca9d2d2a5290929b4)
- [TR-75: Recovery, observability, and later hardening](https://app.notion.com/p/Auth-7-8-Recovery-observability-and-later-hardening-3a6fe65eb319816e85b5dd9b5b451018)
- [TR-74: WebSocket tickets and realtime authorization](https://app.notion.com/p/Auth-7-7-WebSocket-tickets-and-realtime-authorization-3a6fe65eb31981a78724f7dd9467ee46)
- [TR-73: Account security, roles, and project ownership](https://app.notion.com/p/Auth-7-6-Account-security-roles-and-project-ownership-3a6fe65eb319819486cce1ad9b468aa9)
- [TR-72: Google OIDC, campus eligibility, and approval](https://app.notion.com/p/Auth-7-5-Google-OIDC-campus-eligibility-and-approval-3a6fe65eb31981bcafa3facca9edddc6)
- [TR-71: 42 OAuth2 provider login and linking](https://app.notion.com/p/Auth-7-4-42-OAuth2-provider-login-and-linking-3a6fe65eb31981cd9f60caa8478c5a63)
- [TR-70: JWT browser session, refresh rotation, and apiClient](https://app.notion.com/p/Auth-7-3-JWT-browser-session-refresh-rotation-and-apiClient-3a6fe65eb31981a89b15c7a9f8cd5297)
- [TR-69: Account, identity, and authorization data model](https://app.notion.com/p/Auth-7-2-Account-identity-and-authorization-data-model-3a6fe65eb319819c9b33f69efdd59e90)
- [TR-68: Vault and runtime secrets foundation](https://app.notion.com/p/Auth-7-1-Vault-and-runtime-secrets-foundation-3a6fe65eb3198193b339c06ca0f82f8c)

### Accepted decisions

- [Start here: the target authentication design](https://app.notion.com/p/Decision-Start-here-the-target-authentication-design-3a5fe65eb3198117bf5effa099ca1f12)
- [Browser sign-in, tokens, and logout](https://app.notion.com/p/Decision-Browser-sign-in-tokens-and-logout-3a5fe65eb31981278231e52210e3c3df)
- [42 and Google sign-in](https://app.notion.com/p/Decision-42-and-Google-sign-in-3a5fe65eb31981f7b608d61f3fc0366d)
- [Roles and project permissions](https://app.notion.com/p/Decision-Roles-and-project-permissions-3a5fe65eb31981f1abf7ca704f3dd299)
- [Go, NestJS, JWTs, and Vault](https://app.notion.com/p/Decision-Go-NestJS-JWTs-and-Vault-3a5fe65eb3198123bd10c0daffb3ad52)
- [WebSocket tickets and realtime permissions](https://app.notion.com/p/Decision-WebSocket-tickets-and-realtime-permissions-3a5fe65eb319812aa8d5d808cb7c68d2)
- [Data model, rollout, and security checks](https://app.notion.com/p/Decision-Data-model-rollout-and-security-checks-3a5fe65eb319810f8473c14fdfdc159a)
