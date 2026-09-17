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
5. Copy the **Header**, **Body (JSON)**, or response sample from the endpoint tabs.
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

## Maintainer guide

How to keep endpoint docs up to date. This guide lives in the repository only — it is not published on the portal.

### Which file to edit

Each menu card is backed by one inventory CSV. Edit only that app’s CSV. Do **not** hand-edit the generated OpenAPI YAML files.

| Menu card | Inventory CSV | Generated output |
| --- | --- | --- |
| Boga APP API | `data/api_documentation_inventory.csv` | `openapi/openapi.yaml` |
| WebApps API | `data/webapps-api-inventory.csv` | `openapi/webapps.yaml` |
| Budgeting API | `data/budgeting-api-inventory.csv` | `openapi/budgeting.yaml` |
| Sync Process API | `data/syncprocess-api-inventory.csv` | `openapi/sync-process.yaml` |

`data/webapps-api-area-summary.csv` is a count summary only. It is not used to generate documentation.

You can open the CSVs in Excel. Headers use short Title Case names (`Method`, `Path`, `Title`, `Auth Type`, and so on).

### How to update an API endpoint

1. Open the inventory CSV for that application.
2. Add a new row, edit an existing row, or delete a row you want removed from the portal.
3. Save the CSV (UTF-8 if your editor asks).
4. From the repo root, rebuild and check:

```powershell
npm run generate
npm run validate
```

5. Restart `npm run dev` if it is running, then refresh the browser.

Changing CSV rows updates endpoints **inside** an app. It does **not** add or remove the four cards on the home menu. Those cards are defined in `src/apps-config.js`.

Update `scripts/generate-openapi.js` and `scripts/lib/docs-model.js` only when the inventory format or shared documentation metadata changes.

Each operation should normally include:

- a clear `Title` (shown Title Case in the portal);
- authentication metadata (`Auth Type` / headers) so Authentication can appear first in the category;
- path, query, header, and request-body inputs where they apply;
- success and expected error codes;
- realistic examples with no production secrets or personal data.

Validate after every contract change:

```powershell
npm run validate
```

Or run the full suite with `npm run check`.

### Column reference (full inventories)

Used by Boga APP, Budgeting, and Sync Process.

| Column | What it does | Example |
| --- | --- | --- |
| `Method` | HTTP verb | `POST`, `GET`, `ANY` |
| `Path` | URL path | `/api/account/auth/login` |
| `Controller` | Category grouping and audience hints | `AccountAuthController` |
| `Title` | Endpoint display name | `changePassword` → Change Password |
| `Source File` | Code location for traceability | `…/AccountAuthController.java:114` |
| `Auth Type` | Auth classification (Bearer, Basic, Public, …) | `Bearer JWT (Authorization: Bearer <token>)…` |
| `Auth Headers` | Extra authentication header names | `X-CLIENT-KEY; X-SIGNATURE` |
| `Required Headers` | Headers callers must send | `Content-Type; X-TIMESTAMP` |
| `Optional Headers` | Headers callers may send | `X-BOGA-Key` |
| `Path Params` | Values inside `{…}` path segments | `fileType:String` |
| `Query Params` | Query-string inputs | `offset:int (required); limit:int (required)` |
| `Content Type` | Request body media type | `application/json` |
| `Body Type` | DTO / schema title for the body | `CmsChangePasswordRequest` |
| `Request Body` | Body fields for samples and required lists | `email:String; password:String` |
| `Validation` | Required-field hints in the description | `email: @NotBlank; password: @NotBlank` |
| `Success Codes` | Successful HTTP status codes | `200`, `201` |
| `Error Codes` | Documented error status codes | `400; 401` |
| `Error Messages` | Sample error text in docs | `Failed to get status data` |
| `Response Type` | Success sample shape (JSON vs plain text) | `ResponseEntity<Object>`, `String` |
| `App Area` | Top category (Budgeting / Sync; not on Boga CSV) | `Health`, `Sync` |
| `Category` | Sub-category under App Area | `Reports`, `Admin` |
| `App Error Codes` | Not used by the generator today | `ERROR_SUBSCRIPTION_INVALID` |
| `Notes` | Maintainer notes in the CSV; not shown in the portal | `Static source scan; …` |

### Column reference (WebApps)

WebApps uses a shorter inventory. Missing body/auth detail is filled with safe defaults during generation.

| Column | What it does | Example |
| --- | --- | --- |
| `App Area` | Product area: MyBoga, VMS, ATS, or BogaBOT | `ATS` |
| `Category` | Sidebar grouping within that area | `ATS` |
| `Method` | HTTP verb | `POST` |
| `Path` | URL path | `/api/ATS/GetApplicantJobList` |
| `Auth Type` | Auth classification (often public here) | `No visible handler-level auth` |
| `Headers` | Optional auth/header list (often empty) | *(blank)* |
| `Controller` | Source controller name | `ATSController` |
| `Handler` | Becomes the endpoint title | `GetApplicantJobList` |
| `Source File` | C# file path | `Boga.WebAPI/Controller/ATSController.cs` |
| `Line` | Appended to Source File for exact location | `367` |

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
