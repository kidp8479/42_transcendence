CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';
GRANT USAGE ON SCHEMA public TO "{{name}}";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "User",
  "AuthIdentity",
  "PasswordCredential",
  "AuthSession",
  "OAuthTransaction",
  "AuthToken",
  "AuthEvent"
TO "{{name}}";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "{{name}}";
