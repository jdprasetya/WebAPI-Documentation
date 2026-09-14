const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const { parse } = require("csv-parse/sync");
const YAML = require("yaml");
const { createApp, normalizeBasePath } = require("../src/app");
const { buildCatalog } = require("../src/build-catalog");
const { titleCase } = require("../scripts/lib/docs-model");

const methods = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);
const openapiSource = fs.readFileSync("openapi/openapi.yaml", "utf8");
const openapiDocument = YAML.parse(openapiSource);
const inventoryRows = parse(fs.readFileSync("data/api_documentation_inventory.csv", "utf8"), {
  bom: true,
  columns: true,
  skip_empty_lines: true
});

test("title-cases category and endpoint names", () => {
  assert.equal(titleCase("VoucherB2BCMSController"), "Voucher B2B CMS");
  assert.equal(titleCase("changePassword"), "Change Password");
  assert.equal(titleCase("getQRVoucherLmi"), "Get QR Voucher LMI");
  assert.equal(titleCase("AccountAuthController"), "Account Auth");
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
  assert.match(docsHtml, /\/portal\/assets\/boga-logo.webp/);
  assert.match(docsHtml, /\/portal\/docs\/catalog.json/);

  const catalogResponse = await fetch(`${origin}/portal/docs/catalog.json`);
  assert.equal(catalogResponse.status, 200);
  const catalog = await catalogResponse.json();
  assert.ok(Array.isArray(catalog.categories));
  assert.ok(catalog.categories[0].authentication.title === "Authentication");

  const logoResponse = await fetch(`${origin}/portal/assets/boga-logo.webp`);
  assert.equal(logoResponse.status, 200);
  assert.match(logoResponse.headers.get("content-type"), /^image\/webp/);

  const faviconResponse = await fetch(`${origin}/portal/favicon.ico`);
  assert.equal(faviconResponse.status, 200);
  assert.match(faviconResponse.headers.get("content-type"), /^image\/webp/);

  const swaggerConfigResponse = await fetch(`${origin}/portal/swagger/swagger-ui-init.js`);
  assert.equal(swaggerConfigResponse.status, 200);
  assert.match(await swaggerConfigResponse.text(), /"url": "\/portal\/openapi.yaml"/);
});

test("exports an Express handler for Vercel without opening a listener", () => {
  const vercelApp = require("../src/app");

  assert.equal(typeof vercelApp, "function");
  assert.equal(vercelApp.listening, undefined);
});
