# The single-origin identity proxy (spec §5.6a): /ui/v2/login/* → Login V2,
# everything else → Zitadel core.
#
# The Caddyfile used to be bind-mounted, which Azure Container Apps cannot do,
# so it is baked in here instead. Its {$VAR} placeholders are still resolved by
# Caddy from environment variables at *startup*, not at build time, so the same
# image serves localhost, Codespaces and the production identity domain.
#
# Caddy is rebuilt here rather than used as-is, to add the replace-response
# plugin: the admin console's environment.json route in the Caddyfile needs to
# rewrite a response body, which stock Caddy cannot do. See that route for why.
# The plugin has no tagged releases, so it is pinned to a commit — an unpinned
# xcaddy build would make this image non-reproducible, and everything else in
# this repo (zitadel:v4.15.3, zitadel-login:v4.7.3) pins exactly.
FROM caddy:2.11.4-builder-alpine AS builder

RUN xcaddy build \
    --with github.com/caddyserver/replace-response@80962887e4c680abfd1b11ce1403fa8cc0fdd3d6

FROM caddy:2-alpine

COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
