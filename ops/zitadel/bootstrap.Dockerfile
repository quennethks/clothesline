# One-shot OIDC app registration against a live Zitadel.
#
# Registers the `clothesline-web` OIDC application and reports the client_id
# Zitadel generates for it. Runs as a throwaway container locally and as an
# Azure Container Apps *Job* in the cloud — same image, different trigger.
#
# Previously the script was bind-mounted and its deps pip-installed at runtime;
# neither survives ACA, and a network install on every start is fragile anyway.
FROM python:3.12-slim

RUN pip install --no-cache-dir httpx azure-identity azure-keyvault-secrets

COPY bootstrap_oidc_app.py /bootstrap/bootstrap_oidc_app.py

ENTRYPOINT ["python", "/bootstrap/bootstrap_oidc_app.py"]
