-- Belt-and-braces revocation: reassign anything the lease role still owns to
-- the static parent before dropping it, so revocation cannot fail on
-- dependent objects and expired credentials never outlive their TTL. NOTE:
-- Vault splits these statements on semicolons, so comments must never
-- contain one.
REASSIGN OWNED BY "{{name}}" TO app_owner;
DROP OWNED BY "{{name}}";
DROP ROLE IF EXISTS "{{name}}";
