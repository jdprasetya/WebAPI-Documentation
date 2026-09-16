const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");
const YAML = require("yaml");
const { allowedMethods, buildDocument, WEBAPPS_INFO_DESCRIPTION, SYNC_INFO_DESCRIPTION } = require("./lib/docs-model");

const targets = [
  {
    id: "boga-app",
    inventory: process.env.API_INVENTORY_FILE || "data/api_documentation_inventory.csv",
    output: process.env.OPENAPI_FILE || "openapi/openapi.yaml",
    title: "Boga API Documentation"
  },
  {
    id: "webapps",
    inventory: process.env.WEBAPPS_INVENTORY_FILE || "data/webapps-api-inventory.csv",
    output: process.env.WEBAPPS_OPENAPI_FILE || "openapi/webapps.yaml",
    title: "WebApps API Documentation",
    description: WEBAPPS_INFO_DESCRIPTION
  },
  {
    id: "sync-process",
    inventory: process.env.SYNCPROCESS_INVENTORY_FILE || "data/syncprocess-api-inventory.csv",
    output: process.env.SYNCPROCESS_OPENAPI_FILE || "openapi/sync-process.yaml",
    title: "Sync Process API Documentation",
    description: SYNC_INFO_DESCRIPTION
  }
];

function generateTarget(target) {
  const inputPath = path.resolve(target.inventory);
  const outputPath = path.resolve(target.output);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing inventory for ${target.id}: ${inputPath}`);
  }

  const rows = parse(fs.readFileSync(inputPath, "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true
  }).filter((row) => row.path);

  const document = buildDocument(rows, {
    title: target.title,
    description: target.description
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, YAML.stringify(document, { lineWidth: 120 }), "utf8");

  const operationCount = Object.values(document.paths).reduce(
    (count, pathItem) => count + Object.keys(pathItem).filter((key) => allowedMethods.has(key)).length,
    0
  );
  console.log(`Generated ${target.title}: ${operationCount} operations across ${Object.keys(document.paths).length} paths.`);
}

for (const target of targets) {
  generateTarget(target);
}
