#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing Aspire CLI"
if ! command -v aspire >/dev/null 2>&1; then
  dotnet tool install -g Aspire.Cli || {
    echo "ERROR: Failed to install Aspire workload. Run: dotnet workload install aspire"
    exit 1
  }
fi

echo "==> Syncing backend (uv) workspace"
(cd src/backend && uv sync --all-packages)

echo "==> Installing frontend dependencies"
(cd src/frontend/clothesline-web && npm ci)

echo "==> Dev container setup complete"
