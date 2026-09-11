const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");
const { createApp } = require("./create-app");

const defaultOpenapiPath = path.join(__dirname, "../openapi/openapi.yaml");
const openapiPath = process.env.OPENAPI_FILE
  ? path.resolve(process.env.OPENAPI_FILE)
  : defaultOpenapiPath;
const openapiSource = fs.readFileSync(openapiPath, "utf8");
const openapiDocument = YAML.parse(openapiSource);

// Vercel auto-detects src/app.js and requires its CommonJS export to be an
// HTTP handler. An Express application satisfies that contract.
module.exports = createApp({ openapiDocument, openapiSource });
