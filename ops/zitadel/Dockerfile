# Zitadel core with its FirstInstance bootstrap steps baked in.
#
# The AppHost used to bind-mount init-steps.yaml from the host filesystem, which
# works locally and is impossible in Azure Container Apps — a container app has
# no host to mount from. Baking it into the image keeps one artifact that both
# `aspire run` and `aspire deploy` use, so the local graph and the e2e suite
# exercise exactly what gets deployed.
FROM ghcr.io/zitadel/zitadel:v4.15.3

COPY init-steps.yaml /init-steps.yaml
