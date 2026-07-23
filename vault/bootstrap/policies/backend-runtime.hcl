path "kv/data/internal/backend-auth" {
  capabilities = ["read"]
}

path "database/creds/backend-runtime" {
  capabilities = ["read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}
