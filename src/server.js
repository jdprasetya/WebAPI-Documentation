const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");
const { createApp } = require("./app");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";
const openapiPath = path.resolve(process.env.OPENAPI_FILE || "openapi/openapi.yaml");

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const openapiSource = fs.readFileSync(openapiPath, "utf8");
const openapiDocument = YAML.parse(openapiSource);
const app = createApp({ openapiDocument, openapiSource });

app.listen(port, host, () => {
  const basePath = process.env.BASE_PATH || "";
  console.log(`API documentation available at http://localhost:${port}${basePath}/docs/`);
});
