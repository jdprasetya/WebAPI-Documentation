const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");
const YAML = require("yaml");

const inputPath = path.resolve(
  process.env.API_INVENTORY_FILE || "data/api_documentation_inventory.csv"
);
const outputPath = path.resolve(process.env.OPENAPI_FILE || "openapi/openapi.yaml");
const allowedMethods = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);

function splitList(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function humanize(value) {
  return String(value || "")
    .replace(/Controller$/, "")
    .replace(/CMS/g, " Cms ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function operationIdFor(row, usedOperationIds) {
  const raw = `${row.controller || "api"} ${row.operation || `${row.http_method} ${row.path}`}`;
  const words = humanize(raw).replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const base = words
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toLowerCase() + word.slice(1)
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join("") || "operation";

  let candidate = base;
  let suffix = 2;
  while (usedOperationIds.has(candidate)) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  usedOperationIds.add(candidate);
  return candidate;
}

function schemaForType(type, name = "") {
  const normalized = String(type || "String").trim();
  const listMatch = normalized.match(/^(?:List|Set|Collection)<(.+)>$/i);
  if (listMatch) {
    return { type: "array", items: schemaForType(listMatch[1], name) };
  }
  if (normalized.endsWith("[]")) {
    return { type: "array", items: schemaForType(normalized.slice(0, -2), name) };
  }

  if (/^(int|integer|short|byte)$/i.test(normalized)) return { type: "integer", format: "int32" };
  if (/^(long|biginteger)$/i.test(normalized)) return { type: "integer", format: "int64" };
  if (/^(double|float|bigdecimal|decimal|number)$/i.test(normalized)) return { type: "number" };
  if (/^(boolean|bool)$/i.test(normalized)) return { type: "boolean" };
  if (/^(multipartfile|file|binary)$/i.test(normalized)) return { type: "string", format: "binary" };
  if (/^(object|map)(<.*>)?$/i.test(normalized)) {
    return { type: "object", additionalProperties: true };
  }

  const schema = { type: "string" };
  if (/uuid/i.test(name)) schema.format = "uuid";
  else if (/email/i.test(name)) schema.format = "email";
  else if (/date.*time|timestamp/i.test(name)) schema.format = "date-time";
  else if (/date/i.test(name)) schema.format = "date";
  return schema;
}

function parseTypedItem(item, defaultRequired = false) {
  const match = item.match(/^([^:]+):(.+?)(?:\s+\((required|optional\/defaulted)\))?$/i);
  if (!match) {
    return { name: item.trim(), type: "String", required: defaultRequired };
  }
  return {
    name: match[1].trim(),
    type: match[2].trim(),
    required: match[3] ? match[3].toLowerCase() === "required" : defaultRequired
  };
}

function createParameter(name, location, required, type = "String") {
  return {
    name,
    in: location,
    required: location === "path" ? true : required,
    schema: schemaForType(type, name)
  };
}

function requestSchema(row) {
  const payload = String(row.request_payload || "").trim();
  const bodyType = String(row.body_type || "").trim();
  const rawBody = /raw request body|^String$/i.test(payload) || /raw request body/i.test(bodyType);

  if (rawBody) {
    return { type: "string", description: bodyType || "Raw request body" };
  }

  const fields = splitList(payload)
    .map((item) => parseTypedItem(item))
    .filter((field) => field.name && field.name !== payload);
  if (fields.length === 0) {
    return bodyType ? { type: "object", title: bodyType, additionalProperties: true } : null;
  }

  const validation = String(row.validation_rules || "");
  const properties = {};
  const required = [];
  for (const field of fields) {
    properties[field.name] = schemaForType(field.type, field.name);
    const escapedName = field.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:^|;\\s*)${escapedName}:\\s*@(?:NotBlank|NotNull|NotEmpty)`, "i").test(validation)) {
      required.push(field.name);
    }
  }

  const schema = { type: "object", properties };
  if (bodyType) schema.title = bodyType;
  if (required.length) schema.required = required;
  return schema;
}

function validContentType(value) {
  const contentType = String(value || "").trim();
  return /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:\s*;.*)?$/.test(contentType)
    ? contentType
    : null;
}

function responseFor(row, statusCode) {
  const responseType = String(row.response_type || "").trim();
  const numericCode = Number(statusCode);
  const description = numericCode >= 400 ? "Request failed" : numericCode === 204 ? "No content" : "Successful response";
  const response = { description };

  if (numericCode === 204) return response;
  if (numericCode >= 400) {
    response.content = {
      "application/json": { schema: { $ref: "#/components/schemas/Error" } }
    };
  } else if (/^String$/i.test(responseType)) {
    response.content = { "text/plain": { schema: { type: "string" } } };
  } else if (!/^void$/i.test(responseType)) {
    response.content = {
      "application/json": { schema: { type: "object", additionalProperties: true } }
    };
  }
  if (responseType) response["x-java-response-type"] = responseType;
  return response;
}

function headerSchemeKey(headerName) {
  const words = headerName.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return `header${words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("")}`;
}

function descriptionFor(row, sourceMethod) {
  const sections = [];
  if (row.authorization) sections.push(`**Authorization:** ${row.authorization}`);
  if (row.validation_rules) sections.push(`**Validation:** ${row.validation_rules}`);
  if (row.application_error_codes) sections.push(`**Application error codes:** ${row.application_error_codes}`);
  if (row.error_messages) sections.push(`**Known error messages:** ${row.error_messages}`);
  if (sourceMethod === "ANY") {
    sections.push("**HTTP method note:** The source mapping accepts any HTTP method; GET is shown as the canonical documentation operation.");
  }
  if (row.documentation_notes) sections.push(row.documentation_notes);
  if (row.source) sections.push(`Source: \`${row.source}\``);
  return sections.join("\n\n");
}

function buildDocument(rows) {
  const usedOperationIds = new Set();
  const tagMap = new Map();
  const securitySchemes = {
    bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
  };
  const document = {
    openapi: "3.0.3",
    info: {
      title: "Boga API Developer Documetation",
      version: "1.0.0",
      description:
        "Internal API reference generated from the source inventory. Schemas and responses marked as generic were not fully declared by the static source scan.",
      contact: { name: "API Platform Team" }
    },
    servers: [
      {
        url: "{scheme}://{host}",
        description: "Configurable API server",
        variables: {
          scheme: { default: "http", enum: ["http", "https"] },
          host: { default: "localhost:8080", description: "API hostname and optional port" }
        }
      }
    ],
    tags: [],
    paths: {},
    components: {
      securitySchemes,
      schemas: {
        Error: {
          type: "object",
          additionalProperties: true,
          description: "Error response shape varies by endpoint; consult application error codes and notes."
        }
      }
    }
  };

  const sortedRows = [...rows].sort((left, right) =>
    left.path.localeCompare(right.path) || left.http_method.localeCompare(right.http_method)
  );

  for (const row of sortedRows) {
    if (!row.path) continue;
    const sourceMethod = String(row.http_method || "GET").toUpperCase();
    const method = sourceMethod === "ANY" ? "get" : sourceMethod.toLowerCase();
    if (!allowedMethods.has(method)) {
      throw new Error(`Unsupported HTTP method ${sourceMethod} for ${row.path}`);
    }

    const tag = humanize(row.controller) || "Other";
    tagMap.set(tag, row.controller);
    const operation = {
      tags: [tag],
      summary: humanize(row.operation) || `${sourceMethod} ${row.path}`,
      operationId: operationIdFor(row, usedOperationIds),
      description: descriptionFor(row, sourceMethod),
      parameters: [],
      responses: {},
      "x-source-controller": row.controller,
      "x-source-location": row.source,
      "x-source-http-method": sourceMethod
    };

    for (const item of splitList(row.path_parameters)) {
      const field = parseTypedItem(item, true);
      operation.parameters.push(createParameter(field.name, "path", true, field.type));
    }
    const declaredPathNames = new Set(operation.parameters.map((parameter) => parameter.name));
    for (const match of row.path.matchAll(/{([^}]+)}/g)) {
      if (!declaredPathNames.has(match[1])) {
        operation.parameters.push(createParameter(match[1], "path", true));
      }
    }
    for (const item of splitList(row.query_parameters)) {
      const field = parseTypedItem(item);
      operation.parameters.push(createParameter(field.name, "query", field.required, field.type));
    }

    const authHeaders = splitList(row.auth_headers);
    const requiredHeaders = splitList(row.required_headers);
    const optionalHeaders = splitList(row.optional_headers);
    const security = {};
    for (const header of authHeaders) {
      const key = headerSchemeKey(header);
      securitySchemes[key] ||= {
        type: "apiKey",
        in: "header",
        name: header,
        description: `Authentication header ${header}`
      };
      security[key] = [];
    }
    if (Object.keys(security).length) {
      operation.security = [security];
    } else if (/Bearer JWT/i.test(row.authorization || "")) {
      operation.security = [{ bearerAuth: [] }];
    } else if (/permitAll|None declared/i.test(row.authorization || "")) {
      operation.security = [];
    }

    const authHeaderNames = new Set(authHeaders.map((header) => header.toLowerCase()));
    for (const header of requiredHeaders) {
      if (!/^(content-type|accept)$/i.test(header) && !authHeaderNames.has(header.toLowerCase())) {
        operation.parameters.push(createParameter(header, "header", true));
      }
    }
    for (const header of optionalHeaders) {
      if (!/^(content-type|accept)$/i.test(header) && !authHeaderNames.has(header.toLowerCase())) {
        operation.parameters.push(createParameter(header, "header", false));
      }
    }

    const bodySchema = requestSchema(row);
    if (bodySchema) {
      const contentType = validContentType(row.content_type) ||
        (/binary/.test(JSON.stringify(bodySchema)) ? "multipart/form-data" : "application/json");
      operation.requestBody = {
        required: true,
        content: { [contentType]: { schema: bodySchema } }
      };
    }

    const successCodes = splitList(row.success_http_codes);
    const errorCodes = splitList(row.error_http_codes);
    for (const code of successCodes.length ? successCodes : ["200"]) {
      operation.responses[code] = responseFor(row, code);
    }
    for (const code of errorCodes) {
      operation.responses[code] = responseFor(row, code);
    }

    operation.parameters = operation.parameters.filter(
      (parameter, index, parameters) =>
        parameters.findIndex((candidate) => candidate.in === parameter.in && candidate.name === parameter.name) === index
    );
    if (!operation.parameters.length) delete operation.parameters;
    if (!operation.description) delete operation.description;
    document.paths[row.path] ||= {};
    if (document.paths[row.path][method]) {
      throw new Error(`Duplicate operation ${method.toUpperCase()} ${row.path}`);
    }
    document.paths[row.path][method] = operation;
  }

  document.tags = [...tagMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, controller]) => ({ name, description: `Endpoints handled by ${controller}.` }));
  return document;
}

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
