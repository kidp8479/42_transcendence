path "transit/sign/auth-access-jwt" {
  capabilities = ["update"]
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

