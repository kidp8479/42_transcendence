path "database/creds/migration" {
  capabilities = ["read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Renew the dynamic database credential lease before it expires.
path "sys/leases/renew" {
  capabilities = ["update"]
}
