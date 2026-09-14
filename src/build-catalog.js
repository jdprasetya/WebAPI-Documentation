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
      return {
        id: slug,
        operationId: operation.operationId,
        title,
        method: method.toUpperCase(),
        path: pathName,
        summary: operation.description?.split("\n\n")[0] || title,
        description: operation.description || "",
        audience: operation["x-audience"] || "",
        auth: operation["x-auth"] || { type: "Public", required: false, summary: "No authentication documented.", headers: [] },
        validation: operation["x-validation"] || [],
        errorMessages: operation["x-error-messages"] || [],
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
              note: operation.requestBody.description || ""
            }
          : null,
        responses: Object.entries(operation.responses || {}).map(([code, response]) => {
          const content = response.content ? Object.values(response.content)[0] : null;
          return {
            code,
            kind: Number(code) >= 400 ? "error" : "success",
            description: response.description || "",
            example: content?.example ?? null
          };
        }),
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
