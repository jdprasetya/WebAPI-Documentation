const path = require("node:path");
const SwaggerParser = require("@apidevtools/swagger-parser");

async function main() {
  const openapiPath = path.resolve(process.env.OPENAPI_FILE || "openapi/openapi.yaml");
  const api = await SwaggerParser.validate(openapiPath);
  console.log(`Valid OpenAPI document: ${api.info.title} ${api.info.version}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
