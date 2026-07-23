-- All privileges live on the static auth_runtime parent role (see
-- db/runtime-grants.sql) and the ephemeral lease role only inherits them, so
-- issuance works on a fresh database and new migrations are visible to live
-- leases immediately. NOTE: Vault splits these statements on semicolons, so
-- comments must never contain one.
CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}' IN ROLE auth_runtime INHERIT;
