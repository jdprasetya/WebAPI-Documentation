# Boga API Documentation

A self-hosted API reference for developers, System Analysts, and Support.
The reader portal starts with an application menu, then groups that app's endpoints by category, puts **Authentication** first in each category, and gives copy-ready curl, PowerShell, and JSON samples.

The deployed site serves its own browser assets and does not depend on a public CDN.

## Run locally

Requirements: Node.js 20 or newer and npm.

```powershell
npm install
npm run validate
npm run dev
```

Open <http://localhost:3000/docs/>. Restart the command and refresh the browser after changing `openapi/openapi.yaml` or server code.

Useful endpoints:

| URL | Purpose |
| --- | --- |
| `/docs/` | Application menu: Boga APP API, WebApps API, Budgeting API, Sync Process API |
| `/docs/#app/boga-app` | Boga APP API reader portal with category sidebar and copy-ready requests |
| `/docs/#app/webapps` | WebApps API reader portal for MyBoga, VMS, ATS, and BogaBOT |
| `/docs/#app/budgeting` | Budgeting API reader portal for auth, non-MPP reports, table load, and admin |
| `/docs/#app/sync-process` | Sync Process API reader portal for health, sync jobs, and admin maintenance |
| `/swagger/` | Swagger UI for schema exploration |
| `/openapi.yaml` | Raw OpenAPI contract for Boga APP API |
| `/openapi/webapps.yaml` | Raw OpenAPI contract for WebApps API |
| `/openapi/budgeting.yaml` | Raw OpenAPI contract for Budgeting API |
| `/openapi/sync-process.yaml` | Raw OpenAPI contract for Sync Process API |
| `/health` | Deployment health check |

Run all checks with `npm run check`.

## How to use the portal

The portal is written so non-developers can test an API without guessing headers or payloads.

1. Choose an application from the main menu. **Boga APP API**, **WebApps API**, **Budgeting API**, and **Sync Process API** are published catalogs.
2. Search or scan the **left sidebar** by category.
3. Open the category and read **Authentication** at the top.
4. Open an endpoint. Titles are **Title Case** and bold.
5. Use **Copy everything**, **Copy curl**, **Copy PowerShell**, or **Copy JSON**.
6. Replace placeholders such as `<access_token>` and `{baseUrl}` before sending the request.

Never paste production secrets, customer personal data, or live credentials into examples or tickets.

## Deploy to Vercel

Import the repository into Vercel and keep the framework preset set to **Other**.
No custom build or output-directory setting is required. The root URL redirects
to `/docs/`, and Vercel invokes the exported Express app in `src/app.js`.

Do not set `PORT`, `HOST`, or `OPENAPI_FILE` in Vercel. Those variables are for
the long-running local/Docker server; the serverless entry uses the bundled
`openapi/*.yaml` files. `BASE_PATH`, `TRUST_PROXY`, and
`ENABLE_TRY_IT_OUT` remain optional.

## Write your API contract

The API catalog is generated from inventory CSV files:

| File | Application |
| --- | --- |
| `data/api_documentation_inventory.csv` | Boga APP API |
| `data/webapps-api-inventory.csv` | WebApps API (MyBoga, VMS, ATS, BogaBOT) |
| `data/budgeting-api-inventory.csv` | Budgeting API |
| `data/syncprocess-api-inventory.csv` | Sync Process API |

After replacing or editing an inventory, rebuild and validate the documentation:

```powershell
npm run generate
npm run validate
```

`openapi/openapi.yaml`, `openapi/webapps.yaml`, `openapi/budgeting.yaml`, and `openapi/sync-process.yaml` are generated output and should not be edited by hand. Update `scripts/generate-openapi.js` and `scripts/lib/docs-model.js` when the inventory format or shared documentation metadata changes.

Each operation should normally include:

- a stable `operationId`;
- a Title Case summary and appropriate tag;
- authentication metadata that the portal can show first in the category;
- all path, query, header, and request-body inputs;
- success and expected error responses;
- realistic copy-ready examples with no production secrets or personal data.

Validate after every contract change:

```powershell
npm run validate
```

The **Try it out** feature in Swagger UI sends requests from the browser directly to a URL listed in `servers`. It is disabled by default. To enable it, set `ENABLE_TRY_IT_OUT=true`; the target API must then allow the documentation site's origin through CORS. The reader portal does not send live requests; testers copy the sample into Postman, curl, or PowerShell.

## Run with Docker

```powershell
docker compose up --build
```

Open <http://localhost:8080/docs/>. Stop it with `docker compose down`.

For an internal registry:

```powershell
docker build -t registry.example.internal/developer/api-docs:1.0.0 .
docker push registry.example.internal/developer/api-docs:1.0.0
```

Deploy that immutable tag on the internal server and expose container port `3000` through the organization's reverse proxy.

## Reverse proxy and internal security

Authentication and TLS should be enforced by the internal reverse proxy or identity-aware gateway. Network isolation alone is not authentication. Do not put API keys, real bearer tokens, customer data, or internal credentials in the OpenAPI examples.

If the proxy publishes this service at a prefix such as `https://developers.example.internal/api-docs`, set:

```text
BASE_PATH=/api-docs
TRUST_PROXY=true
```

Then configure the proxy to forward the prefix without stripping it. The UI will be at `/api-docs/docs/` and its health check at `/api-docs/health`.

Before deployment, replace both placeholder `example.internal` hostnames, confirm who can reach the site, configure TLS, and include `npm run check` in CI.
