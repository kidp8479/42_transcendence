add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
proxy_hide_header Strict-Transport-Security;

proxy_http_version 1.1;
proxy_ssl_server_name on;
proxy_ssl_name $host;
# The upstream is an HTTPS listener on this host's loopback interface only.
proxy_ssl_verify off;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto https;
proxy_read_timeout 16m;
proxy_send_timeout 16m;

location = /auth/internal {
    return 404;
}

location ^~ /auth/internal/ {
    return 404;
}

location /ws {
    access_log /var/log/nginx/transcendence-ws-access.log ws_redacted;
    error_log /var/log/nginx/transcendence-ws-error.log crit;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_buffering off;
    proxy_pass https://$bridge_upstream;
}

location / {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_pass https://$bridge_upstream;
}
