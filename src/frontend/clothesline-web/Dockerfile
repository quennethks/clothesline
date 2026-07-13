FROM node:lts-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Vite substitutes import.meta.env textually at build time, so the API's address
# has to be known here — it cannot be changed later by a container env var. The
# AppHost passes it from the provisioned ACA environment's domain.
#
# The OIDC issuer and client_id are deliberately NOT build args: Zitadel only
# generates the client_id once it is deployed and bootstrapped, well after this
# image is built. The app fetches those from the API's /config at boot, which
# can also correct this URL if the API ever moves (see src/runtimeConfig.ts).
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
