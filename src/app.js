const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");
const { apps } = require("./apps-config");
const { buildCatalog } = require("./build-catalog");

function normalizeBasePath(value = "") {
  const trimmed = value.trim();

  if (!trimmed || trimmed === "/") {
    return "";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function createApp({ openapiDocument, openapiSource, basePath = process.env.BASE_PATH } = {}) {
  if (!openapiDocument || !openapiSource) {
    throw new Error("openapiDocument and openapiSource are required");
  }

  const app = express();
  const mountPath = normalizeBasePath(basePath);
  const docsPath = `${mountPath}/docs`;
  const swaggerPath = `${mountPath}/swagger`;
  const specPath = `${mountPath}/openapi.yaml`;
  const logoPath = `${mountPath}/assets/boga-logo.webp`;
  const enableTryItOut = process.env.ENABLE_TRY_IT_OUT === "true";
  const portalDir = path.join(__dirname, "../public/portal");
  const portalTemplate = fs.readFileSync(path.join(portalDir, "index.html"), "utf8");
  const catalog = buildCatalog(openapiDocument);
  const catalogSource = JSON.stringify(catalog);
  const siteTitle = openapiDocument.info?.title || "API Documentation";
  const portalHtml = portalTemplate
    .replaceAll("{{TITLE}}", siteTitle)
    .replaceAll("{{BASE_PATH}}", mountPath)
    .replaceAll("{{APPS_JSON}}", JSON.stringify(apps));

  app.disable("x-powered-by");
  app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);

  app.use((request, response, next) => {
    response.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "no-referrer"
    });
    next();
  });

  app.get(`${mountPath}/health`, (request, response) => {
    response.json({ status: "ok" });
  });

  app.get(specPath, (request, response) => {
    response.type("application/yaml").send(openapiSource);
  });

  app.get(`${mountPath}/favicon.ico`, (request, response) => {
    response.sendFile(path.join(__dirname, "../public/boga-logo.webp"));
  });

  app.use(`${mountPath}/assets`, express.static(path.join(__dirname, "../public")));

  app.get(`${docsPath}/catalog.json`, (request, response) => {
    response.type("application/json").send(catalogSource);
  });

  app.get([docsPath, `${docsPath}/`], (request, response) => {
    response.type("html").send(portalHtml);
  });

  app.use(docsPath, express.static(portalDir, { index: false, extensions: ["css", "js"] }));

  app.use(
    swaggerPath,
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      customCss: `
        .swagger-ui .topbar { padding: 8px 0; }
        .swagger-ui .topbar .link { max-width: none; }
        .swagger-ui .topbar .link img {
          content: url("${logoPath}");
          width: 64px;
          height: 64px;
          object-fit: contain;
          border-radius: 4px;
        }
        .swagger-ui .topbar .link span { display: none; }
        .swagger-ui .topbar .link::after {
          content: "${siteTitle.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}";
          margin-left: 14px;
          color: #fff;
          font-size: 18px;
          font-weight: 700;
          white-space: nowrap;
        }
        .swagger-ui .opblock-tag,
        .swagger-ui .opblock-summary-description,
        .swagger-ui .info .title {
          font-weight: 700;
        }
        @media (max-width: 540px) {
          .swagger-ui .topbar .link img { width: 48px; height: 48px; }
          .swagger-ui .topbar .link::after {
            max-width: calc(100vw - 90px);
            font-size: 14px;
            white-space: normal;
          }
        }
      `,
      customfavIcon: logoPath,
      customSiteTitle: siteTitle,
      swaggerOptions: {
        url: specPath,
        deepLinking: true,
        displayRequestDuration: true,
        docExpansion: "list",
        filter: true,
        persistAuthorization: true,
        operationsSorter: "alpha",
        supportedSubmitMethods: enableTryItOut
          ? ["get", "put", "post", "delete", "options", "head", "patch", "trace"]
          : [],
        tryItOutEnabled: enableTryItOut
      }
    })
  );

  app.get([mountPath || "/", `${mountPath}/`], (request, response) => {
    response.redirect(`${docsPath}/`);
  });

  app.use((request, response) => {
    response.status(404).json({ error: "Not found" });
  });

  return app;
}

const defaultOpenapiPath = path.join(__dirname, "../openapi/openapi.yaml");
const openapiPath = process.env.OPENAPI_FILE
  ? path.resolve(process.env.OPENAPI_FILE)
  : defaultOpenapiPath;
const openapiSource = fs.readFileSync(openapiPath, "utf8");
const openapiDocument = YAML.parse(openapiSource);
const app = createApp({ openapiDocument, openapiSource });

// Vercel detects Express only when the recognized entry imports Express
// directly and exports the application as the CommonJS default export.
module.exports = app;

// Keep the factory available for isolated tests and custom deployments.
module.exports.createApp = createApp;
module.exports.normalizeBasePath = normalizeBasePath;
