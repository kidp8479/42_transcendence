-- All privileges live on the static backend_runtime parent role (see
-- db/runtime-grants.sql) and the ephemeral lease role only inherits them.
-- backend_runtime never has access to PasswordCredential. NOTE: Vault splits
-- these statements on semicolons, so comments must never contain one.
CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}' IN ROLE backend_runtime INHERIT;
