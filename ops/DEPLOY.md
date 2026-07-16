# Deploying Clothesline to Azure

> **Status: deployed and signing in.** `aspire deploy` runs green against a real
> subscription (61/61 steps) into `rg-clothesline-dev` / `southeastasia`, all five
> container apps run, and the identity origin serves on its custom domain:
>
> | Check | Result |
> |---|---|
> | web app | `HTTP 200` |
> | `GET /health` | `{"status":"ok","db":"ok"}` |
> | `GET /config` | real numeric `oidc_client_id` |
> | `https://identity.clothesline-dev.surbandev.network/debug/healthz` | `HTTP 200` |
> | OIDC issuer | `https://identity.clothesline-dev.surbandev.network` |
> | `/oauth/v2/authorize` | `302` → Login V2 with an auth request |
>
> The first real deploy surfaced a dozen defects that the publish-only dry run could
> not: they are fixed in `apphost.cs` and described in
> [Known issues](#known-issues-look-here-first). Read that section before changing
> anything there — several of the settings look arbitrary and are not.

> **Deploying from GitHub Actions rather than your own shell?** First wire the
> GitHub→Azure trust (federated credential, RBAC, repo secrets/variables) —
> see [`GITHUB-ACTIONS-SETUP.md`](./GITHUB-ACTIONS-SETUP.md). That doc hands back here
> for the domain-binding and post-deploy steps below.

## Prerequisites

| | |
|---|---|
| **Azure subscription** | with **Owner** or **User Access Administrator** — *not* plain Contributor. Aspire generates role assignments (the API's managed identity → Key Vault, the bootstrap job → Key Vault), and Contributor cannot create those. |
| **`az login`** | `aspire deploy` provisions through ARM with the ambient Azure credential. |
| **Aspire CLI** | ships in the dev container. `aspire --version` → 13.4.6. |
| **A domain you control** | plus access to its DNS. See below — this is not optional. |

## Decide the identity domain first

**This is the one decision you cannot defer.** Zitadel bakes `ExternalDomain`
into token issuers and session cookies at first boot, and resolves which instance
a request belongs to by matching the `Host` header against it. Deploy against one
domain and move later and every request returns `instance not found` — including
to the admin API you'd use to fix it.

Changing it afterwards is *recoverable but unpleasant*: you add the new domain to
the running instance via the System API **while the old one still resolves**,
promote it, update the OIDC app's redirect URIs, and everyone signs in again.

> **Never "just delete the instance and redeploy" once you have real users** — that
> drops every account. It is only the easy answer today because the instance is empty.

Pick `id.yourdomain.com` (or similar) now and use it consistently below.

## The shape of it (spec §2.2, §11)

| Environment | Contains |
|---|---|
| **identity-env** | Zitadel core, Login V2, `identity-proxy` (**the only public ingress**), the OIDC bootstrap Job, Postgres Flexible Server #1, Key Vault, an Azure Files share |
| **app-env** | web, API, Postgres Flexible Server #2, Blob Storage |

`aspire/Clothesline.AppHost/apphost.cs` is the single source of truth. `azd` is
**not** used — there's no `azure.yaml`; the Aspire CLI has its own pipeline. See
CLAUDE.md, "Aspire owns the deployment pipeline".

### Departure from spec §5.6a

The spec called for App Gateway / Front Door to give Zitadel core and Login V2 a
single origin. We use the **`identity-proxy` Caddy container** instead, published
as identity-env's public ingress with both backends internal-only. ACA can't
path-route across apps, but a proxy inside it can — and it's the same proxy the
e2e suite drives on every run. Recorded in spec §5.6a.

## Supplying parameters

Aspire resolves parameters from the **`Parameters:` configuration section**, so the
environment-variable form is `Parameters__<name>` (standard .NET double-underscore
separator). Interactively, `aspire deploy` prompts for anything missing.

Both parameter names contain a hyphen, which is **not a legal character in a shell
variable name** — `export Parameters__identity-domain=…` fails outright with
`not a valid identifier`, the value never reaches Aspire, and the deploy then
blocks on the prompt described below. Pass them with `env` instead, which has no
such restriction:

```bash
env 'Parameters__identity-domain=id.example.com' \
    'Parameters__bind-identity-domain=false' \
    'Parameters__certificate-name=' \
    aspire deploy -e development
```

| Parameter | Meaning |
|---|---|
| `identity-domain` | The identity origin. **Required, and final at Zitadel's first boot.** |
| `bind-identity-domain` | `true` once the DNS records exist. Attaches the hostname to `identity-proxy`. Defaults to `false`. |
| `certificate-name` | The ACA managed certificate's name, once it has been issued. Empty flips the binding to `Disabled`. |

The last two are a three-pass sequence, not free-form — see [step 3](#3-bind-the-custom-domain--two-passes).

(In GitHub Actions the `env:` block sets these directly and the shell never sees
them as identifiers, so the workflow is unaffected.)

> There is **no `ASPIRE_PARAMETER_*` convention.** That form is silently ignored,
> and an unattended deploy then blocks forever on a prompt that never comes.

## Supplying the Azure target

`az login` is **not sufficient** — Aspire does not infer the subscription from the
CLI's active account. Without these it fails in `create-provisioning-context` with
*"An Azure subscription id is required. Set the Azure:SubscriptionId configuration
value."*

```bash
export Azure__SubscriptionId="$(az account show --query id -o tsv)"
export Azure__Location="southeastasia"
export Azure__ResourceGroup="rg-clothesline-dev"   # optional; Aspire derives one otherwise
```

These names are plain identifiers, so `export` is fine for them.

## 1. Dry run — free, touches nothing

```bash
aspire publish -o ./artifacts
```

Renders the complete Bicep without a subscription. Read it before spending money.
This currently succeeds, 13/13 steps.

## 2. Deploy

```bash
az login
env 'Parameters__identity-domain=id.example.com' 'Parameters__certificate-name=' \
    aspire deploy -e development
```

Provisions both environments, both Postgres servers, Key Vault, ACR and the Azure
Files share; builds and pushes the five images; deploys the container apps and the
bootstrap job.

> ⚠️ **`aspire deploy` does NOT run migrations and does NOT register the OIDC app.**
> Those are steps 4 and 5. Skip them and you get an API with no schema and a web
> app with no client id. `.github/workflows/deploy.yml` does them in the right
> order; by hand, you must do them yourself.

**Deploy to a throwaway environment and subdomain first.** A wrong `ExternalDomain`
on a real deployment is expensive to undo (see above).

## 3. Bind the custom domain — two passes

**Until this is done, nobody can sign in.** Zitadel resolves its instance from the
host and stamps that domain into its token issuer, so the browser has to reach it at
`identity-domain` — not at the generated ACA FQDN. Everything else (web, API,
database, bootstrap) works before this step; authentication does not.

The domain binds to **`identity-proxy`**, the identity environment's only public
ingress. It takes **three passes**, because Azure's preconditions form a chain and
each pass satisfies the next one's:

| Pass | Parameters | What it achieves |
|---|---|---|
| 1 | `bind-identity-domain=false`, `certificate-name=` | App exists on its generated FQDN → this is what produces the CNAME target **and** the verification id. |
| 2 | `bind-identity-domain=true`, `certificate-name=` | DNS now resolves, so the hostname attaches (binding `Disabled`). |
| 3 | `bind-identity-domain=true`, `certificate-name=<name>` | Certificate exists → binding flips to `SniEnabled`, HTTPS serves. |

Two Azure rules make this irreducible, and they point in opposite directions:

- Azure validates domain ownership **the moment the hostname is attached** — even for
  a `Disabled` binding — so it cannot be attached before DNS exists
  (`InvalidCustomHostNameValidation`). And DNS cannot exist before pass 1, because the
  records need a verification id and an FQDN that the app itself creates.
- Azure **refuses to issue a managed certificate for a hostname that is not already
  attached** to an app in the environment (`RequireCustomHostnameInEnvironment`). So
  the certificate cannot come before the attach either.

Hence attach and certificate are gated by *separate* parameters. Don't collapse them.

### Pass 1 — the deploy you already did

With `Parameters__certificate-name` empty. `identity-proxy` comes up on its generated
FQDN with no custom domain attached. Now read the two values the DNS records need:

```bash
rg=rg-clothesline-dev        # the resource group you deployed into

az containerapp show -g "$rg" -n identity-proxy --query "{
    cname_value: properties.configuration.ingress.fqdn,
    txt_value:   properties.customDomainVerificationId
  }" -o yaml
```

- **`cname_value`** — the app's ACA hostname, e.g.
  `identity-proxy.bluewave-1cb694bd.southeastasia.azurecontainerapps.io`. This is what
  the CNAME points at.
- **`txt_value`** — a 64-character hex string that proves to Azure you control the
  domain. It is a property of the *container app*, which is why it cannot be known
  before pass 1.

> `customDomainVerificationId` is stable for the life of the container app, but it is
> **not** the same across apps or subscriptions — don't copy one from elsewhere.

### Create the DNS records

At your DNS provider, for `identity-domain = identity.clothesline-dev.surbandev.network`
(the record *names* are relative to the zone `surbandev.network`):

| Type | Name | Value |
|---|---|---|
| `CNAME` | `identity.clothesline-dev` | the `cname_value` above |
| `TXT` | `asuid.identity.clothesline-dev` | the `txt_value` above |

The `asuid.` prefix is Azure's convention and is not optional. Confirm both resolve
before continuing — Azure will reject the certificate otherwise, and DNS propagation
is the slow part:

```bash
domain=identity.clothesline-dev.surbandev.network
dig +short CNAME "$domain"          # → the ACA FQDN
dig +short TXT   "asuid.$domain"    # → the verification id
```

### Pass 2 — attach the hostname

Now that DNS resolves, deploy again with `bind-identity-domain=true` and the
certificate still empty. This attaches the hostname with its binding `Disabled` —
which is the precondition Azure wants before it will issue a certificate for it.

```bash
env "Parameters__identity-domain=$domain" \
    "Parameters__bind-identity-domain=true" \
    "Parameters__certificate-name=" \
    aspire deploy -e development

# confirm: bindingType Disabled, no certificate yet
az containerapp show -g "$rg" -n identity-proxy \
  --query "properties.configuration.ingress.customDomains" -o json
```

### Pass 3 — certificate, then redeploy with it

Create the managed certificate (free, auto-renewing; Azure validates it against the
DNS records). Issuance took ~4 minutes here, and it is `Pending` until it doesn't:

```bash
env_name=$(az containerapp show -g "$rg" -n identity-proxy \
  --query "properties.environmentId" -o tsv | awk -F/ '{print $NF}')

az containerapp env certificate create -g "$rg" -n "$env_name" \
  --hostname "$domain" --validation-method CNAME

# wait for Succeeded
az containerapp env certificate list -g "$rg" -n "$env_name" \
  --query "[].{name:name,subject:properties.subjectName,state:properties.provisioningState}" -o table
```

Then deploy with its **name** (an autogenerated `mc-…` string, not the domain):

```bash
cert=$(az containerapp env certificate list -g "$rg" -n "$env_name" \
  --query "[?properties.subjectName=='$domain'].name | [0]" -o tsv)

env "Parameters__identity-domain=$domain" \
    "Parameters__bind-identity-domain=true" \
    "Parameters__certificate-name=$cert" \
    aspire deploy -e development
```

(Remember the `env '…=…'` form — `export` cannot set these names. And re-run
[step 5](#5-register-the-oidc-app) afterwards: every deploy re-seeds the
`oidc-client-id` placeholder, so sign-in stays broken until you do.)

The binding comes up `SniEnabled` and `https://identity.clothesline-dev.surbandev.network`
is live. The AppHost emits exactly this conditional — see `identity-proxy.bicep`:
`bindingType: (certificate_name != '') ? 'SniEnabled' : 'Disabled'`.

> **If a push fails with `authentication required` from ACR**, the registry token has
> gone stale (long sessions do this, and Aspire's own login step still reports
> success). `az acr login -n <registry>` for both registries and re-run the deploy.

Then confirm the identity origin actually answers, which is the real test that DNS,
the certificate and Zitadel's `ExternalDomain` all agree:

```bash
curl -fsS "https://$domain/debug/healthz"                       # Zitadel is reachable at its own domain
curl -fsS "https://$domain/.well-known/openid-configuration" \
  | grep -q "\"issuer\":\"https://$domain\""                    # and the issuer matches
```

A 404 here means the host Zitadel saw did not match its `ExternalDomain` — check the
CNAME resolves to `identity-proxy` and that `identity-domain` is spelled identically
to what the first deploy baked in.

## 4. Migrate the database (**untested**)

Must happen **before** the API serves traffic (spec §11.2).

```bash
vault=$(az keyvault list -g "$rg" --query "[?starts_with(name,'pgapp')].name" -o tsv | head -1)
conn=$(az keyvault secret show --vault-name "$vault" \
  --name connectionstrings--clothesline-db --query value -o tsv)

cd src/backend/clothesline_db
uv sync --all-packages
ConnectionStrings__clothesline_db="$conn" DB_SSL_MODE=require \
  uv run alembic -c alembic.ini upgrade head
```

`DB_SSL_MODE=require` is not optional — Azure Postgres enforces TLS, and Aspire's
connection string carries no SSL mode.

## 5. Register the OIDC app

The client id doesn't exist until this runs against a live Zitadel, and the API
serves it to the browser over `GET /config`.

**Run this after every deploy, not once.** Each `aspire deploy` re-seeds the
`oidc-client-id` secret with the `pending-bootstrap` placeholder (the secret must
exist before the API's container app can be created at all — see Known issues), so
the job has to run again to put the real value back.

```bash
az containerapp job start -g "$rg" -n zitadel-oidc-bootstrap
```

Then get the API to pick the new secret up. **A revision restart does not do it**:
ACA resolves Key Vault secret references when a revision is *created* and caches
them for its lifetime, so a restarted revision keeps serving the old value —
`/config` goes on reporting `pending-bootstrap` and sign-in stays broken. Force a
new revision instead:

```bash
az containerapp update -g "$rg" -n clothesline-api --revision-suffix "bootstrapped$(date +%H%M%S)"
```

## 6. Smoke it

```bash
curl -fsS https://id.example.com/debug/healthz                  # Zitadel is up
curl -fsS "$api/health"  | grep -q '"db":"ok"'                  # API ↔ Postgres
curl -fsS "$api/config"  | grep -q '"oidc_client_id":"[0-9]'    # step 5 actually ran
```

That third check is the one people forget — a non-empty `oidc_client_id` is the only
proof the bootstrap job completed. If it's empty, the web app cannot sign anyone in.

Then open the web app and sign in for real.

## Teardown

```bash
aspire destroy -e Staging
```

> ⚠️ **This deletes the Postgres Flexible Servers, and therefore every user account.**
> There is no undo. On a real environment, put a delete lock on the identity server.

## Known issues, look here first

These were all found by the first real deploy and are **already fixed** in
`apphost.cs`. They are recorded because each one looks like a gratuitous setting
you might be tempted to "clean up", and every one of them is load-bearing.

0. **Zitadel panics on boot in ACA unless it identifies its machine by hostname.**
   Zitadel mints ids with Sonyflake, which by default derives a machine id from the
   container's private IP. On ACA that lookup finds nothing and Zitadel *panics* —
   `none of the enabled methods for identifying the machine succeeded`. It panics
   **after** writing its `migration.started` event, so the dead pod leaves the
   migration locked and every replacement pod waits on it forever ("migration already
   started, will check again in 5 seconds"). The IdP never serves, never writes its
   admin PAT, and Login V2 plus the bootstrap job hang behind it. Fixed with
   `ZITADEL_MACHINE_IDENTIFICATION_HOSTNAME_ENABLED=true` (+ `PRIVATEIP_ENABLED=false`).
   **This one masquerades as every other identity failure — check it first.**

   If a migration is already stuck, clear it before restarting Zitadel:
   `docker run --rm -e ZITADEL_DATABASE_POSTGRES_… ghcr.io/zitadel/zitadel:v4.15.3 setup cleanup --masterkey <key>`,
   and make sure only **one** Zitadel replica is alive when you do (see 0b).

0b. **Zitadel must be a singleton (`MaxReplicas = 1`).** Its boot-time setup is not
   concurrency-safe: replicas race the same migration, the losers time out in
   `checkExec` (`MIGR-as3f7`), and a replica scaled away mid-migration leaves the lock
   behind permanently.

0b2. **Login V2 must call Zitadel DIRECTLY in Azure, not through `identity-proxy`.**
   Those calls are gRPC. Caddy reverse-proxies HTTP/1.1 by default and the proxy's own
   ACA ingress is `http`, so the h2 frames don't survive the hop and every call fails
   with `protocol error: missing status` (gRPC code 13) — which surfaces as
   **"identity.… can't currently handle this request"**, a 500 on the sign-in page,
   with every other health check still green. `ZITADEL_API_URL` therefore points at
   Zitadel's own `Http2` ingress in publish, and only goes through the proxy in run
   mode (where the hop exists solely to rewrite `Host`, and where the header below has
   made that unnecessary anyway).

0c. **In Azure, Zitadel cannot resolve its instance from `Host`.** ACA's ingress
   *also* routes on `Host`: send the external domain and ACA 404s the request before
   Zitadel sees it; send the ACA hostname and Zitadel 404s it as "instance not found".
   Both callers (the bootstrap job over REST, Login V2 over gRPC) are stuck between
   the two. Fixed by pointing `ZITADEL_HTTP1HOSTHEADER` / `HTTP2HOSTHEADER` at
   `x-zitadel-forward-host`, so `Host` stays ACA's and the instance is named out of
   band. The Caddyfile and the bootstrap script send that header; publish-only, since
   locally there is no ingress in the way.

1. **The Azure Files share must be writable by Zitadel's non-root user.**
   Zitadel runs as `zitadel`, Login V2 as `nextjs`. Locally an init container
   `chmod 777`s the Docker volume; on an SMB share permissions come from *mount
   options*, not chmod. Fixed by setting `MountOptions` on each container app's
   volume (`dir_mode=0777,file_mode=0777,…`) — three images with three different
   users share the one mount. Without it Zitadel cannot write `/machinekey/*.pat`.

1b. **The managed-storage names collide.** Aspire names each one
   `take('managedstoragevolumes<resource>', 24)`, but that prefix is 21 characters —
   so `zitadel` and `zitadel-oidc-bootstrap` both truncate to
   `managedstoragevolumeszit` and ARM rejects the whole template ("defined multiple
   times"). They are renamed `machinekeys0/1/2` in `identityEnv.ConfigureInfrastructure`.
   That same block also fills in `accountName`/`accountKey`/`accessMode`, which Aspire
   omits — ACA rejects an `azureFile` that carries only a `shareName`.

1c. **The bootstrap job needs Key Vault *write*.** `WithReference(vault)` grants
   Secrets **User** (read-only), and the job's entire purpose is to write the
   client_id it just minted — it fails at the last step with
   `secrets/setSecret/action` denied. It is granted Secrets **Officer** explicitly.

2. **Aspire gives each resource its own file share.** `WithVolume` names the share
   after the *resource*, not the volume, so the three identity apps would each get a
   separate, empty share — Zitadel would write the PAT into its own and Login V2
   would never see it. Sign-in would break in Azure while working perfectly locally.
   The AppHost repoints them all at one share in `identityEnv.ConfigureInfrastructure`.
   Verify the deployed apps really do mount the same share.

3. **Migrations and the OIDC bootstrap are sequenced in CI, not in the AppHost.**
   Aspire 13.4 has a pipeline-step API (`PipelineStep`, `WithPipelineStepFactory`,
   `dependsOn` are in the assemblies; `aspire do <step>` drives them) but it is
   **undocumented**, so steps 4 and 5 above are driven by hand / by `deploy.yml`.
   Collapse them into `dependsOn` edges once Aspire documents it.

4. **`ConfigureCustomDomain` is an evaluation-only API** (`ASPIREACADOMAINS001`,
   suppressed in `apphost.cs`) — "subject to change or removal". If a future Aspire
   release drops it, the fallback is `az containerapp hostname add`.

5. **The custom domain cannot be attached on the first deploy.** Azure validates
   domain ownership even for a `Disabled` binding, and the DNS it wants cannot exist
   yet: the TXT record carries a verification id and the CNAME points at an FQDN, and
   neither exists until the app has been deployed once. Attaching it unconditionally
   makes a first deploy of a fresh environment *impossible*
   (`InvalidCustomHostNameValidation`). The binding is therefore gated on
   `certificate-name` being non-empty — pass 1 publishes on the generated FQDN, pass 2
   attaches the domain. Do not "simplify" that condition away.

6. **The web image's API URL comes from the environment's default domain, not from
   `api.GetEndpoint("https")`.** A container app's endpoint is not build-time
   resolvable — Aspire never feeds the provisioned FQDN back into the endpoint
   reference, so awaiting it while building the image hangs the deploy *forever* on
   `Building image: clothesline-web`, without ever invoking Docker. The URL is composed
   from the ACA environment's `defaultDomain` output instead (an external app's FQDN is
   deterministically `<app>.<defaultDomain>`), and the build step is ordered after the
   API's container app via the Pipelines API.

7. **Two settings that look like duplication and are not:** the API image bakes its
   uvicorn arguments into `CMD` (the published container app comes out with
   `args: null`, so `uvicorn` would start with no application and crashloop on
   `Error: Missing argument 'APP'`), and the web container app's ingress `targetPort`
   is overridden to **80** in publish (the model's 5173 is the *Vite dev server's*
   port; the published image is nginx, and ACA would route ingress to a port nothing
   listens on).

8. **`src/backend` is a uv workspace, and the Dockerfile Aspire generates for it is
   wrong.** Its dependency layer bind-mounts only `uv.lock` and the root
   `pyproject.toml`, so `uv sync --locked` cannot see the workspace members and fails
   ("`clothesline-db` … is not a workspace member"). The AppHost authors the Dockerfile
   with `WithDockerfileBuilder` instead. Note the callback *appends* to Aspire's
   generated stages and they cannot be removed, so ours are named `workspace-builder` /
   `workspace-app` and that stage is the published one — Docker's `--target` then never
   builds the broken generated layer.

5. **The OIDC bootstrap never updates an existing app.** `bootstrap_oidc_app.py`
   finds the app by name and returns its client id without reconciling
   `redirectUris` or `devMode`. Change the web origin and sign-in fails with
   `redirect_uri mismatch`, and re-running the job will **not** fix it. Bite this
   before the first domain change.

6. **Production email is deferred.** Zitadel has no SMTP in Azure, so verification
   and recovery mail will not send. Sign-in (email + password) still works.

7. **Blob CORS.** The browser PUTs photo bytes straight to Blob, so the storage
   account must allow the web app's real origin. The API sets this on startup from
   `ALLOWED_ORIGINS`; confirm it lands.
