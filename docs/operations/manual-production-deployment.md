# Manual Deployment and Edge Operations Guide

## 1. Purpose and Scope

This document defines three distinct manual deployment profiles for the Task
Rabbit application:

| Profile | Compose project, target, and release path | Runtime origin and issuer | Ingress and WAF | Browser certificate owner |
| --- | --- | --- | --- |
| VM development | `transcendence-dev`, `make deploy-dev`, `/srv/transcendence/development/current` | `https://tomato-dev.iops.dev`; `https://tomato-dev.iops.dev/auth` | Native Nginx only reaches Compose at `127.0.0.1:8081/8444`; blocking mode. | VM native Nginx owns the static public `tomato-dev.iops.dev` certificate. |
| School evaluation | `transcendence-school`, `make deploy-school`; local checkout or `/srv/transcendence/school/current` on the VM | `https://*.paris.42.school:8443`; `https://*.paris.42.school:8443/auth` | Direct Compose ingress on `0.0.0.0:8080/8443`; DetectionOnly mode; no native edge. | Compose Nginx presents the Vault-issued `*.paris.42.school` certificate. |
| Production | `transcendence-prod`, `make deploy-prod`, `/srv/transcendence/production/current` | `https://tomato.iops.dev`; `https://tomato.iops.dev/auth` | Native Nginx only reaches Compose on loopback; blocking mode. | VPS native Nginx owns the Certbot-managed `tomato.iops.dev` certificate. |

The document also defines ownership and handling of the native Nginx edge
configuration in `ops/nginx/` and the Compose ingress configuration in
`nginx/`. Operators shall follow these procedures from a reviewed checkout of
the deployment branch. Runtime secrets, certificates, and generated Nginx
configuration must never be committed to the repository.

The current release intentionally runs Vault in development mode. This is an
accepted, temporary risk for the student project while it contains no personal
data. It is not a production-grade Vault architecture and must be replaced
with a persistent, initialized, unsealed, backed-up Vault deployment before
the service processes personal data or becomes a long-lived public service.

## 2. Architecture

The VPS production and VM development profiles use two TLS hops. Native Nginx
terminates browser TLS on ports 80 and 443, then creates a second HTTPS
connection to the relevant Compose ingress on loopback. The VPS uses the
Certbot-managed `tomato.iops.dev` certificate; VM development uses a static
public `tomato-dev.iops.dev` certificate and private key. The Compose ingress
runs ModSecurity in blocking mode, presents its environment-specific Vault PKI
certificate, serves the frontend, and proxies application traffic to the
backend and authentication services.

```text
Browser
  -> native Nginx on TCP 80/443, with the profile's public certificate
  -> HTTPS loopback bridge
       VPS tomato.iops.dev -> 127.0.0.1:8443
       VM tomato-dev.iops.dev -> 127.0.0.1:8444
  -> Compose Nginx with ModSecurity and a Vault PKI certificate
  -> frontend, backend, auth, PostgreSQL, Vault, and RustFS
```

The school-evaluation profile does not use native Nginx or Certbot. It is
normally run by students on their school computers. A DevOps operator may run
the same profile manually on the VM, using the same path and commands, but it
remains a direct Compose deployment. Its ingress binds to `0.0.0.0:8080` and
`0.0.0.0:8443`, runs ModSecurity in DetectionOnly mode, redirects
accepted HTTP requests to the matching HTTPS school hostname, and presents the
Vault-issued `*.paris.42.school` certificate directly:

```text
Browser or evaluator
  -> Compose Nginx with ModSecurity on TCP 8080/8443
  -> frontend, backend, authentication, PostgreSQL, Vault, and RustFS
```

The native Nginx bridge deliberately uses `proxy_ssl_verify off` only for its
same-host loopback upstream. The public edge and Compose ingress execute on
the same trusted VPS or VM boundary, and no remote service may use this
exception. The bridge still sends SNI for the requested hostname. Native Nginx
overwrites all forwarded headers, so the Compose ingress and application
receive a trusted client address and scheme only when the request has crossed
the loopback bridge. Direct school ingress must not trust client-supplied
forwarded identity headers.

All three deployments must remain independent. They use different Compose
projects, volumes, databases, Vault instances, AppRole credentials, runtime
environment files, storage credentials, and application origins. Development
and school evaluation are separate deployments, not security boundaries
against a compromised host.

## 3. Required Host State

The VPS production profile requires Fedora 44 with current security updates,
Docker Engine with the Docker Compose plugin, Nginx, Certbot with the Nginx
plugin, firewalld, Fail2ban, Git, Make, and the deployment user's required
shell utilities. VM development requires the same host software except
Certbot: its native edge uses the managed static public certificate. Their
public firewalls shall allow only TCP ports 22, 80, and 443. Docker must not
publish PostgreSQL, Vault, RustFS, or Docker's API to the network.

A school computer requires Docker Engine with the Compose plugin, Git, Make,
and access for evaluators to TCP ports 8080 and 8443. It does not require
native Nginx or Certbot for this profile. `ops/compose/school.yml` publishes
only the Compose ingress; PostgreSQL, Vault, and RustFS remain unexposed.
HSTS is intentionally scoped to the VM-development and production native
Nginx edges. The local and direct school profiles still require TLS on 8443,
but do not persist HSTS for local CA and evaluation hostnames.

Routine deployments shall be performed by the non-root `deploy` user. The
application root is `/srv/transcendence`, with each environment retaining its
runtime configuration outside the Git checkout:

```text
/srv/transcendence/
  production/secrets/runtime.env
  development/secrets/runtime.env
  school/secrets/runtime.env
  production/current/
  development/current/
  school/current/
```

The `secrets` directories must have mode `0700`, and each `runtime.env` file
must have mode `0600`. The files contain credentials and must not be copied
into `.env`, committed, printed, pasted into shell history, or transferred to
the local validation VM.

The VM school release uses
`/srv/transcendence/school/secrets/runtime.env`. A school profile run from any
other checkout uses the ignored `.env.school` file in that checkout instead.
Run `make recreate-env-school` to generate the selected runtime file from
`.env.example` with fresh local secrets and the required school origin and
issuer. The VM `/srv/transcendence/school/secrets` directory is host
provisioning and must exist with mode `0700`; the target creates each runtime
file with restrictive permissions. It intentionally overwrites an existing
school runtime file; retain any evaluator-specific OAuth credentials before
running it and restore them afterward.

## 4. Runtime Configuration and Origin Policy

The production runtime file must set `NODE_ENV=production`, `APP_ORIGIN` to
`https://tomato.iops.dev`, and `AUTH_JWT_ISSUER` to
`https://tomato.iops.dev/auth`. The Fedora VM development runtime file must
set `NODE_ENV=development`, `APP_ORIGIN=https://tomato-dev.iops.dev`, and
`AUTH_JWT_ISSUER=https://tomato-dev.iops.dev/auth`. The school runtime file
must likewise set `NODE_ENV=development`. Production and development browser
cookies must remain secure.

## Edge Error Responses

Compose Nginx serves a no-store static HTML page only when the frontend
upstream is unavailable (`500`, `502`, `503`, or `504`). Application `/api`
and `/auth` errors remain JSON, including authentication, validation,
public-token, rate-limit, and availability responses. In blocking WAF
profiles, malformed JSON is a native ModSecurity `400`, not an Auth response.
The retained request error page is intentionally inactive because it would
mask that WAF result. Malformed requests, WAF blocks, WebSocket handshakes,
redirects, unknown-host `444` responses, and TLS handshake rejection retain
their native response behavior.

The school-evaluation runtime file must set:

```dotenv
APP_ORIGIN=https://*.paris.42.school:8443
AUTH_JWT_ISSUER=https://*.paris.42.school:8443/auth
```

`make deploy-school`, `make seed-school`, and `make rere-school` reject any
other values. `make deploy-dev`, `make seed-dev`, and `make rere-dev` likewise
require the exact `tomato-dev.iops.dev` origin and issuer above, without a
port. The VM development and production runtime files are externally managed:
their `recreate-env-*` targets validate an existing file and never generate or
replace secrets. This deliberately narrow school policy accepts exactly one
hostname label below `paris.42.school` on port 8443. It does not permit
arbitrary wildcard origins, suffix matching, wildcard ports, or
request-derived issuer values. The evaluation build uses relative API and
WebSocket URLs so it can operate on each permitted school hostname.

The Fedora VM development override remains loopback-only on ports 8081 and
8444 and must retain the `tomato-dev.iops.dev` origin. Do not convert
`deploy-dev` into a direct school deployment. The separate school override
always publishes `0.0.0.0:8080` and `0.0.0.0:8443`.

## 5. Native Nginx and Certbot Procedure

The native edge configuration is installed only on the VPS production or VM
development profile. It is not mounted into containers and it is not rendered
by Compose. The following bootstrap and Certbot procedure applies only to the
VPS production edge; ensure the `tomato.iops.dev` DNS A record resolves to the
VPS before requesting its certificate. VM development instead installs
`ops/nginx/tomato-dev.local.conf` with its managed static certificate. Never
install native edge files for direct school evaluation; `deploy-school` owns
its direct 8080/8443 ingress itself.

Install the files with root privileges, validate Nginx before reloading it,
and retain the prior working configuration until the new configuration has
been tested:

```sh
install -m 0644 ops/nginx/nginx.conf /etc/nginx/nginx.conf
install -m 0644 ops/nginx/vps-bootstrap.conf \
  /etc/nginx/conf.d/transcendence-bootstrap.conf
nginx -t
systemctl reload nginx

certbot --nginx -d tomato.iops.dev
```

After Certbot has issued the production certificate, remove the bootstrap server
configuration and install the edge configuration and its shared bridge
include. Do not leave the bootstrap and edge configuration active together,
because both define public HTTP servers for the same hostnames.

```sh
rm /etc/nginx/conf.d/transcendence-bootstrap.conf
install -m 0644 ops/nginx/vps-edge.conf \
  /etc/nginx/conf.d/transcendence-edge.conf
install -m 0644 ops/nginx/vps-bridge.inc \
  /etc/nginx/conf.d/transcendence-bridge.inc
nginx -t
systemctl reload nginx
```

Certbot owns the files below `/etc/letsencrypt/live/`. Operators shall renew
certificates through the installed Certbot renewal timer and shall not copy
the public private keys into containers, the repository, or the validation VM.
After any native configuration change, run `nginx -t` before reloading Nginx.

## 6. Compose Deployment Procedure

Deploy from the checked-out environment release directory. The Make targets
load the environment-specific runtime file and Compose override, validate the
rendered configuration, build the required images, and start the isolated
stack.

```sh
cd /srv/transcendence/production/current
make deploy-prod

cd /srv/transcendence/development/current
make deploy-dev

cd /srv/transcendence/school/current
make deploy-school
```

The initial deployment or an upgrade that includes database migrations must
run the matching migration target before normal use. The migration target also
applies the database runtime grants.

```sh
make migrate-deploy-prod
make migrate-deploy-dev
make migrate-deploy-school
```

Demo data is optional and must be applied only to the intended environment.
It is added with `make seed-prod`, `make seed-dev`, or `make seed-school`.
The scoped reset targets are destructive: `make rere-prod` and `make rere-dev`
remove only their respective Compose volumes, database data, RustFS data, and
local images while preserving the externally managed runtime environment file.
`make rere-school` performs the same stack reset and recreates
`/srv/transcendence/school/secrets/runtime.env` with fresh local secrets and
the required school origin and issuer. A complete disposable reset and seed
sequence is therefore `make rere-prod seed-prod`, `make rere-dev seed-dev`, or
`make rere-school seed-school`. Operators must never use these commands
against data that has not been backed up.

The production ingress binds only to
`127.0.0.1:${APP_INGRESS_PORT}` and normally uses port 8443. The VM
development ingress binds only to 127.0.0.1 on ports 8081 and 8444; its native
Nginx edge is the only public listener. The school profile, by contrast,
binds its direct ingress to 0.0.0.0 on ports 8080 and 8443 and has no native
edge. Both VM development and school evaluation use static frontend production
builds on port 80, production backend and authentication targets, and no
application-source bind mounts. Both also disable the RustFS console.

### 6.1 Image-Managed Service Discovery

The Compose ingress uses variable-based `proxy_pass` upstreams for the
frontend, backend, and authentication services. Nginx therefore requires a
resolver so it can recover when Docker or Podman recreates a service with a
different network address.

The pinned OWASP ModSecurity image provides this behavior through its built-in
`/docker-entrypoint.d/91-update-resolver.sh`. At container startup, the script
uses an existing `RESOLVERS` value or `DNS_SERVER` when one is supplied.
Otherwise, it reads every nameserver from the container's `/etc/resolv.conf`,
normalizes IPv6 addresses, and writes the resulting addresses into the
image-managed top-level Nginx `resolver` directive. Docker's embedded DNS and
Podman's aardvark-dns each publish their resolver through that file, so the
same image configuration works in both runtimes without hard-coding
`127.0.0.11` or another runtime-specific address.

The Compose setting `RESOLVER_CONFIG=valid=15s ipv6=off` is substituted by the
same image entrypoint into that directive. It limits resolver-cache validity
to 15 seconds and disables IPv6 DNS queries for the current deployment. Do
not add a repository entrypoint script to set `RESOLVERS`; it would duplicate
and potentially restrict the image's more complete resolver discovery. After
changing ingress or service-discovery configuration, recreate an upstream
container without restarting the ingress and confirm the affected route
recovers.

### 6.2 ModSecurity Operating Modes

The base Compose configuration sets `MODSEC_RULE_ENGINE=DetectionOnly`.
`ops/compose/school.yml` preserves that mode, so `make up` and
`make deploy-school` inspect and audit CRS matches without blocking the
request. This mode is used to observe legitimate application traffic and tune
narrow, documented CRS policy changes. A detection-mode audit event is not
evidence that the WAF rejected a request; application-origin or authorization
failures must be diagnosed separately.

The production and VM-development overrides set `MODSEC_RULE_ENGINE=On`.
Consequently, `make deploy-prod` and `make deploy-dev` run ModSecurity and the
OWASP Core Rule Set in blocking mode. Their audit logs are sent to container
standard output in JSON format with the configured `FH` parts. Operators must
not change either blocking profile to `DetectionOnly` as a workaround for a
false positive. They must instead reproduce the request in a safe environment,
identify the CRS rule, and commit the smallest route- and rule-specific
correction.

Both modes mount `nginx/modsecurity/10-task-rabbit-config.conf`. This shared
policy extends the CRS allowed-method set only for the application's supported
REST methods and does not disable CRS protections generally. In particular,
it permits `PATCH` and `DELETE` alongside `GET`, `HEAD`, `POST`, and
`OPTIONS`, so valid REST mutations reach application authorization rather than
being rejected solely because of their HTTP method.

## 7. Verification and Operational Checks

After deployment, confirm the relevant Compose project is running, then
verify the application through its public origin rather than only through an
internal container address. The HTTP endpoint must redirect to HTTPS, the
health endpoint must respond through the public edge, and a browser refresh on
a deep client-side route must return the application rather than a physical
file 404.

```sh
curl -I http://tomato.iops.dev/
curl --fail https://tomato.iops.dev/api/health
curl --fail https://tomato.iops.dev/auth/health
openssl s_client -connect tomato.iops.dev:443 -servername tomato.iops.dev \
  -showcerts </dev/null
```

Production and VM development run ModSecurity in blocking mode; school
evaluation uses DetectionOnly mode. The custom CRS policy permits only the
REST methods used by the application:
`GET`, `HEAD`, `POST`, `OPTIONS`, `PATCH`, and `DELETE`. A valid authenticated
`PATCH` request must reach the backend; an unauthenticated request may return
an application `401`, but ModSecurity must not reject the method with a
generic WAF `403`.

For direct school evaluation, replace `SCHOOL_HOST` with the actual
single-label school hostname and verify the published Compose ports directly;
there is no native edge or port-443 listener in this profile:

```sh
SCHOOL_HOST=f6r13s1.paris.42.school
curl -I "http://${SCHOOL_HOST}:8080/"
curl --fail "https://${SCHOOL_HOST}:8443/api/health"
curl --fail "https://${SCHOOL_HOST}:8443/auth/health"
openssl s_client -connect "${SCHOOL_HOST}:8443" -servername "${SCHOOL_HOST}" \
  -showcerts </dev/null
```

WebSocket access logs intentionally record `$uri` rather than `$request`.
This prevents one-use Socket.IO ticket query parameters from entering native
or Compose Nginx access logs. Operators shall not lower the `/ws` error-log
threshold or reintroduce `$request` into that log format.

## 8. File Ownership and Handling

### 8.1 `ops/nginx/`: Native Host Edge Files

The files in `ops/nginx/` are version-controlled source material for the
Fedora host's native Nginx service. They are copied to `/etc/nginx` or
`/etc/nginx/conf.d` during host provisioning. They are not mounted into
Compose containers. Changes require `nginx -t`, a controlled reload, and a
public-origin verification.

| Repository file | Host destination and purpose | Operator action |
| --- | --- | --- |
| `ops/nginx/nginx.conf` | `/etc/nginx/nginx.conf`; the minimal global Nginx configuration that includes `conf.d` files. | Install during initial VPS or VM edge provisioning. Do not add application proxy rules here; keep them in the dedicated `conf.d` file. Never install it for the direct school profile. |
| `ops/nginx/vps-bootstrap.conf` | Temporary VPS `conf.d` server configuration for ACME HTTP-01 validation and HTTPS redirects. | Install before the first Certbot request. Remove it after the certificates are issued and before enabling `vps-edge.conf`. |
| `ops/nginx/vps-edge.conf` | `/etc/nginx/conf.d/transcendence-edge.conf`; production VPS virtual hosts, SNI rejection, public certificates, redirects, and environment-to-loopback routing. | Install after Certbot issuance. Maintain only `tomato.iops.dev -> 127.0.0.1:8443`; the VPS does not run a `tomato-dev` deployment. |
| `ops/nginx/vps-bridge.inc` | `/etc/nginx/conf.d/transcendence-bridge.inc`; shared TLS bridge, forwarded-header, HSTS, WebSocket, and internal-auth blocking rules. | Install with `vps-edge.conf`. Do not use its disabled upstream verification for a remote upstream. |
| `ops/nginx/tomato-dev.local.conf` | A separate Fedora VM `conf.d` configuration for the native bridge to the development Compose ingress on 127.0.0.1:8444. | Install only on the VM. It requires the static public certificate and key at `/etc/nginx/tls/tomato-dev.iops.dev/`. Do not install it on the VPS or use it for direct school evaluation ingress. |

### 8.2 `nginx/`: Compose Ingress Files

The files in `nginx/` configure the Nginx process inside the
`docker.io/owasp/modsecurity-crs:4.28.0-nginx-202608050608` image. Compose
mounts the active templates read-only. Operators do not copy these files to
the host's `/etc/nginx`; changing them requires rebuilding or recreating the
affected Compose stack with its matching `make deploy-*` target.

| Repository file | Compose handling and purpose | Operator action |
| --- | --- | --- |
| `nginx/default.conf.template` | Mounted by the base Compose configuration and retained by the school override as the direct ingress template. It accepts localhost, the project domains, and one-label school hostnames, and redirects accepted port-8080 requests to 8443. | Retain for local development and direct school evaluation. The school profile pairs it with `FRONTEND_PORT=80`. Do not use it for VM development or production. |
| `nginx/default.production.conf.template` | Replaces the base template in both `ops/compose/development.yml` and `ops/compose/production.yml`. It accepts the public project domains, including `tomato-dev.iops.dev`, rejects unknown SNI, and serves the static frontend topology. | Retain for VM development and production. It must remain paired with `FRONTEND_PORT=80`. |
| `nginx/includes/application-locations.conf.template` | Mounted as an included file in both ingress templates. It routes frontend, API, authentication, public API-token, and WebSocket traffic and applies sensitive-response cache controls, rate limits, redacted logs, and forwarding headers. | Treat as shared security-critical routing. Change it only when the relevant application routes and tests change. |
| `nginx/modsecurity/10-task-rabbit-config.conf` | Mounted as an OWASP CRS plugin configuration in both base and production Compose definitions. It globally extends the CRS allowed-method list for the application's supported REST methods. | Retain this narrow policy. Do not replace it with a broad CRS disablement or route-independent exclusion. |
| `nginx/99-reload-on-certificate-change.sh` | Mounted as a container entrypoint script. It reloads the Compose Nginx process when the Vault agent renews the mounted inner certificate files. | Keep the file executable and mounted read-only. Do not restart the container solely to pick up routine Vault PKI renewal. |
The former standalone `nginx/nginx.conf` was deleted because it was not
mounted by any active Compose configuration and duplicated security-critical
routing in a second, stale source of truth. The current templates and shared
include are the sole Compose ingress configuration. No deployment migration or
compatibility support is retained for the deleted file.

## 9. Outstanding Ingress Gaps

The legacy configuration comparison identified three active configuration gaps
that must be resolved in the current templates rather than by restoring the
deleted standalone file. These items are recorded here so that operators do
not mistake the documented topology for a completed hardening baseline.

The Compose ingress currently overwrites the native edge's `X-Real-IP` with
its own peer address. On the VPS, this can cause login, registration, audit,
and Nginx rate-limit controls to treat all public clients as the bridge peer.
The ingress requires a narrowly scoped trusted-proxy design that accepts the
native edge client identity only for the VPS bridge path. Direct school
evaluation ingress must continue to reject client-supplied forwarded identity
headers.

The certificate reload entrypoint fingerprints `local.pem` and
`paris-42-wildcard.pem`, but not `public-domains.pem`, which is the inner
certificate selected by the production ingress. A renewal of that certificate
alone may remain inactive until another Nginx reload occurs. The reload
fingerprint must include all certificates used by the active ingress.

The local `make up` Vite development configuration fixes its HMR client port
at 8080 while its active ingress redirects port 8080 to TLS on port 8443. This
does not apply to VM development, which uses the static frontend production
target, but the HMR protocol and port must be parameterized before the local
TLS development topology can be considered equivalent to the deleted HTTP-only
standalone configuration.

## 10. Certificate Handling

The VPS Certbot certificate, VM static public certificate, and inner Vault PKI
certificates serve different purposes and must remain distinct. The public
certificates belong to native Nginx. The Vault agent issues the Compose ingress
certificates into the shared `vault_nginx_tls` volume: `local.pem`,
`paris-42-wildcard.pem`, and `public-domains.pem`. The direct ingress
templates select the appropriate file by SNI.

The local-only TLS and Nginx TLS-Agent credential volumes intentionally use
portable, lax permissions (`0777` for the certificate directory and `0644`
for rendered PEMs and AppRole credential files). This is an accepted
student-project tradeoff for Docker and rootless Podman UID compatibility:
only the bootstrap container, TLS Agent, and read-only Nginx mount receive
these volumes. It is not a production isolation boundary. Before introducing
untrusted workloads, persistent Vault, or a production deployment, assign the
Agent's UID/GID exclusive ownership and restrict directories and key material
to `0700` and `0600`, respectively. The Agent renews its 72-hour local
certificates every 48 hours, retaining a 24-hour recovery margin if an Agent
render is missed.

The Fedora VM uses a static copy of the public `tomato-dev.iops.dev` leaf and
private key at `/etc/nginx/tls/tomato-dev.iops.dev/`, with modes `0644` for
the full chain and `0600` for the key. It is not renewed on the VM. Before it
expires, an operator must re-export a valid certificate from a controlled
issuer or replace the VM testing approach. The key must not be copied to
workstations, the repository, or a school computer. For direct school
evaluation, the browser must trust the Vault PKI CA that issued the
`*.paris.42.school` certificate presented by the Compose ingress.

## 11. Maintenance, Recovery, and Limitations

Before changing the host edge, Compose ingress, certificates, or runtime
environment, retain a working release and record the deployed commit. A
failed deployment without a migration may return to the previous release after
the configuration has been validated. After a database migration, recovery
must use a reviewed forward migration or a tested restore; operators shall not
blindly revert application code against a newer schema.

Backups must include PostgreSQL data, RustFS data, the environment runtime
files, native Nginx configuration, and Certbot material. The future
production Vault design must add persistent Vault snapshots and tested
recovery. Backups must be encrypted, stored off-host, and restored into the
development environment before they are relied upon for production recovery.

This manual deployment model does not provide continuous delivery, high
availability, multi-host failover, automatic rollback, or a durable production
Vault. Those capabilities are intentionally outside the scope of the current
student-project deployment and require a separately reviewed design.
