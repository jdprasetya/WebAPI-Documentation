const fs = require("node:fs");
const path = require("node:path");
const SwaggerParser = require("@apidevtools/swagger-parser");

const files = [
  process.env.OPENAPI_FILE || "openapi/openapi.yaml",
  process.env.WEBAPPS_OPENAPI_FILE || "openapi/webapps.yaml"
];

async function main() {
  const rootDir = process.cwd();
  for (const relativePath of files) {
    const openapiPath = path.resolve(relativePath);
    if (!fs.existsSync(openapiPath)) continue;
    const api = await SwaggerParser.validate(openapiPath);
    console.log(`Valid OpenAPI document: ${api.info.title} ${api.info.version} (${path.relative(rootDir, openapiPath)})`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
