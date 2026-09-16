const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");
const { apps, publicApp } = require("./apps-config");
const { buildCatalog } = require("./build-catalog");

function normalizeBasePath(value = "") {
  const trimmed = value.trim();

  if (!trimmed || trimmed === "/") {
    return "";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function readOpenapiFile(relativePath) {
  const filePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(__dirname, "..", relativePath);
  if (!fs.existsSync(filePath)) return null;
  const openapiSource = fs.readFileSync(filePath, "utf8");
  return {
    openapiSource,
    openapiDocument: YAML.parse(openapiSource)
  };
}

function loadRuntimeApps({ openapiDocument, openapiSource } = {}) {
  return apps.map((app) => {
    let document = null;
    let source = null;
    if (app.id === "boga-app" && openapiDocument && openapiSource) {
      document = openapiDocument;
      source = openapiSource;
    } else if (app.hasCatalog && app.openapiFile) {
      const loaded = readOpenapiFile(app.openapiFile);
      if (loaded) {
        document = loaded.openapiDocument;
        source = loaded.openapiSource;
      }
    }

    const hasCatalog = Boolean(document && source);
    return {
      ...app,
      hasCatalog,
      openapiDocument: document,
      openapiSource: source,
      catalog: hasCatalog ? buildCatalog(document) : null
    };
  });
}

function createApp({ openapiDocument, openapiSource, runtimeApps, basePath = process.env.BASE_PATH } = {}) {
  const appList = runtimeApps || loadRuntimeApps({ openapiDocument, openapiSource });
  const published = appList.filter((item) => item.hasCatalog && item.openapiDocument && item.openapiSource);
  const defaultApp = published.find((item) => item.id === "boga-app") || published[0];
  if (!defaultApp) {
    throw new Error("At least one published app with an OpenAPI document is required");
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
  const siteTitle = "Boga API Documentation";
  const appsPublic = appList.map((item) => publicApp(item));
  const catalogs = Object.fromEntries(
    published.map((item) => [item.id, JSON.stringify(item.catalog)])
  );
  const portalHtml = portalTemplate
    .replaceAll("{{TITLE}}", siteTitle)
    .replaceAll("{{BASE_PATH}}", mountPath)
    .replaceAll("{{APPS_JSON}}", JSON.stringify(appsPublic));
  const swaggerUrls = published.map((item) => ({
    name: item.name,
    url: item.id === defaultApp.id ? specPath : `${mountPath}/openapi/${item.id}.yaml`
  }));

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
    response.type("application/yaml").send(defaultApp.openapiSource);
  });

  app.get(`${mountPath}/openapi/:fileName`, (request, response) => {
    const appId = String(request.params.fileName || "").replace(/\.ya?ml$/i, "");
    const selected = published.find((item) => item.id === appId);
    if (!selected) {
      response.status(404).json({ error: "Not found" });
      return;
    }
    response.type("application/yaml").send(selected.openapiSource);
  });

  app.get(`${mountPath}/favicon.ico`, (request, response) => {
    response.sendFile(path.join(__dirname, "../public/boga-logo.webp"));
  });

  app.use(`${mountPath}/assets`, express.static(path.join(__dirname, "../public")));

  app.get(`${docsPath}/catalog.json`, (request, response) => {
    const requested = request.query.app;
    const catalogSource = catalogs[requested] || catalogs[defaultApp.id];
    response.type("application/json").send(catalogSource);
  });

  app.get(`${docsPath}/apps/:appId/catalog.json`, (request, response) => {
    const catalogSource = catalogs[request.params.appId];
    if (!catalogSource) {
      response.status(404).json({ error: "Not found" });
      return;
    }
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
        urls: swaggerUrls,
        "urls.primaryName": defaultApp.name,
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
module.exports.loadRuntimeApps = loadRuntimeApps;
module.exports.normalizeBasePath = normalizeBasePath;
