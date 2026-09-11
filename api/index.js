const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");
const { createApp } = require("../src/app");

// Vercel invokes the exported Express application for every request. Do not
// call app.listen() here; Vercel owns the HTTP server and supplies the request.
const defaultOpenapiPath = path.join(__dirname, "../openapi/openapi.yaml");
const openapiPath = process.env.OPENAPI_FILE
  ? path.resolve(process.env.OPENAPI_FILE)
  : defaultOpenapiPath;
const openapiSource = fs.readFileSync(openapiPath, "utf8");
const openapiDocument = YAML.parse(openapiSource);

module.exports = createApp({ openapiDocument, openapiSource });
