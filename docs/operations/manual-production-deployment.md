# Manual Deployment and Edge Operations Guide

## 1. Purpose and Scope

This document defines the manual deployment procedure for the Task Rabbit
application on the Fedora 44 VPS and the matching local validation
environment. It applies to the two isolated Compose deployments named
`transcendence-prod` and `transcendence-dev`, served respectively at
`https://tomato.iops.dev` and `https://tomato-dev.iops.dev`.

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

The VPS uses two TLS hops. Native Nginx owns the public ports and the
Certbot-managed public certificates. It terminates browser TLS on ports 80 and
443, then creates a second HTTPS connection to the relevant Compose ingress
on loopback. The Compose ingress runs the ModSecurity WAF, presents its
environment-specific Vault PKI certificate, serves the frontend, and proxies
application traffic to the backend and authentication services.

```text
Browser
  -> native Nginx on TCP 80/443, with a Certbot certificate
  -> HTTPS loopback bridge
       tomato.iops.dev     -> 127.0.0.1:8443
       tomato-dev.iops.dev -> 127.0.0.1:8444
  -> Compose Nginx with ModSecurity and a Vault PKI certificate
  -> frontend, backend, auth, PostgreSQL, Vault, and RustFS
```

The native Nginx bridge deliberately uses `proxy_ssl_verify off` only for its
same-host loopback upstream. The public edge and Compose ingress execute on
the same trusted VPS boundary, and no remote service may use this exception.
The bridge still sends SNI for the requested hostname. Native Nginx overwrites
all forwarded headers, so the Compose ingress and application receive a
trusted client address and scheme only when the request has crossed the
loopback bridge.

The production and development deployments must remain independent. They use
different Compose projects, volumes, databases, Vault instances, AppRole
credentials, runtime environment files, storage credentials, and application
origins. Development is a separate deployment, not a security boundary against
a compromised VPS.

## 3. Required Host State

The VPS shall run Fedora 44 with current security updates, Docker Engine with
the Docker Compose plugin, Nginx, Certbot with the Nginx plugin, firewalld,
Fail2ban, Git, Make, and the deployment user's required shell utilities. The
public firewall shall allow only TCP ports 22, 80, and 443. Docker must not
publish PostgreSQL, Vault, RustFS, or Docker's API to the network.

Routine deployments shall be performed by the non-root `deploy` user. The
application root is `/srv/transcendence`, with each environment retaining its
runtime configuration outside the Git checkout:

```text
/srv/transcendence/
  production/secrets/runtime.env
  development/secrets/runtime.env
  production/current/
  development/current/
```

The `secrets` directories must have mode `0700`, and each `runtime.env` file
must have mode `0600`. The files contain credentials and must not be copied
into `.env`, committed, printed, pasted into shell history, or transferred to
the local validation VM.

## 4. Runtime Configuration and Origin Policy

The production runtime file must set `APP_ORIGIN` to
`https://tomato.iops.dev` and `AUTH_JWT_ISSUER` to
`https://tomato.iops.dev/auth`. The development file must use
`https://tomato-dev.iops.dev` and `https://tomato-dev.iops.dev/auth`.
Production and development browser cookies must remain secure.

The direct school-evaluation mode uses
`https://*.paris.42.school:8443` for `APP_ORIGIN` and
`AUTH_JWT_ISSUER`. This is a deliberately narrow policy: it accepts exactly
one hostname label below `paris.42.school` on port 8443. It does not permit
arbitrary wildcard origins, suffix matching, wildcard ports, or request-derived
issuer values. A direct evaluation build must use relative API and WebSocket
URLs so it can operate on each permitted school hostname.

The development Compose override defaults to loopback ingress on ports 8081
and 8444. A local VM used for direct school evaluation may instead set
`APP_INGRESS_BIND_ADDRESS=0.0.0.0`, `APP_INGRESS_HTTP_PORT=8080`, and
`APP_INGRESS_HTTPS_PORT=8443` in its development runtime file. In that mode,
Fedora must allow these ports only from the VirtualBox host-only subnet. Those
VM-specific values must not be copied to the VPS runtime files.

## 5. Native Nginx and Certbot Procedure

The native edge configuration is installed on the VPS. It is not mounted into
containers and it is not rendered by Compose. Before requesting certificates,
install the bootstrap configuration and ensure both DNS A records resolve to
the VPS. The bootstrap configuration serves the ACME challenge and redirects
all other HTTP requests to HTTPS.

Install the files with root privileges, validate Nginx before reloading it,
and retain the prior working configuration until the new configuration has
been tested:

```sh
install -m 0644 ops/nginx/nginx.conf /etc/nginx/nginx.conf
install -m 0644 ops/nginx/vps-bootstrap.conf \
  /etc/nginx/conf.d/transcendence-bootstrap.conf
nginx -t
systemctl reload nginx

certbot --nginx -d tomato.iops.dev -d tomato-dev.iops.dev
```

After Certbot has issued both certificates, remove the bootstrap server
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
```

The initial deployment or an upgrade that includes database migrations must
run the matching migration target before normal use. The migration target also
applies the database runtime grants.

```sh
make migrate-deploy-prod
make migrate-deploy-dev
```

Demo data is optional and must be applied only to the intended environment.
It is added with `make seed-prod` or `make seed-dev`. The scoped reset targets
are destructive: `make rere-prod` and `make rere-dev` remove the relevant
Compose volumes, database data, RustFS data, and local images while preserving
the externally managed runtime environment file. A complete disposable reset
and seed sequence is therefore `make rere-prod seed-prod` or
`make rere-dev seed-dev`. Operators must never use these commands against data
that has not been backed up.

The production ingress binds only to
`127.0.0.1:${APP_INGRESS_PORT}` and normally uses port 8443. The development
VPS ingress normally binds only to 127.0.0.1 on port 8444. Native Nginx is
the only process permitted to expose the VPS application publicly.

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
Consequently, `make up`, `make deploy-dev`, and the direct school-evaluation
development deployment inspect and audit CRS matches without blocking the
request. This mode is used to observe legitimate application traffic and tune
narrow, documented CRS policy changes. A detection-mode audit event is not
evidence that the WAF rejected a request; application-origin or authorization
failures must be diagnosed separately.

The production override in `ops/compose/production.yml` sets
`MODSEC_RULE_ENGINE=On`. Consequently, `make deploy-prod` runs ModSecurity
and the OWASP Core Rule Set in blocking mode. Production audit logs are sent
to container standard output in JSON format with the configured `FH` parts.
Operators must not change the production rule engine to `DetectionOnly` as a
workaround for a false positive. They must instead reproduce the request in
development, identify the CRS rule, and commit the smallest route- and
rule-specific correction.

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

Production runs ModSecurity in blocking mode. Development uses detection mode
unless an evaluation deployment explicitly requires blocking mode. The custom
CRS policy permits only the REST methods used by the application:
`GET`, `HEAD`, `POST`, `OPTIONS`, `PATCH`, and `DELETE`. A valid authenticated
`PATCH` request must reach the backend; an unauthenticated request may return
an application `401`, but ModSecurity must not reject the method with a
generic WAF `403`.

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
| `ops/nginx/nginx.conf` | `/etc/nginx/nginx.conf`; the minimal global Nginx configuration that includes `conf.d` files. | Install during initial VPS or VM edge provisioning. Do not add application proxy rules here; keep them in the dedicated `conf.d` file. |
| `ops/nginx/vps-bootstrap.conf` | Temporary VPS `conf.d` server configuration for ACME HTTP-01 validation and HTTPS redirects. | Install before the first Certbot request. Remove it after the certificates are issued and before enabling `vps-edge.conf`. |
| `ops/nginx/vps-edge.conf` | `/etc/nginx/conf.d/transcendence-edge.conf`; production VPS virtual hosts, SNI rejection, public certificates, redirects, and environment-to-loopback routing. | Install after Certbot issuance. Maintain `tomato.iops.dev -> 127.0.0.1:8443` and `tomato-dev.iops.dev -> 127.0.0.1:8444`. |
| `ops/nginx/vps-bridge.inc` | `/etc/nginx/conf.d/transcendence-bridge.inc`; shared TLS bridge, forwarded-header, HSTS, WebSocket, and internal-auth blocking rules. | Install with `vps-edge.conf`. Do not use its disabled upstream verification for a remote upstream. |
| `ops/nginx/tomato-dev.local.conf` | A separate local Fedora VM `conf.d` configuration for the optional native bridge to the development Compose ingress on 127.0.0.1:8444. | Use only when validating the VPS-style bridge locally. It requires the local CA leaf at the exact documented `/srv/transcendence/edge/local-ca/` paths. Do not install it on the VPS or use it for direct school evaluation ingress. |

### 8.2 `nginx/`: Compose Ingress Files

The files in `nginx/` configure the Nginx process inside the
`docker.io/owasp/modsecurity-crs:4.28.0-nginx-202608050608` image. Compose
mounts the active templates read-only. Operators do not copy these files to
the host's `/etc/nginx`; changing them requires rebuilding or recreating the
affected Compose stack with its matching `make deploy-*` target.

| Repository file | Compose handling and purpose | Operator action |
| --- | --- | --- |
| `nginx/default.conf.template` | Mounted by the base and development Compose configuration as the direct ingress template. It accepts localhost, the project domains, and one-label school hostnames, and redirects accepted port-8080 requests to 8443. | Retain for local development and direct school evaluation. Do not use it as the production static frontend template. |
| `nginx/default.production.conf.template` | Replaces the development template in `ops/compose/production.yml`. It accepts only the public project domains, rejects unknown SNI, and serves the production topology. | Retain as the production override. It must remain paired with `FRONTEND_PORT=80`. |
| `nginx/includes/application-locations.conf.template` | Mounted as an included file in both ingress templates. It routes frontend, API, authentication, public API-token, and WebSocket traffic and applies sensitive-response cache controls, rate limits, redacted logs, and forwarding headers. | Treat as shared security-critical routing. Change it only when the relevant application routes and tests change. |
| `nginx/modsecurity/10-task-rabbit-config.conf` | Mounted as an OWASP CRS plugin configuration in both base and production Compose definitions. It extends the CRS allowed-method list for the application's `PATCH` and `DELETE` routes. | Retain this narrow policy. Do not replace it with a broad CRS disablement or route-independent exclusion. |
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

The Vite development configuration fixes its HMR client port at 8080, while
the active development ingress redirects port 8080 to TLS on port 8443. The
HMR protocol and port must be parameterized for the loaded HTTPS origin before
the TLS development topology can be considered equivalent to the deleted
HTTP-only standalone configuration.

## 10. Certificate Handling

The public Certbot certificates and the inner Vault PKI certificates serve
different purposes and must remain distinct. Public certificates belong to
native Nginx. The Vault agent issues the Compose ingress certificates into the
shared `vault_nginx_tls` volume: `local.pem`,
`paris-42-wildcard.pem`, and `public-domains.pem`. The direct ingress
templates select the appropriate file by SNI.

The local VM uses a locally trusted edge CA only for
`tomato-dev.iops.dev`. Trust that CA on the workstation when performing local
browser testing. Never copy a Certbot private key, a production Vault PKI key,
or a production runtime secret into the VM. For school evaluation, the
browser must trust the Vault PKI CA that issued the
`*.paris.42.school` certificate.

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
