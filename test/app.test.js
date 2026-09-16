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

test("title-cases category and endpoint names", () => {
  assert.equal(titleCase("VoucherB2BCMSController"), "Voucher B2B CMS");
  assert.equal(titleCase("changePassword"), "Change Password");
  assert.equal(titleCase("getQRVoucherLmi"), "Get QR Voucher LMI");
  assert.equal(titleCase("AccountAuthController"), "Account Auth");
  assert.equal(titleCase("ITChecklist"), "IT Checklist");
  assert.equal(titleCase("MRPTicketing"), "MRP Ticketing");
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

test("lists the four application menu options", () => {
  assert.deepEqual(apps.map((app) => app.id), ["boga-app", "webapps", "budgeting", "sync-process"]);
  assert.equal(apps[0].name, "Boga APP API");
  assert.equal(apps[0].hasCatalog, true);
  assert.equal(apps[1].name, "WebApps API");
  assert.equal(apps[1].subtitle, "MyBoga, VMS, ATS, BogaBOT");
  assert.equal(apps[1].hasCatalog, true);
  assert.equal(apps[2].name, "Budgeting API");
  assert.equal(apps[3].name, "Sync Process API");
  assert.ok(apps.slice(2).every((app) => app.hasCatalog === false));
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
});

test("exports an Express handler for Vercel without opening a listener", () => {
  const vercelApp = require("../src/app");

  assert.equal(typeof vercelApp, "function");
  assert.equal(vercelApp.listening, undefined);
});
