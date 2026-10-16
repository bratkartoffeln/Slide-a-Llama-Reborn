# Same pinned Caddy / dynv6 module versions as the existing RPS template.
FROM caddy:2.11.7-builder-alpine AS builder
RUN xcaddy build v2.11.7 \
    --with github.com/caddy-dns/dynv6@v0.0.0-20251101220214-71fad600afb2
FROM caddy:2.11.7-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY entrypoint.sh /usr/local/bin/slide-caddy-entrypoint
RUN chmod 755 /usr/local/bin/slide-caddy-entrypoint
ENTRYPOINT ["/usr/local/bin/slide-caddy-entrypoint"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
