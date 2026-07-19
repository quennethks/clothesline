# Setting up the GitHub Actions deploy

> **What this covers.** How to wire the trust and configuration that
> [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) needs before it can
> run: an Entra (Azure AD) app registration, an OIDC **federated credential** so GitHub
> can log in to Azure **without any stored secret**, the RBAC to let it provision, and the
> repository secrets/variables/environment the workflow reads.
>
> **What it does *not* cover.** Everything *after* login — supplying Aspire parameters, the
> three-pass custom-domain binding, database migrations, the OIDC bootstrap job, and smoke
> tests — lives in [`DEPLOY.md`](./DEPLOY.md). This doc ends where `DEPLOY.md` step 3
> begins. GitHub is only the trigger; *how* the app deploys is the Aspire AppHost's job
> (see [`CLAUDE.md`](../CLAUDE.md), "Aspire owns the deployment pipeline").
>
> `deploy.yml` is `workflow_dispatch`-only and **has not yet been run against a real
> subscription** — following this doc is what makes that first run possible.

## Coming from Azure DevOps?

The moving parts map across almost one-to-one; only the vocabulary changes.

| Azure DevOps | GitHub Actions (this repo) |
|---|---|
| Service connection (ARM) | `azure/login@v2` + an **OIDC federated credential** on an Entra app registration — no secret is stored anywhere |
| "Grant access to all pipelines" / approvals | GitHub **Environment** (`Production`) the job runs in |
| Pipeline variables | GitHub Actions **Variables** (`vars.*`) |
| Secret pipeline variables / variable groups | GitHub Actions **Secrets** (`secrets.*`) |
| `AzureCLI@2` task | plain `az` steps, already authenticated by `azure/login` |

The key shift: there is **no client secret to store and rotate**. GitHub mints a
short-lived OIDC token per run; Azure trusts it because of the federated credential you
create in [step 3](#3-federated-credential-the-trust).

## Prerequisites

| | |
|---|---|
| **Azure role** | **Owner** on the target subscription (or Contributor **+** User Access Administrator). Plain Contributor is **not enough** — see the callout in [step 2](#2-give-it-access-rbac). |
| **Entra tenant** | You need to be able to create an app registration in it. |
| **A domain you control** | Same one `DEPLOY.md` requires — decide `identity-domain` *first* (it is baked into Zitadel at first boot). See [`DEPLOY.md` › Decide the identity domain first](./DEPLOY.md#decide-the-identity-domain-first). |
| **`az` and `gh`** | Logged in on your own machine to run the one-time setup below: `az login` and `gh auth login`. |

Throughout, substitute your own values:

```bash
subscription_id=$(az account show --query id -o tsv)
tenant_id=$(az account show --query tenantId -o tsv)
repo=quennethks/clothesline
env_name=Production          # matches the workflow's default input
app_name=clothesline-github-deploy
```

## 1. App registration + service principal

This is the identity GitHub will act as.

**CLI**

```bash
# Create the app registration and capture its client (application) id.
client_id=$(az ad app create --display-name "$app_name" --query appId -o tsv)

# Create the service principal (enterprise application) for it.
az ad sp create --id "$client_id"

echo "AZURE_CLIENT_ID       = $client_id"
echo "AZURE_TENANT_ID       = $tenant_id"
echo "AZURE_SUBSCRIPTION_ID = $subscription_id"
```

**Portal**

1. **Microsoft Entra ID → App registrations → New registration.**
2. Name it `clothesline-github-deploy`, leave "Supported account types" as
   *single tenant*, no redirect URI. **Register.**
3. On the app's **Overview**, copy the **Application (client) ID** and **Directory
   (tenant) ID**. Get the **subscription ID** from **Subscriptions** in the portal.

Those three values become the GitHub **secrets** `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID` in [step 5](#5-secrets--variables).

## 2. Give it access (RBAC)

The workflow doesn't just call `aspire deploy`; it also provisions infrastructure and runs
two `az` fallback steps (a Key Vault read for migrations, an ACA job start + revision
restart for OIDC bootstrap). It needs to be **Owner**.

> ⚠️ **Owner, not Contributor.** Aspire generates role assignments during provisioning
> (the API's managed identity → Key Vault, the bootstrap job → Key Vault). **Creating role
> assignments requires Owner or User Access Administrator** — a Contributor deploy fails
> partway through with an authorization error. This is the same requirement as
> [`DEPLOY.md` › Prerequisites](./DEPLOY.md#prerequisites).

**CLI** (subscription scope; narrow to a resource group if you prefer):

```bash
az role assignment create \
  --assignee "$client_id" \
  --role Owner \
  --scope "/subscriptions/$subscription_id"
```

**Portal:** **Subscription → Access control (IAM) → Add role assignment → Owner →** assign
to the `clothesline-github-deploy` service principal.

> ⚠️ **Key Vault data plane is separate.** If your Key Vault uses **RBAC** authorization
> (the modern default), Owner grants management-plane rights but **not** permission to read
> secret *values* — so the migration step's `az keyvault secret show` fails with an access
> error. Grant the data role too. The vault doesn't exist until the first provision, so you
> may only be able to do this on a second pass, scoped to the vault:
>
> ```bash
> az role assignment create \
>   --assignee "$client_id" \
>   --role "Key Vault Secrets User" \
>   --scope "$(az keyvault list -g <resource-group> --query "[?starts_with(name,'pgapp')].id" -o tsv | head -1)"
> ```

## 3. Federated credential (the trust)

This is what lets GitHub log in with no secret. **The subject must match how the job runs**
— and the job runs *in an environment* (`environment: ${{ inputs.environment }}`), so the
subject is **environment-scoped**, not branch-scoped.

**CLI**

```bash
az ad app federated-credential create --id "$client_id" --parameters '{
  "name": "github-'"$env_name"'",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:'"$repo"':environment:'"$env_name"'",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

For `env_name=Production` that subject is exactly
`repo:quennethks/clothesline:environment:Production`.

**Portal:** App registration → **Certificates & secrets → Federated credentials → Add
credential → GitHub Actions deploying Azure resources.** Set **Organization**
`quennethks`, **Repository** `clothesline`, **Entity type** = **Environment**, **Environment
name** `Production`. Save.

> ⚠️ **Get the entity type right.** A `ref`/branch-scoped subject
> (`repo:…:ref:refs/heads/main`) will **not** match this workflow — login fails with *"No
> matching federated identity record found"*. It must be `environment:Production`.
>
> **Adding more environments later** (e.g. `Staging`): create one federated credential per
> environment, changing only `env_name`. The dispatch input's value must equal the
> environment name, the federated subject, and the GitHub Environment name — all three.

## 4. Create the GitHub Environment

The federated subject above references environment `Production`, and the workflow declares
`environment: ${{ inputs.environment }}`. Create it so both line up:

**Repo → Settings → Environments → New environment →** name it **`Production`**. (Add
required reviewers or protection rules here later if you want a manual gate.)

## 5. Secrets & variables

Set these at the **Environment** scope (recommended — each environment gets its own
values), or at the repository scope if you only ever deploy one environment.

### Secrets (5)

| Secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | the `client_id` from step 1 |
| `AZURE_TENANT_ID` | the `tenant_id` from step 1 |
| `AZURE_SUBSCRIPTION_ID` | the `subscription_id` from step 1 |
| `ZITADEL_MASTERKEY` | a freshly generated 32-char value — **see the callout below before generating one** |
| `PG_PASSWORD` | a freshly generated strong password — **see the callout below before generating one** |

```bash
gh secret set AZURE_CLIENT_ID       --env "$env_name" --repo "$repo" --body "$client_id"
gh secret set AZURE_TENANT_ID       --env "$env_name" --repo "$repo" --body "$tenant_id"
gh secret set AZURE_SUBSCRIPTION_ID --env "$env_name" --repo "$repo" --body "$subscription_id"

# Only for an environment this workflow will be provisioning FRESH — see the
# callout immediately below if that's not the case.
zitadel_masterkey=$(openssl rand -hex 16)   # 32 hex chars — matches apphost.cs's own generator constraint
pg_password=$(openssl rand -base64 24)
gh secret set ZITADEL_MASTERKEY --env "$env_name" --repo "$repo" --body "$zitadel_masterkey"
gh secret set PG_PASSWORD       --env "$env_name" --repo "$repo" --body "$pg_password"
```

> ⚠️ **`ZITADEL_MASTERKEY` and `PG_PASSWORD` are generate-once-ever, not generate-per-setup.**
> Unlike the three identity secrets above, these two back a *live encryption key and
> database password* the moment the first deploy runs — Zitadel encrypts everything it
> stores (PATs, and very plausibly its own signing keys) under `ZITADEL_MASTERKEY`, with
> no migration path if it later changes. Generating a fresh value here is only correct
> the **first time** this environment is ever deployed, by anyone, from anywhere.
>
> **If this environment has ever been deployed before** — by `aspire deploy` from
> someone's own checkout, per `DEPLOY.md`'s manual walkthrough — do **not** run
> `openssl rand` above. Pull the real values instead, from that checkout's own
> `~/.aspire/deployments/*/<environment-name>.json` (`Parameters:zitadel-masterkey` /
> `Parameters:pg-password`), and set the GitHub secrets to those. Getting this wrong
> silently orphans everything already encrypted under the real key — this exact incident
> already happened once during manual deployment; see `DEPLOY.md`'s "0g" known issue for
> the full mechanism and how it was recovered.

### Variables (5)

| Variable | First-run value | Notes |
|---|---|---|
| `AZURE_LOCATION` | e.g. `southeastasia` | Azure region to provision into. |
| `AZURE_RESOURCE_GROUP` | e.g. `rg-clothesline-prod` | Optional — Aspire derives one otherwise. |
| `IDENTITY_DOMAIN` | e.g. `id.example.com` | **Final at Zitadel's first boot** — decide it before deploying. Also used by the smoke step. |
| `IDENTITY_DOMAIN_BOUND` | *leave unset* (= `false`) | Flip to `true` only in pass 2 of the domain binding. |
| `IDENTITY_CERTIFICATE_NAME` | *empty* | Set to the managed cert's `mc-…` name only in pass 3. |

```bash
gh variable set AZURE_LOCATION        --env "$env_name" --repo "$repo" --body "southeastasia"
gh variable set AZURE_RESOURCE_GROUP  --env "$env_name" --repo "$repo" --body "rg-clothesline-prod"
gh variable set IDENTITY_DOMAIN       --env "$env_name" --repo "$repo" --body "id.example.com"
# IDENTITY_DOMAIN_BOUND and IDENTITY_CERTIFICATE_NAME: leave unset / empty for the first run.
```

Or set all of the above via the UI: **Settings → Environments → Production → Environment
secrets / Environment variables.**

> `IDENTITY_DOMAIN_BOUND` and `IDENTITY_CERTIFICATE_NAME` are **not** "set once and forget."
> They drive a three-pass domain/certificate sequence — first run leaves them empty, then
> you flip them across two more runs. The full flow is
> [`DEPLOY.md` › Bind the custom domain](./DEPLOY.md#3-bind-the-custom-domain--two-passes);
> don't re-derive it here.

## 6. Run it

**Repo → Actions → Deploy → Run workflow →** environment `Production` → **Run workflow.**

Watch the **"Azure login (federated)"** step: if it succeeds, the trust from steps 1–3 is
wired correctly. The run will provision, migrate, deploy, and smoke — but the smoke step
will not pass until the custom domain is bound. That's expected: hand off to
[`DEPLOY.md`](./DEPLOY.md) for the two remaining domain-binding passes and post-deploy
steps. On the first-ever deploy of a fresh environment, follow `DEPLOY.md` end to end —
several steps there are load-bearing and unobvious.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| *"No matching federated identity record found for … subject …"* at Azure login | The federated credential's subject doesn't match. It must be `repo:quennethks/clothesline:environment:Production` (**environment**, not `ref`), and a GitHub Environment named `Production` must exist — steps 3 and 4. |
| Login works, but provisioning fails with an **authorization / role assignment** error (`AuthorizationFailed`, `AADSTS700016`) | The service principal isn't **Owner** (or lacks User Access Administrator). Aspire creates role assignments; Contributor can't. Re-do [step 2](#2-give-it-access-rbac). |
| Migration step fails on `az keyvault secret show` with **access denied** | The SP lacks the Key Vault **data-plane** role under RBAC auth. Grant **Key Vault Secrets User** on the vault — the second callout in [step 2](#2-give-it-access-rbac). |
| *"An Azure subscription id is required. Set the Azure:SubscriptionId configuration value."* | This is Aspire, not the login — it reads `Azure__SubscriptionId/Location/ResourceGroup` from the workflow's `env:` block, which are already sourced from your secret/variables. Confirm `AZURE_SUBSCRIPTION_ID` (secret) and `AZURE_LOCATION` (variable) are set for the environment. |
| Deploy blocks forever with no output | Almost always a missing Aspire parameter prompting interactively. Confirm `IDENTITY_DOMAIN` is set (variable). See [`DEPLOY.md` › Supplying parameters](./DEPLOY.md#supplying-parameters). |
| The **"Register the OIDC application"** step's job fails, and Zitadel's own logs show a *decrypt* error (`CRYPT-OhN2u`, `CRYPT-Eep6o`, "illegal base64 data") rather than an auth/token error | `ZITADEL_MASTERKEY` doesn't match what's actually encrypted in the database — either it was never set (so a fresh one got minted this run) or it was set to a freshly-generated value against an environment that already existed. See the callout in [step 5](#5-secrets--variables) and `DEPLOY.md`'s "0g" known issue. |
