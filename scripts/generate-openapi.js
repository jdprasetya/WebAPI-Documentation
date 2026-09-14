const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");
const YAML = require("yaml");
const { allowedMethods, buildDocument } = require("./lib/docs-model");

const inputPath = path.resolve(
  process.env.API_INVENTORY_FILE || "data/api_documentation_inventory.csv"
);
const outputPath = path.resolve(process.env.OPENAPI_FILE || "openapi/openapi.yaml");

const rows = parse(fs.readFileSync(inputPath, "utf8"), {
  bom: true,
  columns: true,
  skip_empty_lines: true
});
const document = buildDocument(rows);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, YAML.stringify(document, { lineWidth: 120 }), "utf8");

const operationCount = Object.values(document.paths).reduce(
  (count, pathItem) => count + Object.keys(pathItem).filter((key) => allowedMethods.has(key)).length,
  0
);
console.log(`Generated ${operationCount} operations across ${Object.keys(document.paths).length} paths.`);
