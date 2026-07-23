-- DDL-capable migration credential. SET ROLE app_owner makes every object a
-- migration creates owned by the static app_owner parent, so ownership (and
-- the ability to ALTER/DROP in later migrations) survives lease expiry and
-- Vault's revocation DROP ROLE never hits dependent objects. NOTE: Vault
-- splits these statements on semicolons, so comments must never contain one.
CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}' IN ROLE app_owner INHERIT;
ALTER ROLE "{{name}}" SET ROLE app_owner;
