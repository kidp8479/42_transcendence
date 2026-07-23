path "transit/sign/auth-access-jwt" {
  capabilities = ["update"]
}

# Public key material only; Go builds its internal JWKS from this read.
# Private key material is never readable or exportable.
path "transit/keys/auth-access-jwt" {
  capabilities = ["read"]
}

path "kv/data/auth/oauth" {
  capabilities = ["read"]
}

path "kv/data/internal/backend-auth" {
  capabilities = ["read"]
}

path "database/creds/auth-runtime" {
  capabilities = ["read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Renew the dynamic database credential lease before it expires.
path "sys/leases/renew" {
  capabilities = ["update"]
}

