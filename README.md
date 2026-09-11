# Internal API Documentation

A self-hosted Swagger UI for developers on a private network. All browser assets are served by this application; the deployed site does not depend on a public CDN.

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
| `/docs/` | Swagger UI |
| `/openapi.yaml` | Raw OpenAPI contract |
| `/health` | Deployment health check |

Run all checks with `npm run check`.

## Write your API contract

The API catalog is generated from `data/api_documentation_inventory.csv`. After replacing or editing that inventory, rebuild and validate the documentation:

```powershell
npm run generate
npm run validate
```

`openapi/openapi.yaml` is generated output and should not be edited by hand. Update `scripts/generate-openapi.js` when the inventory format or shared documentation metadata changes.

Each operation should normally include:

- a stable `operationId`;
- a short summary and appropriate tag;
- all path, query, header, and request-body inputs;
- success and expected error responses;
- realistic examples with no production secrets or personal data.

Validate after every contract change:

```powershell
npm run validate
```

The **Try it out** feature sends requests from the developer's browser directly to a URL listed in `servers`. It is disabled by default. To enable it, set `ENABLE_TRY_IT_OUT=true`; the target API must then allow the documentation site's origin through CORS.

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
