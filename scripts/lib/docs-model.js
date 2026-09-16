const allowedMethods = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);

const ACRONYMS = new Map([
  ["api", "API"],
  ["b2b", "B2B"],
  ["bca", "BCA"],
  ["cms", "CMS"],
  ["esb", "ESB"],
  ["hmac", "HMAC"],
  ["http", "HTTP"],
  ["id", "ID"],
  ["jwt", "JWT"],
  ["lmi", "LMI"],
  ["mat", "MAT"],
  ["otp", "OTP"],
  ["pin", "PIN"],
  ["pt", "PT"],
  ["qr", "QR"],
  ["sms", "SMS"],
  ["ats", "ATS"],
  ["ba", "BA"],
  ["bin", "BIN"],
  ["bom", "BOM"],
  ["ca", "CA"],
  ["hpp", "HPP"],
  ["it", "IT"],
  ["kpi", "KPI"],
  ["mrp", "MRP"],
  ["mpp", "MPP"],
  ["msdb", "MSDB"],
  ["ocr", "OCR"],
  ["ods", "ODS"],
  ["pod", "POD"],
  ["so", "SO"],
  ["spv", "SPV"],
  ["url", "URL"],
  ["uuid", "UUID"],
  ["va", "VA"],
  ["vms", "VMS"]
]);

const FIELD_HINTS = [
  [/email/, "Email address of the account."],
  [/^oldpassword$/, "Current password."],
  [/^newpassword$/, "New password to set."],
  [/^password$/, "Account password."],
  [/^offset$/, "How many records to skip. Use 0 for the first page."],
  [/^limit$/, "Maximum number of records to return."],
  [/^search$/, "Optional text used to filter the list."],
  [/^sort$/, "Field name used to sort the list."],
  [/^order$/, "Sort direction, usually asc or desc."],
  [/uuid/, "Unique ID of the record."],
  [/^id$/, "Numeric ID of the record."],
  [/token/, "Token value. Replace the placeholder with a real token."],
  [/phone|mobile/, "Phone number."],
  [/outlet|branch/, "Outlet / branch code."],
  [/brand/, "Brand identifier."],
  [/retention/, "How many days of history to keep."],
  [/stopmail/, "When true, Database Mail is stopped during delete and restarted after."],
  [/^userad$/, "Active Directory user id stored on the issued JWT."],
  [/closing[_-]?month/, "Calendar month from 1 to 12 used as the budget closing month."],
  [/country/, "Country identifier."],
  [/user-?agent/, "Client User-Agent string. Some public APIs validate this header."],
  [/content-?type/, "Request body format."],
  [/^code$/, "Lookup code."],
  [/startdt|startdate|start_date/, "Start date."],
  [/enddt|enddate|end_date/, "End date."]
];

function splitList(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function tokenizeName(value) {
  const protectedTokens = [];
  let text = String(value || "")
    .replace(/Controller$/, "")
    .replace(/Handler$/, "")
    .replace(/Task$/, " Task");

  const protect = (pattern, canonical) => {
    text = text.replace(pattern, () => {
      const token = `@@ACRONYM${protectedTokens.length}@@`;
      protectedTokens.push(canonical);
      return ` ${token} `;
    });
  };

  protect(/CMS/g, "CMS");
  protect(/MAT/g, "MAT");
  protect(/ESB/g, "ESB");
  protect(/B2B/gi, "B2B");
  protect(/QR/g, "QR");
  protect(/OTP/gi, "OTP");
  protect(/JWT/g, "JWT");
  protect(/UUID/gi, "UUID");
  protect(/OCR/g, "OCR");
  protect(/MRP/g, "MRP");
  protect(/KPI/g, "KPI");
  protect(/ODS/gi, "ODS");
  protect(/ATS/g, "ATS");
  protect(/VMS/g, "VMS");
  protect(/POD/g, "POD");
  protect(/HPP/g, "HPP");
  protect(/MSDB/g, "MSDB");
  protect(/BOM/g, "BOM");
  protect(/MPP/g, "MPP");
  protect(/BIN/g, "BIN");

  text = text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");

  protectedTokens.forEach((word, index) => {
    text = text.replaceAll(`@@ACRONYM${index}@@`, word);
  });

  return text.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function titleWord(word) {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (ACRONYMS.has(lower)) return ACRONYMS.get(lower);
  if (/^v\d+$/i.test(word)) return word.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function titleCase(value) {
  return tokenizeName(value)
    .split(" ")
    .filter(Boolean)
    .map(titleWord)
    .join(" ");
}

function humanize(value) {
  return titleCase(value);
}

function slugify(value, separator = "-") {
  return titleCase(value)
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, separator);
}

function operationIdFor(row, usedOperationIds) {
  const raw = `${row.controller || "api"} ${row.operation || `${row.http_method} ${row.path}`}`;
  const words = titleCase(raw).replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
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
  const match = String(item || "").match(/^([^:]+):(.+?)(?:\s+\((required|optional\/defaulted)\))?$/i);
  if (!match) {
    return { name: String(item || "").trim(), type: "String", required: defaultRequired };
  }
  return {
    name: match[1].trim(),
    type: match[2].trim(),
    required: match[3] ? match[3].toLowerCase() === "required" : defaultRequired
  };
}

function exampleValue(name, type = "String") {
  const schema = schemaForType(type, name);
  const n = String(name || "").toLowerCase();

  if (schema.type === "array") {
    const innerType = String(type || "")
      .replace(/^(?:List|Set|Collection)</i, "")
      .replace(/>$/, "")
      .replace(/\[\]$/, "") || "String";
    const itemName = String(name || "").replace(/s$/i, "") || "item";
    if (/^(List|Set|Collection)</i.test(innerType) || innerType.endsWith("[]")) {
      return [];
    }
    return [exampleValue(itemName, innerType)];
  }
  if (schema.type === "boolean") return true;
  if (schema.type === "integer") {
    if (/limit/.test(n)) return 20;
    if (/offset/.test(n)) return 0;
    if (/page/.test(n)) return 1;
    if (/retention/.test(n)) return 30;
    return 1;
  }
  if (schema.type === "number") return 10000;
  if (schema.format === "binary") return "<file>";
  if (schema.format === "email" || /email/.test(n)) return "analyst@example.com";
  if (/password/.test(n)) return "ReplaceWithYourPassword";
  if (/phone|mobile/.test(n)) return "081234567890";
  if (schema.format === "uuid" || /uuid/.test(n)) return "11111111-1111-1111-1111-111111111111";
  if (/token/.test(n)) return "<access_token>";
  if (/file/.test(n)) return "sample.png";
  if (schema.format === "date-time" || /timestamp|regdt|moddt|datetime/.test(n)) return "2026-09-14T10:00:00+07:00";
  if (schema.format === "date" || /date/.test(n)) return "2026-09-14";
  if (/time/.test(n)) return "10:00:00";
  if (/url|website|image/.test(n)) return "https://example.com";
  if (/code/.test(n)) return "SAMPLE_CODE";
  if (/name/.test(n)) return "Sample Name";
  if (/notes?$|description|introduction/.test(n)) return "Sample note for testing";
  if (/status/.test(n)) return "SUCCESS";
  if (/id$/.test(n)) return "1";
  if (schema.type === "object") return {};
  return "sample-value";
}

function fieldDescription(name, type, required) {
  const n = String(name || "").toLowerCase();
  const hint = FIELD_HINTS.find(([pattern]) => pattern.test(n));
  const requirement = required ? "Required." : "Optional.";
  if (hint) return `${requirement} ${hint[1]}`;
  return `${requirement} ${titleCase(name)} (${friendlyType(type)}).`;
}

function friendlyType(type) {
  const schema = schemaForType(type, "");
  if (schema.type === "array") return "array";
  if (schema.format === "date-time") return "date-time";
  if (schema.format) return schema.format;
  return schema.type || "string";
}

function placeholderForHeader(name) {
  if (/^authorization$/i.test(name)) return "Bearer <access_token>";
  if (/signature/i.test(name)) return "<request_signature>";
  if (/timestamp/i.test(name)) return "2026-09-14T04:00:00+07:00";
  if (/admin-?key/i.test(name)) return "<audit_admin_key>";
  if (/client-?key|apikey|api-?key|boga-?key|secret|insider/i.test(name)) return "<api_key>";
  if (/partner/i.test(name)) return "<partner_id>";
  if (/external/i.test(name)) return "<external_id>";
  if (/channel/i.test(name)) return "<channel_id>";
  if (/user-?agent/i.test(name)) return "BogaApp/1.0";
  if (/callback/i.test(name)) return "<callback_token>";
  return "<value>";
}

function uniqueHeaders(headers) {
  const seen = new Set();
  const result = [];
  for (const header of headers) {
    const key = header.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(header);
  }
  return result;
}

function classifyAuth(row) {
  const authorization = String(row.authorization || "").trim();
  const declaredHeaders = splitList(row.auth_headers);
  const copyHeaders = [];
  const addHeader = (name, example, note) => {
    copyHeaders.push({
      name,
      example: example || placeholderForHeader(name),
      note: note || ""
    });
  };

  let type = "Public";
  let required = false;
  let summary = "Public endpoint. You can call this without a login token or API key.";

  if (/Callback token/i.test(authorization) || declaredHeaders.some((header) => /callback/i.test(header))) {
    type = "Callback Token";
    required = true;
    summary = "Requires the partner callback token. Put it in the callback header before you send the request.";
  } else if (/Validated User-Agent/i.test(authorization)) {
    type = "User-Agent Check";
    required = true;
    summary = "The server validates the User-Agent header. Use the official app or an approved client string when testing.";
  } else if (/HTTP Basic/i.test(authorization)) {
    type = "HTTP Basic";
    required = true;
    summary = "Requires HTTP Basic authentication. Send `Authorization: Basic <base64(user:password)>` using BASIC_AUTH_USER and BASIC_AUTH_PASSWORD. You can also use `curl -u user:password`.";
    addHeader(
      "Authorization",
      "Basic <base64(user:password)>",
      "Replace with base64 of BASIC_AUTH_USER:BASIC_AUTH_PASSWORD, or use curl -u."
    );
    if (declaredHeaders.some((header) => /key|secret/i.test(header)) || /API\/client\/secret key|secret key/i.test(authorization)) {
      type = "HTTP Basic + API Key";
      summary = "Requires HTTP Basic authentication and an admin API key. Send `Authorization: Basic <base64(user:password)>` plus the extra header below. You can also use `curl -u user:password`.";
    }
  } else if (/Bearer JWT/i.test(authorization) && declaredHeaders.length === 0) {
    type = "Bearer JWT";
    required = true;
    summary = /may be required/i.test(authorization)
      ? "A Bearer JWT is typically required by the API security filter. Send the access token in the Authorization header."
      : "Requires a Bearer JWT. Call Login first, copy the token from the response, then send it here.";
    addHeader("Authorization", "Bearer <access_token>", "Replace <access_token> with the token from Login.");
  } else if (
    /permitAll|None declared|No visible handler-level auth/i.test(authorization) &&
    declaredHeaders.length === 0
  ) {
    type = "Public";
    required = false;
    summary = "Public endpoint. You can call this without a login token or API key.";
  } else {
    required = true;
    const parts = [];
    if (/Authorization header|Bearer/i.test(authorization) || declaredHeaders.some((header) => /^authorization$/i.test(header))) {
      parts.push("an Authorization header");
    }
    if (/API\/client\/secret key|secret key/i.test(authorization) || declaredHeaders.some((header) => /key|secret/i.test(header))) {
      parts.push("an API key");
    }
    if (/signature|HMAC/i.test(authorization) || declaredHeaders.some((header) => /signature/i.test(header))) {
      parts.push("a request signature");
    }
    type = parts.length
      ? parts.map((part) => titleCase(part.replace(/^an? /, ""))).join(" + ")
      : "API Key";
    summary = `Requires ${parts.join(" and ") || "authentication headers"}. Copy the headers below and replace every placeholder before testing.`;
  }

  for (const header of declaredHeaders) {
    addHeader(header, placeholderForHeader(header));
  }

  return {
    type,
    required,
    summary,
    headers: uniqueHeaders(copyHeaders),
    raw: authorization
  };
}

function audienceFor(controller, path, row = {}) {
  const area = String(row.app_area || "").trim();
  if (area === "ATS") return "ATS, HR, System Analysts, and Support";
  if (area === "VMS") return "VMS, procurement, System Analysts, and Support";
  if (area === "BogaBOT") return "BogaBOT, operations, System Analysts, and Support";
  if (area === "MyBoga") return "MyBoga, System Analysts, and Support";
  if (area === "Health") {
    if (path === "/health" || path === "/") return "Anyone checking whether the Budgeting API is up";
    return "Anyone checking whether the Sync Process API is up";
  }
  if (area === "Admin") return "Operations, DBAs, System Analysts, and Support";
  if (area === "Sync") return "Operations and Support when replaying a scheduled sync job";
  if (area === "Authentication") return "Anyone who needs a session token before calling protected APIs";
  if (area === "Reports" || area === "Budgeting") return "Budgeting, finance, System Analysts, and Support";
  if (/\/healthz$/.test(path)) return "Anyone checking whether the Sync Process API is up";
  if (/\/api\/v1\/admin\//.test(path)) return "Operations, DBAs, System Analysts, and Support";
  if (/\/api\/v1\/sync\//.test(path)) return "Operations and Support when replaying a scheduled sync job";
  if (/CMS|Cms/.test(controller) || /\/cms\//.test(path)) return "CMS, System Analysts, and Support";
  if (/Task$/.test(controller) || /\/task\//.test(path)) return "Operations and Support when replaying a scheduled job";
  if (/BogaBot/.test(controller)) return "BogaBot and integration partners";
  if (/Webhook|Xendit|Insider|Moengage|Firebase/.test(controller)) return "External partner callbacks and integrations";
  if (/Bca|Mandiri|Va/.test(controller)) return "Bank virtual-account integration and Support when tracing payments";
  if (/Auth|Authentication/.test(controller)) return "Anyone who needs a session token before calling protected APIs";
  return "Application, integration, System Analysts, and Support";
}

function mapAuthGroup(value) {
  if (!value || /no visible handler-level auth/i.test(value)) {
    return "None declared at handler; method is permitAll in SecurityConfig";
  }
  return String(value).trim();
}

function tagFor(row) {
  const area = String(row.app_area || "").trim();
  if (area) {
    const section = String(row.section || row.controller || "")
      .replace(/Controller$/, "")
      .trim();
    if (!section || section === area) return area;
    return `${area} ${titleCase(section)}`;
  }
  return titleCase(row.controller) || "Other";
}

function normalizeInventoryRow(row) {
  const httpMethod = String(row.http_method || "GET").toUpperCase();
  const source = String(row.source || "").trim();
  const line = String(row.line || "").trim();
  const sourceWithLine = source && line && !/:\d+$/.test(source) ? `${source}:${line}` : source;
  const area = String(row.app_area || "").trim();
  const isWebapps = ["ATS", "BogaBOT", "MyBoga", "VMS"].includes(area);
  const isPost = httpMethod === "POST";

  return {
    ...row,
    http_method: httpMethod,
    operation: row.operation || row.method,
    source: sourceWithLine,
    authorization: row.authorization || mapAuthGroup(row.auth_group),
    auth_headers: row.auth_headers || row.headers || "",
    content_type: row.content_type || (isWebapps && isPost ? "application/json" : row.content_type),
    body_type: row.body_type || (isWebapps && isPost ? "Object (schema not statically declared)" : row.body_type),
    success_http_codes: row.success_http_codes || (isWebapps ? "200" : row.success_http_codes),
    documentation_notes: row.documentation_notes || (isWebapps
      ? "Static source scan of Boga.WebAPI. Handler-level authentication, request body schema, and runtime-only errors were not declared in this inventory."
      : row.documentation_notes)
  };
}

function friendlyValidation(rules) {
  const items = [];
  let extraServerChecks = false;
  for (const rule of splitList(rules)) {
    const annotation = rule.match(/^([^:]+):\s*@(NotBlank|NotNull|NotEmpty)/i);
    if (annotation) {
      items.push(`${annotation[1].trim()} is required and cannot be empty.`);
      continue;
    }
    extraServerChecks = true;
  }
  if (extraServerChecks) {
    items.push("Additional server-side checks apply. If the call fails, compare your payload and headers with the sample request.");
  }
  return [...new Set(items)];
}

function requestFields(row) {
  const payload = String(row.request_payload || "").trim();
  const bodyType = String(row.body_type || "").trim();
  const rawBody = /raw request body|^String$/i.test(payload) || /raw request body/i.test(bodyType);
  if (rawBody) return { raw: true, fields: [] };

  const fields = splitList(payload)
    .map((item) => parseTypedItem(item))
    .filter((field) => field.name && field.name !== payload);
  return { raw: false, fields };
}

function requestExample(row, fieldsInfo) {
  if (fieldsInfo.raw) {
    return {
      example: '{\n  "key": "sample-value"\n}',
      note: "The source code does not declare a fixed JSON schema. Start from a small JSON object and adjust fields based on what the caller actually sends."
    };
  }
  if (!fieldsInfo.fields.length) {
    if (String(row.app_area || "").trim()) {
      return {
        example: {},
        note: "The source scan did not declare a JSON schema. Start with this object and add the fields the WebApps caller actually sends."
      };
    }
    return null;
  }
  const example = {};
  for (const field of fieldsInfo.fields) {
    example[field.name] = exampleValue(field.name, field.type);
  }
  return { example, note: "" };
}

function requestSchema(row, fieldsInfo) {
  const payload = String(row.request_payload || "").trim();
  const bodyType = String(row.body_type || "").trim();
  if (fieldsInfo.raw) {
    return { type: "string", description: bodyType || "Raw request body. No fixed schema was declared in source." };
  }
  if (fieldsInfo.fields.length === 0) {
    return bodyType ? { type: "object", title: bodyType, additionalProperties: true } : null;
  }

  const validation = String(row.validation_rules || "");
  const properties = {};
  const required = [];
  for (const field of fieldsInfo.fields) {
    const schema = schemaForType(field.type, field.name);
    schema.description = fieldDescription(field.name, field.type, false);
    schema.example = exampleValue(field.name, field.type);
    properties[field.name] = schema;
    const escapedName = field.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:^|;\\s*)${escapedName}:\\s*@(?:NotBlank|NotNull|NotEmpty)`, "i").test(validation)) {
      required.push(field.name);
      schema.description = fieldDescription(field.name, field.type, true);
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
  const knownMessage = splitList(row.error_messages)[0];
  const description = numericCode >= 400
    ? knownMessage || "Request failed. Check authentication, required fields, and headers."
    : numericCode === 204
      ? "No content. A blank body is a successful result."
      : "Successful response. The live JSON shape can vary; compare it with this sample.";
  const response = { description };

  if (numericCode === 204) return response;
  if (numericCode >= 400) {
    response.content = {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
        example: {
          status: "error",
          httpStatus: numericCode,
          message: knownMessage || "Request failed. Check headers, required fields, and authentication."
        }
      }
    };
  } else if (/^String$/i.test(responseType)) {
    response.content = {
      "text/plain": {
        schema: { type: "string" },
        example: "OK"
      }
    };
  } else if (!/^void$/i.test(responseType)) {
    response.content = {
      "application/json": {
        schema: { type: "object", additionalProperties: true },
        example: {
          status: "success",
          message: "Request completed",
          data: {}
        }
      }
    };
  }
  if (responseType) response["x-java-response-type"] = responseType;
  return response;
}

function headerSchemeKey(headerName) {
  const words = headerName.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return `header${words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("")}`;
}

function samplePath(pathTemplate, pathParameters) {
  let path = pathTemplate;
  for (const parameter of pathParameters) {
    path = path.replaceAll(`{${parameter.name}}`, encodeURIComponent(String(parameter.example)));
  }
  return path;
}

function queryString(queryParameters) {
  const parts = queryParameters
    .filter((parameter) => parameter.required || parameter.name === "limit" || parameter.name === "offset")
    .map((parameter) => `${encodeURIComponent(parameter.name)}=${encodeURIComponent(String(parameter.example))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function buildCopyBlocks({ method, path, headers, contentType, bodyExample, queryParameters, pathParameters, title, auth }) {
  const resolvedPath = samplePath(path, pathParameters);
  const url = `{baseUrl}${resolvedPath}${queryString(queryParameters)}`;
  const allHeaders = uniqueHeaders([
    ...headers,
    contentType && bodyExample != null ? { name: "Content-Type", example: contentType, note: "" } : null,
    { name: "Accept", example: "application/json", note: "" }
  ].filter(Boolean));

  const headerLines = allHeaders.map((header) => `-H "${header.name}: ${header.example}"`);
  let curl = `curl -X ${method.toUpperCase()} "${url}"`;
  for (const line of headerLines) curl += ` \\\n  ${line}`;
  let bodyText = "";
  if (bodyExample != null && !["get", "head"].includes(method)) {
    bodyText = typeof bodyExample === "string" ? bodyExample : formatJson(bodyExample);
    const escaped = bodyText.replaceAll("'", `'\\''`);
    curl += ` \\\n  -d '${escaped}'`;
  }

  const powershellHeaders = allHeaders
    .map((header) => `  "${header.name}" = "${header.example}"`)
    .join("\n");
  let powershell = `$headers = @{\n${powershellHeaders}\n}\n`;
  if (bodyText) {
    powershell += `$body = @'\n${bodyText}\n'@\n`;
    powershell += `Invoke-RestMethod -Method ${method.toUpperCase()} -Uri "${url}" -Headers $headers -Body $body`;
  } else {
    powershell += `Invoke-RestMethod -Method ${method.toUpperCase()} -Uri "${url}" -Headers $headers`;
  }

  const http = [
    `${method.toUpperCase()} ${resolvedPath}${queryString(queryParameters)} HTTP/1.1`,
    "Host: {host}",
    ...allHeaders.map((header) => `${header.name}: ${header.example}`),
    "",
    bodyText
  ].join("\n").trim();

  const headerBlock = allHeaders.map((header) => `${header.name}: ${header.example}`).join("\n");
  const all = [
    title,
    `${method.toUpperCase()} ${url}`,
    "",
    `Authentication: ${auth.summary}`,
    "",
    "Headers:",
    headerBlock || "(none)",
    bodyText ? `\nBody:\n${bodyText}` : null,
    "",
    "curl:",
    curl
  ].filter((section) => section != null).join("\n");

  return { curl, powershell, http, url, all };
}

function createParameter(name, location, required, type = "String") {
  const schema = schemaForType(type, name);
  const example = exampleValue(name, type);
  schema.example = example;
  return {
    name,
    in: location,
    required: location === "path" ? true : required,
    description: fieldDescription(name, type, location === "path" ? true : required),
    schema,
    example
  };
}

function descriptionFor(row, sourceMethod, auth, copy, audience) {
  const title = titleCase(row.operation) || `${sourceMethod} ${row.path}`;
  const category = tagFor(row);
  const sections = [
    `${title} is part of the ${category} category.`,
    `**Who this is for:** ${audience}.`,
    `**Authentication:** ${auth.summary}`,
    "**How to test:** Copy the sample request below, replace every placeholder (values in `<angle brackets>` and sample data), then send it from Postman, curl, or PowerShell."
  ];

  const validation = friendlyValidation(row.validation_rules);
  if (validation.length) {
    sections.push(`**Validation:** ${validation.join(" ")}`);
  }
  const errorMessages = splitList(row.error_messages);
  if (errorMessages.length) {
    sections.push(`**Known error messages:** ${errorMessages.join("; ")}`);
  }
  if (sourceMethod === "ANY") {
    sections.push("**HTTP method note:** The source mapping accepts any HTTP method. GET is shown as the documented method.");
  }
  if (copy?.curl) {
    sections.push("**Copy-ready curl**\n\n```bash\n" + copy.curl + "\n```");
  }
  sections.push("Technical source notes are omitted from this description so analysts and Support can scan the contract quickly.");
  return sections.join("\n\n");
}

const INFO_DESCRIPTION = `This documentation is written for **developers**, **System Analysts**, and **Support**.

## How To Use This Documentation

1. Open a category from the sidebar.
2. Read **Authentication** at the top of that category before you test anything.
3. Copy the sample request, replace placeholders, and send it from Postman, curl, or PowerShell.

Placeholders look like \`<access_token>\` or \`<api_key>\`. Sample values such as \`analyst@example.com\` are safe fixtures, not real accounts.

## Authentication

Protected APIs usually use one of these patterns:

- **Public** — no login token. Still replace sample body and query values.
- **Bearer JWT** — \`Authorization: Bearer <access_token>\`. Get the token from Login first.
- **API Key** — a header such as \`X-BOGA-Key: <api_key>\`.
- **Request signature** — bank and some partner APIs also require signature and timestamp headers.

Never put production secrets, customer personal data, or live credentials into examples or tickets.

A reader-friendly portal with a category sidebar is available at \`/docs/\`. Swagger UI remains at \`/swagger/\`.`;

const WEBAPPS_INFO_DESCRIPTION = `This documentation is written for **developers**, **System Analysts**, and **Support**.

WebApps API covers **MyBoga**, **VMS**, **ATS**, and **BogaBOT**.


## How To Use This Documentation

1. Open a category from the sidebar. Categories are grouped by product, for example **MyBoga Production** or **VMS Vendor Request**.
2. Read **Authentication** at the top of that category before you test anything.
3. Copy the sample request, replace placeholders, and send it from Postman, curl, or PowerShell.


Placeholders look like \`<access_token>\` or \`<api_key>\`. Sample values such as \`analyst@example.com\` are safe fixtures, not real accounts.


## Authentication

This inventory is a static source scan of Boga.WebAPI. Most handlers do not declare authentication in code, so they are documented as **public**. Confirm the real login or API-key requirement with the WebApps team before testing against a live environment.

POST samples use an empty JSON object as a starting point because request body schemas were not declared in the scan.


Never put production secrets, customer personal data, or live credentials into examples or tickets.

A reader-friendly portal with a category sidebar is available at \`/docs/\`. Swagger UI remains at \`/swagger/\`.`;

const SYNC_INFO_DESCRIPTION = `This documentation is written for **developers**, **System Analysts**, and **Support**.

Sync Process API is the Go service that runs scheduled and on-demand data-sync jobs against SQL Server, with HTTP request audit logging in PostgreSQL.


## How To Use This Documentation

1. Open a category from the sidebar. Start with **Health**, then the **Sync** job you need, then **Admin** for maintenance.
2. Read **Authentication** at the top of that category before you test anything. Every protected route uses HTTP Basic.
3. Copy the sample request, replace placeholders, and send it from Postman, curl, or PowerShell.


Placeholders look like \`<base64(user:password)>\` or \`<audit_admin_key>\`. Sample body values such as \`1\` are safe fixtures, not real company codes.

Most sync POST calls have no request body. A successful sync returns \`{"status":"ok"}\`. Jobs can run up to \`SYNC_RUN_TIMEOUT_SEC\` (default 3600 seconds).


## Authentication

- **HTTP Basic** — \`Authorization: Basic <base64(user:password)>\` with \`BASIC_AUTH_USER\` and \`BASIC_AUTH_PASSWORD\`. \`curl -u user:password\` sends the same header.
- **Admin API key** — purge of request logs also requires \`X-Audit-Admin-Key: <audit_admin_key>\` (\`AUDIT_ADMIN_KEY\`).

Missing or invalid Basic credentials return **401** with \`WWW-Authenticate: Basic realm="restricted"\`. An invalid admin key returns **401** without a token flow.

Never put production secrets, customer personal data, or live credentials into examples or tickets.

A reader-friendly portal with a category sidebar is available at \`/docs/\`. Swagger UI remains at \`/swagger/\`.`;

const BUDGETING_INFO_DESCRIPTION = `This documentation is written for **developers**, **System Analysts**, and **Support**.

Budgeting API is the Go service for non-MPP budget reports, actual reports, table loading, master sync, and audit logging.


## How To Use This Documentation

1. Open a category from the sidebar. Start with **Authentication**, then **Reports** or **Budgeting**, then **Admin** for maintenance.
2. Read **Authentication** at the top of that category before you test anything.
3. Copy the sample request, replace placeholders, and send it from Postman, curl, or PowerShell.


Placeholders look like \`<access_token>\`, \`<base64(user:password)>\`, or \`<audit_admin_key>\`. Sample body values such as \`1\` are safe fixtures, not real company codes.

Most report POST calls share the same JSON body: \`period\`, required \`closing_month\` (1-12), and optional \`outlet_id\`, \`company_id\`, \`department_id\`, and \`brand_id\`. Successful report responses use \`{ "IsError": false, "Status": "Success", "Data": ... }\`.


## Authentication

- **Public** — the HTML landing page at \`/\` has no login.
- **HTTP Basic** — \`Authorization: Basic <base64(user:password)>\` with \`API_AUTH_USER_ID\` and \`API_AUTH_PASSWORD\`. Used by \`GET /health\` and \`POST /api/v1/auth/token\`.
- **Bearer JWT** — \`Authorization: Bearer <access_token>\`. Call **Issue Token** first, then send the token to reports and budgeting routes.
- **Admin API key** — purge of stale audit rows requires \`X-Admin-Key: <audit_admin_key>\` (\`AUDIT_ADMIN_KEY\`).

Never put production secrets, customer personal data, or live credentials into examples or tickets.

A reader-friendly portal with a category sidebar is available at \`/docs/\`. Swagger UI remains at \`/swagger/\`.`;

const AREA_ORDER = {
  ATS: 1,
  BogaBOT: 2,
  MyBoga: 3,
  VMS: 4,
  Health: 1,
  Authentication: 2,
  Reports: 3,
  Budgeting: 4,
  Admin: 5,
  Sync: 2
};

function buildDocument(rows, options = {}) {
  const usedOperationIds = new Set();
  const tagMap = new Map();
  const securitySchemes = {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "Send the access token as `Authorization: Bearer <access_token>`. Copy the token from the Login response."
    }
  };
  const document = {
    openapi: "3.0.3",
    info: {
      title: options.title || "Boga API Documentation",
      version: "1.0.0",
      description: options.description || INFO_DESCRIPTION,
      contact: { name: "API Platform Team" }
    },
    servers: [
      {
        url: "{scheme}://{host}",
        description: "Replace host with the API environment you are testing (local, staging, or production).",
        variables: {
          scheme: { default: "https", enum: ["https", "http"] },
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
          description: "Error response shape varies by endpoint. Use HTTP status, known error messages, and the sample error JSON as a starting point.",
          example: {
            status: "error",
            httpStatus: 400,
            message: "Request failed. Check headers, required fields, and authentication."
          }
        }
      }
    }
  };

  const sortedRows = [...rows]
    .map((row) => normalizeInventoryRow(row))
    .sort((left, right) =>
      left.path.localeCompare(right.path) || left.http_method.localeCompare(right.http_method)
    );

  for (const row of sortedRows) {
    if (!row.path) continue;
    const sourceMethod = String(row.http_method || "GET").toUpperCase();
    const method = sourceMethod === "ANY" ? "get" : sourceMethod.toLowerCase();
    if (!allowedMethods.has(method)) {
      throw new Error(`Unsupported HTTP method ${sourceMethod} for ${row.path}`);
    }

    const tag = tagFor(row);
    const title = titleCase(row.operation) || `${sourceMethod} ${row.path}`;
    const auth = classifyAuth(row);
    const audience = audienceFor(row.controller, row.path, row);
    const fieldsInfo = requestFields(row);
    tagMap.set(tag, {
      controller: row.controller,
      area: String(row.app_area || "").trim(),
      audience,
      auths: [...(tagMap.get(tag)?.auths || []), auth]
    });

    const operation = {
      tags: [tag],
      summary: title,
      operationId: operationIdFor(row, usedOperationIds),
      parameters: [],
      responses: {},
      "x-source-controller": row.controller,
      "x-source-location": row.source,
      "x-source-http-method": sourceMethod,
      "x-audience": audience,
      "x-auth": auth,
      "x-validation": friendlyValidation(row.validation_rules),
      "x-error-messages": splitList(row.error_messages)
    };
    if (row.app_area) operation["x-app-area"] = row.app_area;

    const pathParameters = [];
    for (const item of splitList(row.path_parameters)) {
      const field = parseTypedItem(item, true);
      const parameter = createParameter(field.name, "path", true, field.type);
      operation.parameters.push(parameter);
      pathParameters.push(parameter);
    }
    const declaredPathNames = new Set(operation.parameters.map((parameter) => parameter.name));
    for (const match of row.path.matchAll(/{([^}]+)}/g)) {
      if (!declaredPathNames.has(match[1])) {
        const parameter = createParameter(match[1], "path", true);
        operation.parameters.push(parameter);
        pathParameters.push(parameter);
      }
    }

    const queryParameters = [];
    for (const item of splitList(row.query_parameters)) {
      const field = parseTypedItem(item);
      const parameter = createParameter(field.name, "query", field.required, field.type);
      operation.parameters.push(parameter);
      queryParameters.push(parameter);
    }

    const authHeaders = splitList(row.auth_headers);
    const requiredHeaders = splitList(row.required_headers);
    const optionalHeaders = splitList(row.optional_headers);
    const isBasic = /HTTP Basic/i.test(row.authorization || "");
    const security = {};
    for (const header of authHeaders) {
      if (isBasic && /^authorization$/i.test(header)) continue;
      const key = headerSchemeKey(header);
      securitySchemes[key] ||= {
        type: "apiKey",
        in: "header",
        name: header,
        description: `Send \`${header}: ${placeholderForHeader(header)}\`. Replace the placeholder with the real credential.`
      };
      security[key] = [];
    }
    if (isBasic) {
      securitySchemes.basicAuth ||= {
        type: "http",
        scheme: "basic",
        description: "Send HTTP Basic credentials as `Authorization: Basic <base64(user:password)>`. Use BASIC_AUTH_USER and BASIC_AUTH_PASSWORD, or `curl -u user:password`."
      };
      security.basicAuth = [];
    }
    if (Object.keys(security).length) {
      operation.security = [security];
    } else if (/Bearer JWT/i.test(row.authorization || "")) {
      operation.security = [{ bearerAuth: [] }];
    } else if (/permitAll|None declared|No visible handler-level auth/i.test(row.authorization || "")) {
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

    const bodySchema = requestSchema(row, fieldsInfo);
    const exampleInfo = requestExample(row, fieldsInfo);
    let contentType = null;
    let bodyExample = null;
    if (bodySchema) {
      contentType = validContentType(row.content_type) ||
        (/binary/.test(JSON.stringify(bodySchema)) ? "multipart/form-data" : "application/json");
      bodyExample = exampleInfo?.example ?? (fieldsInfo.raw ? '{"key":"sample-value"}' : {});
      const media = { schema: bodySchema };
      if (bodyExample != null) media.example = bodyExample;
      operation.requestBody = {
        required: true,
        description: exampleInfo?.note || "Replace sample values before sending this body.",
        content: { [contentType]: media }
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

    const copy = buildCopyBlocks({
      method,
      path: row.path,
      headers: [
        ...auth.headers,
        ...operation.parameters
          .filter((parameter) => parameter.in === "header")
          .map((parameter) => ({ name: parameter.name, example: parameter.example, note: "" }))
      ],
      contentType,
      bodyExample,
      queryParameters,
      pathParameters,
      title,
      auth
    });
    operation["x-copy"] = copy;
    operation.description = descriptionFor(row, sourceMethod, auth, copy, audience);

    if (!operation.parameters.length) delete operation.parameters;
    document.paths[row.path] ||= {};
    if (document.paths[row.path][method]) {
      throw new Error(`Duplicate operation ${method.toUpperCase()} ${row.path}`);
    }
    document.paths[row.path][method] = operation;
  }

  document.tags = [...tagMap.entries()]
    .sort(([left, leftMeta], [right, rightMeta]) => {
      const leftArea = AREA_ORDER[leftMeta.area] || 0;
      const rightArea = AREA_ORDER[rightMeta.area] || 0;
      const leftAuth = /auth/i.test(left) ? 0 : 1;
      const rightAuth = /auth/i.test(right) ? 0 : 1;
      return leftArea - rightArea || leftAuth - rightAuth || left.localeCompare(right);
    })
    .map(([name, meta]) => {
      const types = [...new Set(meta.auths.map((item) => item.type))];
      const requiredCount = meta.auths.filter((item) => item.required).length;
      let authSummary;
      if (requiredCount === 0) {
        authSummary = "All endpoints in this category are public. You can call them without a login token.";
      } else if (requiredCount === meta.auths.length) {
        authSummary = `Every endpoint in this category requires authentication (${types.join(", ")}). Read the sample headers before testing.`;
      } else {
        authSummary = `This category mixes public and protected endpoints (${types.join(", ")}). Check Authentication at the top of the category, then the endpoint you are testing.`;
      }
      return {
        name,
        description: [
          `**Authentication:** ${authSummary}`,
          `**Who uses this:** ${meta.audience}.`,
          `Handled by \`${meta.controller}\`.`
        ].join("\n\n")
      };
    });
  return document;
}

module.exports = {
  allowedMethods,
  buildDocument,
  classifyAuth,
  humanize,
  normalizeInventoryRow,
  titleCase,
  slugify,
  splitList,
  WEBAPPS_INFO_DESCRIPTION,
  SYNC_INFO_DESCRIPTION,
  BUDGETING_INFO_DESCRIPTION
};
