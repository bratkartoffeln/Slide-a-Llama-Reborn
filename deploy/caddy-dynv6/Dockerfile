# Keep RPS's Caddy/module versions; replace only the dynv6 zone lookup locally.
FROM caddy:2.11.7-builder-alpine AS builder
COPY libdns-dynv6 /build/libdns-dynv6
RUN cd /build/libdns-dynv6 && go test ./...
RUN xcaddy build v2.11.7 \
    --with github.com/caddy-dns/dynv6@v0.0.0-20251101220214-71fad600afb2 \
    --with github.com/libdns/dynv6=/build/libdns-dynv6
FROM caddy:2.11.7-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY entrypoint.sh /usr/local/bin/slide-caddy-entrypoint
RUN chmod 755 /usr/local/bin/slide-caddy-entrypoint
ENTRYPOINT ["/usr/local/bin/slide-caddy-entrypoint"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
