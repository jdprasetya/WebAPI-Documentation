const express = require("express");
const path = require("node:path");
const swaggerUi = require("swagger-ui-express");

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
  const specPath = `${mountPath}/openapi.yaml`;
  const logoPath = `${mountPath}/assets/boga-logo.webp`;
  const enableTryItOut = process.env.ENABLE_TRY_IT_OUT === "true";

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

  app.use(`${mountPath}/assets`, express.static(path.join(__dirname, "../public")));

  app.use(
    docsPath,
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
          content: "Boga API Developer Documetation";
          margin-left: 14px;
          color: #fff;
          font-size: 18px;
          font-weight: 600;
          white-space: nowrap;
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
      customSiteTitle: openapiDocument.info?.title || "API Documentation",
      swaggerOptions: {
        url: specPath,
        deepLinking: true,
        displayRequestDuration: true,
        filter: true,
        persistAuthorization: true,
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

module.exports = { createApp, normalizeBasePath };
