# The single-origin identity proxy (spec §5.6a): /ui/v2/login/* → Login V2,
# everything else → Zitadel core.
#
# The Caddyfile used to be bind-mounted, which Azure Container Apps cannot do,
# so it is baked in here instead. Its {$VAR} placeholders are still resolved by
# Caddy from environment variables at *startup*, not at build time, so the same
# image serves localhost, Codespaces and the production identity domain.
FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
