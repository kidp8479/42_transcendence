vault {
  address = "http://vault:8200"
}

auto_auth {
  method "approle" {
    config = {
      role_id_file_path = "/run/secrets/nginx-tls/role_id"
      secret_id_file_path = "/run/secrets/nginx-tls/secret_id"
      # The immutable, bootstrap-provided volume is read-only in this Agent.
      # Retain the SecretID so a restarted Agent can authenticate again.
      remove_secret_id_file_after_reading = false
    }
  }
}

template_config {
  static_secret_render_interval = "24h"
}

template {
  contents = <<EOF
{{ with pkiCert "pki/issue/local-dev" "common_name=localhost" "ip_sans=127.0.0.1" "ttl=72h" }}{{ .Key }}{{ .Cert }}{{ .CA }}{{ end }}
EOF
  destination = "/run/nginx-tls/local.pem"
  perms = "0644"
}

template {
  contents = <<EOF
{{ with pkiCert "pki/issue/paris-42-wildcard" "common_name=*.paris.42.school" "ttl=72h" }}{{ .Key }}{{ .Cert }}{{ .CA }}{{ end }}
EOF
  destination = "/run/nginx-tls/paris-42-wildcard.pem"
  perms = "0644"
}

template {
  contents = <<EOF
{{ with pkiCert "pki/issue/public-domains" "common_name=tomato.iops.dev" "alt_names=tomato-dev.iops.dev" "ttl=72h" }}{{ .Key }}{{ .Cert }}{{ .CA }}{{ end }}
EOF
  destination = "/run/nginx-tls/public-domains.pem"
  perms = "0644"
}
