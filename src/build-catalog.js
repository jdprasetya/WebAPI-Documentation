const allowedMethods = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);

function slugifyTitle(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function uniqueSlug(base, used) {
  let candidate = base || "endpoint";
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function authCopyBlock(auth) {
  if (!auth?.headers?.length) {
    return "No authentication headers are required.";
  }
  return auth.headers.map((header) => `${header.name}: ${header.example}`).join("\n");
}

function summarizeCategoryAuth(operations) {
  const types = [...new Set(operations.map((operation) => operation.auth.type))];
  const required = operations.filter((operation) => operation.auth.required);
  const publicOps = operations.filter((operation) => !operation.auth.required);
  const headers = [];
  for (const operation of operations) {
    for (const header of operation.auth.headers || []) {
      if (!headers.some((item) => item.name.toLowerCase() === header.name.toLowerCase())) {
        headers.push(header);
      }
    }
  }

  let summary;
  if (required.length === 0) {
    summary = "All endpoints in this category are public. You can call them without a login token or API key.";
  } else if (publicOps.length === 0) {
    summary = `Every endpoint in this category requires authentication (${types.join(", ")}). Copy the headers below before you test.`;
  } else {
    summary = `This category has both public and protected endpoints. Public: ${publicOps.map((item) => item.title).join(", ") || "none"}. Protected: ${required.map((item) => `${item.title} (${item.auth.type})`).join(", ")}.`;
  }

  return {
    title: "Authentication",
    summary,
    types,
    headers,
    copyBlock: headers.length ? headers.map((header) => `${header.name}: ${header.example}`).join("\n") : "No authentication headers are required for public endpoints in this category.",
    publicCount: publicOps.length,
    protectedCount: required.length
  };
}

function titleCaseName(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayType(schema) {
  if (!schema) return "String";
  if (schema.type === "array") {
    const item = displayType(schema.items || { type: "string" });
    return `${item}[]`;
  }
  if (schema.format === "binary") return "File";
  if (schema.format === "date-time") return "DateTime";
  if (schema.format === "date") return "Date";
  const type = schema.type || "string";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function exampleType(value) {
  if (Array.isArray(value)) return "Array";
  if (value === null) return "Object";
  if (typeof value === "object") return "Object";
  if (typeof value === "number") return Number.isInteger(value) ? "Integer" : "Number";
  if (typeof value === "boolean") return "Boolean";
  return "String";
}

function schemaFields(schema, depth = 0) {
  if (!schema?.properties) return [];
  const required = new Set(schema.required || []);
  const rows = [];
  for (const [name, property] of Object.entries(schema.properties)) {
    const description = property.description ||
      `${required.has(name) ? "Required." : "Optional."} ${titleCaseName(name)}.`;
    rows.push({
      name,
      type: displayType(property),
      description,
      depth
    });
    if (property.properties) {
      rows.push(...schemaFields(property, depth + 1));
    } else if (property.items?.properties) {
      rows.push(...schemaFields(property.items, depth + 1));
    }
  }
  return rows;
}

function exampleFields(value, depth = 0) {
  if (value == null || typeof value !== "object") return [];
  const object = Array.isArray(value) ? value[0] : value;
  if (object == null || typeof object !== "object" || Array.isArray(object)) return [];
  return Object.entries(object).flatMap(([name, nested]) => {
    const row = {
      name,
      type: exampleType(nested),
      description: titleCaseName(name),
      depth
    };
    const children = nested && typeof nested === "object"
      ? exampleFields(nested, depth + 1)
      : [];
    return [row, ...children];
  });
}

function bodyFields(media) {
  if (!media) return [];
  const fromSchema = schemaFields(media.schema);
  if (fromSchema.length) return fromSchema;
  return exampleFields(media.example);
}

function formatJsonSample(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function formatHeaderSample(headers) {
  if (!headers.length) return "No headers required.";
  return headers.map((header) => `"${header.name}": "${header.example}"`).join("\n");
}

function collectRequestHeaders(auth, parameters, contentType) {
  const headers = [];
  const add = (name, example) => {
    if (!name || headers.some((item) => item.name.toLowerCase() === name.toLowerCase())) return;
    headers.push({ name, example: example || "" });
  };
  for (const header of auth?.headers || []) add(header.name, header.example);
  for (const header of parameters.filter((item) => item.in === "header")) {
    add(header.name, header.example);
  }
  if (contentType) add("Content-Type", contentType);
  return headers;
}

function errorMessageForCode(code) {
  const status = Number(code);
  if (status === 401) return "Unauthorized";
  if (status === 403) return "Forbidden";
  if (status === 404) return "Not Found";
  if (status === 409) return "Conflict";
  if (status === 422) return "Unprocessable Entity";
  if (status >= 500) return "Internal server error";
  return "Request failed. Check headers, required fields, and authentication.";
}

function errorExample(template, message, code) {
  const statusCode = String(code || 400);
  const base = template && typeof template === "object" && !Array.isArray(template)
    ? { ...template }
    : {};
  return {
    status: base.status || "error",
    code: String(base.code || statusCode),
    httpStatus: Number(base.httpStatus || statusCode),
    message: message || base.message || errorMessageForCode(statusCode),
    errors: base.errors ?? null
  };
}

function errorTab(label, example, code, key) {
  const named = label.startsWith("Error:") ? label.replace(/^Error:\s*/, "") : "";
  const message = example?.message || named || errorMessageForCode(code);
  return {
    label,
    value: formatJsonSample(errorExample(example, message, code)),
    kind: "error",
    key
  };
}

function collectAuthTypes(categories) {
  const map = new Map();
  for (const category of categories) {
    for (const operation of category.operations) {
      const key = operation.auth.type;
      if (!map.has(key)) {
        map.set(key, {
          id: slugifyTitle(key),
          title: key,
          summary: operation.auth.summary,
          headers: operation.auth.headers || [],
          copyExample: authCopyBlock(operation.auth),
          count: 0
        });
      }
      map.get(key).count += 1;
    }
  }
  return [...map.values()].sort((left, right) => {
    if (left.title === "Public") return -1;
    if (right.title === "Public") return 1;
    return right.count - left.count || left.title.localeCompare(right.title);
  });
}

function buildCatalog(openapiDocument) {
  const groups = new Map();

  for (const [pathName, pathItem] of Object.entries(openapiDocument.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!allowedMethods.has(method) || !operation) continue;
      const tag = operation.tags?.[0] || "Other";
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag).push({ pathName, method, operation });
    }
  }

  const tagOrder = (openapiDocument.tags || []).map((tag) => tag.name);
  const names = [...groups.keys()].sort((left, right) => {
    const leftIndex = tagOrder.indexOf(left);
    const rightIndex = tagOrder.indexOf(right);
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }
    return left.localeCompare(right);
  });

  const categories = names.map((name) => {
    const usedSlugs = new Set(["authentication"]);
    const operations = groups.get(name).map(({ pathName, method, operation }) => {
      const title = operation.summary || `${method.toUpperCase()} ${pathName}`;
      const slug = uniqueSlug(slugifyTitle(title), usedSlugs);
      const requestBody = operation.requestBody?.content
        ? Object.entries(operation.requestBody.content)[0]
        : null;
      const parameters = operation.parameters || [];
      const auth = operation["x-auth"] || { type: "Public", required: false, summary: "No authentication documented.", headers: [] };
      const errorMessages = operation["x-error-messages"] || [];
      const responses = Object.entries(operation.responses || {}).map(([code, response]) => {
        const content = response.content ? Object.values(response.content)[0] : null;
        return {
          code,
          kind: Number(code) >= 400 ? "error" : "success",
          description: response.description || "",
          example: content?.example ?? null
        };
      });
      const success = responses.find((item) => item.kind === "success") || responses[0];
      const errorResponses = responses.filter((item) => item.kind === "error");
      const errorTemplate = errorResponses[0]?.example;
      const headerItems = collectRequestHeaders(auth, parameters, requestBody?.[0] || "");
      const successTabs = responses.filter((item) => item.kind === "success" && item.example != null).map((item, index) => ({
        label: responses.filter((entry) => entry.kind === "success").length > 1
          ? `Success Response ${item.code}`
          : "Success Response",
        value: formatJsonSample(item.example),
        kind: "success",
        key: `success-${item.code}-${index}`
      }));
      const errorTabs = [
        ...errorResponses.map((item, index) => errorTab(
          `Error Response ${item.code}`,
          item.example,
          item.code,
          `error-${item.code}-${index}`
        )),
        ...errorMessages.map((message, index) => errorTab(
          `Error: ${message}`,
          errorExample(errorTemplate, message, errorResponses[0]?.code || 400),
          errorResponses[0]?.code || 400,
          `error-msg-${index}`
        ))
      ];
      if (!errorTabs.length) {
        for (const code of [400, 401, 404]) {
          errorTabs.push(errorTab(
            `Error Response ${code}`,
            errorExample(null, errorMessageForCode(code), code),
            code,
            `error-default-${code}`
          ));
        }
      }
      return {
        id: slug,
        operationId: operation.operationId,
        title,
        method: method.toUpperCase(),
        path: pathName,
        summary: operation.description?.split("\n\n")[0] || title,
        description: operation.description || "",
        audience: operation["x-audience"] || "",
        auth,
        validation: operation["x-validation"] || [],
        errorMessages,
        parameters: {
          path: parameters.filter((item) => item.in === "path"),
          query: parameters.filter((item) => item.in === "query"),
          header: parameters.filter((item) => item.in === "header")
        },
        body: requestBody
          ? {
              contentType: requestBody[0],
              example: requestBody[1].example ?? null,
              required: Boolean(operation.requestBody.required),
              note: operation.requestBody.description || "",
              fields: bodyFields(requestBody[1])
            }
          : null,
        responseFields: exampleFields(success?.example),
        samples: {
          header: formatHeaderSample(headerItems),
          body: requestBody ? formatJsonSample(requestBody[1].example) : "",
          success: successTabs,
          errors: errorTabs
        },
        responses,
        copy: operation["x-copy"] || {}
      };
    });

    operations.sort((left, right) => left.title.localeCompare(right.title) || left.path.localeCompare(right.path));

    return {
      id: name.replace(/\s+/g, "_"),
      name,
      authentication: summarizeCategoryAuth(operations),
      operations
    };
  });

  return {
    info: {
      title: openapiDocument.info?.title || "API Documentation",
      version: openapiDocument.info?.version || "1.0.0",
      description: openapiDocument.info?.description || ""
    },
    authTypes: collectAuthTypes(categories),
    categories
  };
}

module.exports = { buildCatalog };
