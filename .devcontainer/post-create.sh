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
(cd src/frontend/clothesline-e2e && npm ci)

echo "==> Installing Playwright Chromium + system deps"
# Browsers live outside $HOME so they survive a rebuild of the vscode user's
# volume; PLAYWRIGHT_BROWSERS_PATH is set in devcontainer.json so the test run
# finds them there too. --with-deps escalates via sudo for the apt packages.
PW_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
sudo mkdir -p "$PW_BROWSERS_PATH"
sudo chown -R "$(id -u):$(id -g)" "$PW_BROWSERS_PATH"
(cd src/frontend/clothesline-e2e && PLAYWRIGHT_BROWSERS_PATH="$PW_BROWSERS_PATH" npx playwright install --with-deps chromium)

curl -fsSL 'https://azurecliprod.blob.core.windows.net/$root/deb_install.sh' | sudo bash
curl -fsSL https://aka.ms/install-azd.sh | bash

echo "==> Dev container setup complete"
