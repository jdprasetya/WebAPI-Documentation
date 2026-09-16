const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const { parse } = require("csv-parse/sync");
const YAML = require("yaml");
const { createApp, normalizeBasePath } = require("../src/app");
const { apps } = require("../src/apps-config");
const { buildCatalog } = require("../src/build-catalog");
const { titleCase, normalizeInventoryRow } = require("../scripts/lib/docs-model");

const methods = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);
const openapiSource = fs.readFileSync("openapi/openapi.yaml", "utf8");
const openapiDocument = YAML.parse(openapiSource);
const inventoryRows = parse(fs.readFileSync("data/api_documentation_inventory.csv", "utf8"), {
  bom: true,
  columns: true,
  skip_empty_lines: true
});
const webappsOpenapiSource = fs.readFileSync("openapi/webapps.yaml", "utf8");
const webappsOpenapiDocument = YAML.parse(webappsOpenapiSource);
const webappsInventoryRows = parse(fs.readFileSync("data/webapps-api-inventory.csv", "utf8"), {
  bom: true,
  columns: true,
  skip_empty_lines: true
}).filter((row) => row.path);
const syncOpenapiSource = fs.readFileSync("openapi/sync-process.yaml", "utf8");
const syncOpenapiDocument = YAML.parse(syncOpenapiSource);
const syncInventoryRows = parse(fs.readFileSync("data/syncprocess-api-inventory.csv", "utf8"), {
  bom: true,
  columns: true,
  skip_empty_lines: true
}).filter((row) => row.path);
const budgetingOpenapiSource = fs.readFileSync("openapi/budgeting.yaml", "utf8");
const budgetingOpenapiDocument = YAML.parse(budgetingOpenapiSource);
const budgetingInventoryRows = parse(fs.readFileSync("data/budgeting-api-inventory.csv", "utf8"), {
  bom: true,
  columns: true,
  skip_empty_lines: true
}).filter((row) => row.path);

test("title-cases category and endpoint names", () => {
  assert.equal(titleCase("VoucherB2BCMSController"), "Voucher B2B CMS");
  assert.equal(titleCase("changePassword"), "Change Password");
  assert.equal(titleCase("getQRVoucherLmi"), "Get QR Voucher LMI");
  assert.equal(titleCase("AccountAuthController"), "Account Auth");
  assert.equal(titleCase("ITChecklist"), "IT Checklist");
  assert.equal(titleCase("MRPTicketing"), "MRP Ticketing");
  assert.equal(titleCase("Run Item SO Sync"), "Run Item SO Sync");
  assert.equal(titleCase("Run Item HPP Sync"), "Run Item HPP Sync");
  assert.equal(titleCase("Run MSDB Mail Maintenance"), "Run MSDB Mail Maintenance");
  assert.equal(titleCase("Generate Non MPP Report"), "Generate Non MPP Report");
  assert.equal(titleCase("Generate Non MPP BIN Report"), "Generate Non MPP BIN Report");
});

test("includes every API inventory operation", () => {
  const operationCount = Object.values(openapiDocument.paths).reduce(
    (count, pathItem) => count + Object.keys(pathItem).filter((key) => methods.has(key)).length,
    0
  );

  assert.equal(operationCount, inventoryRows.length);
  const operationIds = new Set();
  for (const row of inventoryRows) {
    const method = row.http_method === "ANY" ? "get" : row.http_method.toLowerCase();
    const operation = openapiDocument.paths[row.path]?.[method];
    assert.ok(operation, `Missing generated operation: ${row.http_method} ${row.path}`);
    assert.equal(operation["x-source-location"], row.source);
    assert.equal(operation["x-source-http-method"], row.http_method);
    assert.match(operation.summary, /^[A-Z0-9]/);
    assert.ok(operation["x-auth"]);
    assert.ok(operation["x-copy"]?.all);
    assert.ok(!operationIds.has(operation.operationId), `Duplicate operationId: ${operation.operationId}`);
    operationIds.add(operation.operationId);
  }
  assert.deepEqual(
    openapiDocument.paths["/api/account/auth/login"].post.requestBody.content["application/json"].schema.required,
    ["email", "password"]
  );
  assert.deepEqual(
    openapiDocument.paths["/api/account/auth/login"].post.requestBody.content["application/json"].example,
    {
      email: "analyst@example.com",
      password: "ReplaceWithYourPassword"
    }
  );
  assert.equal(
    openapiDocument.paths["/api/bogabot/uploadfile/{fileType}"].get.parameters[0].in,
    "path"
  );
  assert.equal(
    openapiDocument.paths["/api/cms/report/main/users/total"].get["x-source-http-method"],
    "ANY"
  );
  assert.equal(openapiDocument.paths["/api/account/auth/login"].post.summary, "Login");
  assert.equal(openapiDocument.paths["/api/account/auth/ping"].get["x-auth"].type, "Bearer JWT");
});

test("includes every WebApps inventory operation", () => {
  const operationCount = Object.values(webappsOpenapiDocument.paths).reduce(
    (count, pathItem) => count + Object.keys(pathItem).filter((key) => methods.has(key)).length,
    0
  );
  assert.equal(operationCount, webappsInventoryRows.length);
  assert.equal(webappsInventoryRows.length, 368);

  const operationIds = new Set();
  for (const raw of webappsInventoryRows) {
    const row = normalizeInventoryRow(raw);
    const method = row.http_method.toLowerCase();
    const operation = webappsOpenapiDocument.paths[row.path]?.[method];
    assert.ok(operation, `Missing generated WebApps operation: ${row.http_method} ${row.path}`);
    assert.equal(operation["x-source-location"], row.source);
    assert.equal(operation["x-source-http-method"], row.http_method);
    assert.equal(operation["x-app-area"], row.app_area);
    assert.match(operation.summary, /^[A-Z0-9]/);
    assert.equal(operation["x-auth"].type, "Public");
    assert.ok(operation["x-copy"]?.all);
    assert.ok(!operationIds.has(operation.operationId), `Duplicate operationId: ${operation.operationId}`);
    operationIds.add(operation.operationId);
  }

  assert.equal(webappsOpenapiDocument.info.title, "WebApps API Documentation");
  assert.ok(webappsOpenapiDocument.paths["/api/ATS/GetApplicantJobList"].post);
  assert.ok(webappsOpenapiDocument.paths["/api/VendorRequest/Vendor_List"].post);
  assert.equal(
    webappsOpenapiDocument.paths["/api/ATS/GetApplicantJobList"].post.tags[0],
    "ATS"
  );
  assert.equal(
    webappsOpenapiDocument.paths["/api/JobVacancy/ListJobVacancy"].post.tags[0],
    "ATS Job Vacancy"
  );
  assert.equal(
    webappsOpenapiDocument.paths["/api/Notification/SendNotif"].post.tags[0],
    "BogaBOT Notification"
  );
});

test("builds a category catalog with authentication first", () => {
  const catalog = buildCatalog(openapiDocument);
  const operationCount = catalog.categories.reduce((count, category) => count + category.operations.length, 0);
  assert.equal(operationCount, inventoryRows.length);

  const accountAuth = catalog.categories.find((category) => category.name === "Account Auth");
  assert.ok(accountAuth);
  assert.equal(accountAuth.authentication.title, "Authentication");
  assert.ok(accountAuth.authentication.summary);
  assert.ok(accountAuth.operations.some((operation) => operation.title === "Login"));
  assert.ok(accountAuth.operations.every((operation) => /^[A-Z0-9]/.test(operation.title)));
  assert.match(accountAuth.operations.find((operation) => operation.title === "Login").copy.curl, /curl -X POST/);
});

test("includes every Sync Process inventory operation", () => {
  const operationCount = Object.values(syncOpenapiDocument.paths).reduce(
    (count, pathItem) => count + Object.keys(pathItem).filter((key) => methods.has(key)).length,
    0
  );
  assert.equal(operationCount, syncInventoryRows.length);
  assert.equal(syncInventoryRows.length, 14);

  const operationIds = new Set();
  for (const raw of syncInventoryRows) {
    const row = normalizeInventoryRow(raw);
    const method = row.http_method.toLowerCase();
    const operation = syncOpenapiDocument.paths[row.path]?.[method];
    assert.ok(operation, `Missing generated Sync Process operation: ${row.http_method} ${row.path}`);
    assert.equal(operation["x-source-location"], row.source);
    assert.equal(operation["x-source-http-method"], row.http_method);
    assert.equal(operation["x-app-area"], row.app_area);
    assert.match(operation.summary, /^[A-Z0-9]/);
    assert.match(operation["x-auth"].type, /HTTP Basic/);
    assert.ok(operation["x-copy"]?.all);
    assert.ok(!operationIds.has(operation.operationId), `Duplicate operationId: ${operation.operationId}`);
    operationIds.add(operation.operationId);
  }

  assert.equal(syncOpenapiDocument.info.title, "Sync Process API Documentation");
  assert.equal(syncOpenapiDocument.paths["/healthz"].get.summary, "Health Check");
  assert.equal(syncOpenapiDocument.paths["/healthz"].get["x-auth"].type, "HTTP Basic");
  assert.deepEqual(syncOpenapiDocument.paths["/healthz"].get.security, [{ basicAuth: [] }]);
  assert.equal(syncOpenapiDocument.paths["/api/v1/sync/item-so/run"].post.summary, "Run Item SO Sync");
  assert.deepEqual(
    Object.keys(syncOpenapiDocument.paths["/api/v1/sync/item-so/run"].post.requestBody.content["application/json"].schema.properties),
    ["CompanyID", "BrandID", "OutletID"]
  );
  assert.deepEqual(
    syncOpenapiDocument.paths["/api/v1/sync/esb-bom/run"].post.requestBody.content["application/json"].schema.required,
    ["company_id"]
  );
  assert.equal(
    syncOpenapiDocument.paths["/api/v1/admin/audit/request-logs/purge"].post["x-auth"].type,
    "HTTP Basic + API Key"
  );
  assert.ok(
    syncOpenapiDocument.paths["/api/v1/admin/audit/request-logs/purge"].post.security[0].headerXAuditAdminKey
  );
  assert.ok(
    syncOpenapiDocument.paths["/api/v1/admin/audit/request-logs/purge"].post.security[0].basicAuth
  );
  assert.equal(syncOpenapiDocument.paths["/api/v1/sync/item/run"].post.tags[0], "Sync");
  assert.equal(syncOpenapiDocument.paths["/api/v1/admin/msdb-mail/maintenance/run"].post.tags[0], "Admin");
});

test("includes every Budgeting inventory operation", () => {
  const operationCount = Object.values(budgetingOpenapiDocument.paths).reduce(
    (count, pathItem) => count + Object.keys(pathItem).filter((key) => methods.has(key)).length,
    0
  );
  assert.equal(operationCount, budgetingInventoryRows.length);
  assert.equal(budgetingInventoryRows.length, 19);

  const operationIds = new Set();
  for (const raw of budgetingInventoryRows) {
    const row = normalizeInventoryRow(raw);
    const method = row.http_method.toLowerCase();
    const operation = budgetingOpenapiDocument.paths[row.path]?.[method];
    assert.ok(operation, `Missing generated Budgeting operation: ${row.http_method} ${row.path}`);
    assert.equal(operation["x-source-location"], row.source);
    assert.equal(operation["x-source-http-method"], row.http_method);
    assert.equal(operation["x-app-area"], row.app_area);
    assert.match(operation.summary, /^[A-Z0-9]/);
    assert.ok(operation["x-auth"]);
    assert.ok(operation["x-copy"]?.all);
    assert.ok(!operationIds.has(operation.operationId), `Duplicate operationId: ${operation.operationId}`);
    operationIds.add(operation.operationId);
  }

  assert.equal(budgetingOpenapiDocument.info.title, "Budgeting API Documentation");
  assert.equal(budgetingOpenapiDocument.paths["/"].get["x-auth"].type, "Public");
  assert.equal(budgetingOpenapiDocument.paths["/health"].get["x-auth"].type, "HTTP Basic");
  assert.equal(budgetingOpenapiDocument.paths["/api/v1/auth/token"].post.summary, "Issue Token");
  assert.equal(budgetingOpenapiDocument.paths["/api/v1/auth/check"].get["x-auth"].type, "Bearer JWT");
  assert.deepEqual(
    budgetingOpenapiDocument.paths["/api/v1/reports/non-mpp"].post.requestBody.content["application/json"].schema.required,
    ["closing_month"]
  );
  assert.equal(budgetingOpenapiDocument.paths["/api/v1/reports/non-mpp"].post.tags[0], "Reports");
  assert.equal(budgetingOpenapiDocument.paths["/api/v1/LoadBudgetingTable"].post.tags[0], "Budgeting");
  assert.equal(budgetingOpenapiDocument.paths["/api/v1/admin/audit-log/purge-stale"].post["x-auth"].type, "API Key");
  assert.ok(budgetingOpenapiDocument.paths["/api/v1/reports/non-mpp-PT"].post);
  assert.ok(budgetingOpenapiDocument.paths["/api/v1/reports/non-mpp-actual-pt"].post);
});

test("lists the four application menu options", () => {
  assert.deepEqual(apps.map((app) => app.id), ["boga-app", "webapps", "budgeting", "sync-process"]);
  assert.equal(apps[0].name, "Boga APP API");
  assert.equal(apps[0].hasCatalog, true);
  assert.equal(apps[1].name, "WebApps API");
  assert.equal(apps[1].subtitle, "MyBoga, VMS, ATS, BogaBOT");
  assert.equal(apps[1].hasCatalog, true);
  assert.equal(apps[2].name, "Budgeting API");
  assert.equal(apps[2].hasCatalog, true);
  assert.equal(apps[3].name, "Sync Process API");
  assert.equal(apps[3].hasCatalog, true);
});

test("normalizes deployment base paths", () => {
  assert.equal(normalizeBasePath("/internal/api-docs/"), "/internal/api-docs");
  assert.equal(normalizeBasePath("/"), "");
});

test("serves the reader portal, catalog, and Swagger UI", async (context) => {
  const app = createApp({ openapiDocument, openapiSource, basePath: "/portal" });
  const server = app.listen(0, "127.0.0.1");
  context.after(() => server.close());

  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  const healthResponse = await fetch(`${origin}/portal/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: "ok" });

  const specResponse = await fetch(`${origin}/portal/openapi.yaml`);
  assert.equal(specResponse.status, 200);
  assert.match(await specResponse.text(), /openapi: 3\.0\.3/);

  const docsResponse = await fetch(`${origin}/portal/docs/`);
  assert.equal(docsResponse.status, 200);
  const docsHtml = await docsResponse.text();
  assert.match(docsHtml, /<title>Boga API Documentation<\/title>/);
  assert.match(docsHtml, /id="sidenav"/);
  assert.match(docsHtml, /id="theme-toggle"/);
  assert.match(docsHtml, /boga-docs-theme/);
  assert.match(docsHtml, /href="#apps"/);
  assert.match(docsHtml, /Boga APP API/);
  assert.match(docsHtml, /WebApps API/);
  assert.match(docsHtml, /Budgeting API/);
  assert.match(docsHtml, /Sync Process API/);
  assert.match(docsHtml, /MyBoga, VMS, ATS, BogaBOT/);
  assert.doesNotMatch(docsHtml, /\{\{APPS_JSON\}\}/);
  assert.match(docsHtml, /\/portal\/assets\/boga-logo.webp/);
  assert.match(docsHtml, /\/portal\/docs\/catalog.json/);

  const catalogResponse = await fetch(`${origin}/portal/docs/catalog.json`);
  assert.equal(catalogResponse.status, 200);
  const catalog = await catalogResponse.json();
  assert.ok(Array.isArray(catalog.categories));
  assert.ok(catalog.categories[0].authentication.title === "Authentication");

  const webappsCatalogResponse = await fetch(`${origin}/portal/docs/apps/webapps/catalog.json`);
  assert.equal(webappsCatalogResponse.status, 200);
  const webappsCatalog = await webappsCatalogResponse.json();
  assert.equal(webappsCatalog.info.title, "WebApps API Documentation");
  const webappsCount = webappsCatalog.categories.reduce((count, category) => count + category.operations.length, 0);
  assert.equal(webappsCount, 368);
  assert.ok(webappsCatalog.categories.some((category) => category.name === "MyBoga Production"));
  assert.ok(webappsCatalog.categories.some((category) => category.name === "VMS Vendor Request"));

  const webappsSpecResponse = await fetch(`${origin}/portal/openapi/webapps.yaml`);
  assert.equal(webappsSpecResponse.status, 200);
  assert.match(await webappsSpecResponse.text(), /WebApps API Documentation/);

  const syncCatalogResponse = await fetch(`${origin}/portal/docs/apps/sync-process/catalog.json`);
  assert.equal(syncCatalogResponse.status, 200);
  const syncCatalog = await syncCatalogResponse.json();
  assert.equal(syncCatalog.info.title, "Sync Process API Documentation");
  const syncCount = syncCatalog.categories.reduce((count, category) => count + category.operations.length, 0);
  assert.equal(syncCount, 14);
  assert.ok(syncCatalog.categories.some((category) => category.name === "Health"));
  assert.ok(syncCatalog.categories.some((category) => category.name === "Sync"));
  assert.ok(syncCatalog.categories.some((category) => category.name === "Admin"));

  const syncSpecResponse = await fetch(`${origin}/portal/openapi/sync-process.yaml`);
  assert.equal(syncSpecResponse.status, 200);
  assert.match(await syncSpecResponse.text(), /Sync Process API Documentation/);

  const budgetingCatalogResponse = await fetch(`${origin}/portal/docs/apps/budgeting/catalog.json`);
  assert.equal(budgetingCatalogResponse.status, 200);
  const budgetingCatalog = await budgetingCatalogResponse.json();
  assert.equal(budgetingCatalog.info.title, "Budgeting API Documentation");
  const budgetingCount = budgetingCatalog.categories.reduce((count, category) => count + category.operations.length, 0);
  assert.equal(budgetingCount, 19);
  assert.ok(budgetingCatalog.categories.some((category) => category.name === "Health"));
  assert.ok(budgetingCatalog.categories.some((category) => category.name === "Authentication"));
  assert.ok(budgetingCatalog.categories.some((category) => category.name === "Reports"));
  assert.ok(budgetingCatalog.categories.some((category) => category.name === "Budgeting"));
  assert.ok(budgetingCatalog.categories.some((category) => category.name === "Admin"));

  const budgetingSpecResponse = await fetch(`${origin}/portal/openapi/budgeting.yaml`);
  assert.equal(budgetingSpecResponse.status, 200);
  assert.match(await budgetingSpecResponse.text(), /Budgeting API Documentation/);

  const logoResponse = await fetch(`${origin}/portal/assets/boga-logo.webp`);
  assert.equal(logoResponse.status, 200);
  assert.match(logoResponse.headers.get("content-type"), /^image\/webp/);

  const faviconResponse = await fetch(`${origin}/portal/favicon.ico`);
  assert.equal(faviconResponse.status, 200);
  assert.match(faviconResponse.headers.get("content-type"), /^image\/webp/);

  const swaggerConfigResponse = await fetch(`${origin}/portal/swagger/swagger-ui-init.js`);
  assert.equal(swaggerConfigResponse.status, 200);
  const swaggerConfig = await swaggerConfigResponse.text();
  assert.match(swaggerConfig, /\/portal\/openapi\.yaml/);
  assert.match(swaggerConfig, /\/portal\/openapi\/webapps\.yaml/);
  assert.match(swaggerConfig, /\/portal\/openapi\/budgeting\.yaml/);
  assert.match(swaggerConfig, /\/portal\/openapi\/sync-process\.yaml/);
});

test("exports an Express handler for Vercel without opening a listener", () => {
  const vercelApp = require("../src/app");

  assert.equal(typeof vercelApp, "function");
  assert.equal(vercelApp.listening, undefined);
});
