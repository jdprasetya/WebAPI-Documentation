const config = window.DOCS_CONFIG || { catalogUrl: "./catalog.json" };
const DEFAULT_APP_ID = "boga-app";
const FALLBACK_APPS = [
  {
    id: "boga-app",
    name: "Boga APP API",
    description: "Customer-facing Boga mobile app APIs. Covers account, catalog, orders, payments, vouchers, and related services.",
    accent: "orange",
    hasCatalog: true
  },
  {
    id: "webapps",
    name: "WebApps API",
    subtitle: "MyBoga, VMS, ATS, BogaBOT",
    description: "APIs for Boga web applications, including MyBoga, VMS, ATS, and BogaBOT.",
    accent: "slate",
    hasCatalog: true
  },
  {
    id: "budgeting",
    name: "Budgeting API",
    description: "Budget planning and financial-control APIs. Manage allocations, approvals, and reporting.",
    accent: "teal",
    hasCatalog: true
  },
  {
    id: "sync-process",
    name: "Sync Process API",
    description: "Scheduled and on-demand sync jobs for item, BOM, employee, sales, and related SQL Server data.",
    accent: "sand",
    hasCatalog: true
  }
];

function getApps() {
  return Array.isArray(config.apps) && config.apps.length ? config.apps : FALLBACK_APPS;
}

function findApp(appId) {
  return getApps().find((app) => app.id === appId) || null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function highlightJson(value) {
  const text = String(value ?? "");
  if (!text.trim()) return "";
  const looksStructured = /^\s*[\[{]/.test(text) || /"[^"\n]+"\s*:/.test(text);
  if (!looksStructured) return escapeHtml(text);

  const pattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g;
  let result = "";
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    if (match[1] != null) {
      const className = match[2] != null ? "json-key" : "json-string";
      result += `<span class="${className}">${escapeHtml(match[1])}</span>${escapeHtml(match[2] || "")}`;
    } else if (match[3] != null) {
      result += `<span class="json-literal">${escapeHtml(match[3])}</span>`;
    } else if (/^-?\d/.test(match[0])) {
      result += `<span class="json-number">${escapeHtml(match[0])}</span>`;
    } else {
      result += escapeHtml(match[0]);
    }
    lastIndex = pattern.lastIndex;
  }
  return result + escapeHtml(text.slice(lastIndex));
}

function copyText(text) {
  return navigator.clipboard.writeText(text);
}

function methodClass(method) {
  return `method ${escapeHtml(method)}`;
}

function displayFieldType(parameter) {
  const schema = parameter.schema || {};
  if (schema.type === "array") {
    const item = schema.items?.format || schema.items?.type || "string";
    return `${item.charAt(0).toUpperCase()}${item.slice(1)}[]`;
  }
  if (schema.format === "date-time") return "DateTime";
  if (schema.format === "binary") return "File";
  const type = schema.format || schema.type || "string";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function schemaTable(title, fields) {
  if (!fields?.length) return "";
  return `
    <h3 class="schema-heading">${escapeHtml(title)}</h3>
    <div class="schema-wrap">
      <table class="schema-table">
        <thead>
          <tr><th>Field</th><th>Type</th><th>Description</th></tr>
        </thead>
        <tbody>
          ${fields.map((field) => `
            <tr>
              <td class="schema-field depth-${Number(field.depth) || 0}">${escapeHtml(field.name)}</td>
              <td>${escapeHtml(field.type || "String")}</td>
              <td>${escapeHtml(field.description || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function parameterFields(parameters) {
  return (parameters || []).map((parameter) => ({
    name: parameter.name,
    type: displayFieldType(parameter),
    description: parameter.description || "",
    depth: 0
  }));
}

function renderTabs(id, tabs) {
  if (!tabs.length) return "";
  return `
    <div class="doc-tabs" data-tabs>
      <div class="doc-tablist" role="tablist">
        ${tabs.map((tab, index) => `
          <button class="doc-tab${index === 0 ? " active" : ""}" type="button" role="tab" id="${escapeHtml(id)}-tab-${index}" aria-selected="${index === 0}" aria-controls="${escapeHtml(id)}-panel-${index}">${escapeHtml(tab.label)}</button>
        `).join("")}
      </div>
      ${tabs.map((tab, index) => `
        <div class="doc-tabpanel${index === 0 ? " active" : ""}" role="tabpanel" id="${escapeHtml(id)}-panel-${index}" aria-labelledby="${escapeHtml(id)}-tab-${index}" ${index === 0 ? "" : "hidden"}>
          <div class="doc-code">
            <button class="copy doc-copy" type="button" data-copy-target="${escapeHtml(id)}-pre-${index}">Copy</button>
            <pre id="${escapeHtml(id)}-pre-${index}" class="json-sample">${highlightJson(tab.value)}</pre>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function copyBox(id, title, value, extraButtons = []) {
  if (!value) return "";
  const extras = extraButtons.map((button, index) => `
    <button class="copy secondary" type="button" data-copy-target="${escapeHtml(id)}-extra-${index}">${escapeHtml(button.label)}</button>
    <pre id="${escapeHtml(id)}-extra-${index}" hidden>${escapeHtml(button.value)}</pre>
  `).join("");
  return `
    <div class="copy-box">
      <div class="copy-actions">
        <button class="copy" type="button" data-copy-target="${escapeHtml(id)}">Copy ${escapeHtml(title)}</button>
        ${extras}
      </div>
      <pre id="${escapeHtml(id)}">${escapeHtml(value)}</pre>
    </div>
  `;
}

function documentIcon() {
  return `
    <svg class="app-card-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7.25 3.75h7.05L18.25 7.7v12.55H7.25z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M14.15 3.75v4.1h4.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M10 12.15h5.4M10 15.35h5.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;
}

function renderApps() {
  return `
    <section class="app-menu" id="apps">
      <div class="app-menu-grid">
        ${getApps().map((app) => `
          <a class="app-card accent-${escapeHtml(app.accent || "slate")}" href="#app/${escapeHtml(app.id)}">
            <span class="app-card-icon">${documentIcon()}</span>
            <h2>${escapeHtml(app.name)}</h2>
            ${app.subtitle ? `<p class="app-card-subtitle">${escapeHtml(app.subtitle)}</p>` : ""}
            <p>${escapeHtml(app.description)}</p>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPlaceholder(app) {
  return `
    <section class="app-placeholder" id="app-overview">
      <p class="crumb"><a href="#apps">Applications</a> / ${escapeHtml(app.name)}</p>
      <h1>${escapeHtml(app.name)}</h1>
      ${app.subtitle ? `<p class="lead">${escapeHtml(app.subtitle)}</p>` : ""}
      <p>${escapeHtml(app.description)}</p>
      <div class="placeholder-panel">
        <h2>Endpoint catalog</h2>
        <p>Endpoint documentation for this application is being prepared. The published list will use the same category sidebar, authentication notes, and copy-ready samples as Boga APP API.</p>
      </div>
    </section>
  `;
}

function renderHome(app) {
  return `
    <section class="hero" id="getting-started">
      <p class="crumb"><a href="#apps">Applications</a> / ${escapeHtml(app?.name || "Boga APP API")}</p>
      <h1>Getting Started</h1>
      <p class="lead">This portal is for developers, System Analysts, and Support. You are viewing <strong>${escapeHtml(app?.name || "Boga APP API")}</strong>. Use the left sidebar to jump by category. Each category starts with Authentication so you can see what to send before you test an endpoint.</p>
      <h2 class="section-title">How To Test An API</h2>
      <ol class="steps">
        <li>Select a category from the sidebar.</li>
        <li>Read <strong>Authentication</strong> at the top of that category.</li>
        <li>Open the endpoint and copy the <strong>Header</strong> or <strong>Body (JSON)</strong> sample.</li>
        <li>Replace placeholders such as <code>&lt;access_token&gt;</code> and sample values.</li>
        <li>Paste into Postman or Curl. Never use <strong>production secrets</strong> or customer <strong>personal data</strong>.</li>
      </ol>
    </section>
  `;
}

function renderAuthCard(category) {
  const auth = category.authentication;
  return `
    <section class="auth-card" id="api-${escapeHtml(category.id)}-authentication">
      <h2>Authentication</h2>
      <p>${escapeHtml(auth.summary)}</p>
      <p><span class="badge">${escapeHtml((auth.types || []).join(", ") || "Public")}</span>
         <span class="muted">Public ${auth.publicCount} · Protected ${auth.protectedCount}</span></p>
      ${copyBox(`auth-${category.id}`, "auth headers", auth.copyBlock)}
    </section>
  `;
}

function renderEndpoint(category, operation) {
  const samples = operation.samples || {};
  const requestTabs = [];
  if (samples.header) requestTabs.push({ label: "Header", value: samples.header });
  if (samples.body) requestTabs.push({ label: "Body (JSON)", value: samples.body });
  const sampleId = `${category.id}-${operation.id}`;
  return `
    <article class="endpoint" id="api-${escapeHtml(category.id)}-${escapeHtml(operation.id)}">
      <h2 class="endpoint-title">${escapeHtml(operation.title)}</h2>
      <div class="method-path">
        <span class="${methodClass(operation.method)}">${escapeHtml(operation.method)}</span>
        <code class="path-code">${escapeHtml(operation.path)}</code>
        ${operation.copy?.curl ? `
          <button class="inline-copy" type="button" data-copy-target="curl-${escapeHtml(category.id)}-${escapeHtml(operation.id)}">Copy Curl</button>
          <pre id="curl-${escapeHtml(category.id)}-${escapeHtml(operation.id)}" hidden>${escapeHtml(operation.copy.curl)}</pre>
        ` : ""}
      </div>
      <p class="endpoint-summary">${escapeHtml(operation.summary)}</p>
      ${renderTabs(`req-${sampleId}`, requestTabs)}
      ${schemaTable("URI Parameter", parameterFields(operation.parameters.path))}
      ${schemaTable("Query Parameter", parameterFields(operation.parameters.query))}
      ${schemaTable("Request Body", operation.body?.fields)}
      ${schemaTable("Body Response", operation.responseFields)}
      ${renderTabs(`ok-${sampleId}`, samples.success || [])}
      ${renderTabs(`err-${sampleId}`, samples.errors || [])}
    </article>
  `;
}

function renderCategory(category) {
  return `
    <section>
      <h1 class="category-title">${escapeHtml(category.name)}</h1>
      ${renderAuthCard(category)}
      ${category.operations.map((operation) => renderEndpoint(category, operation)).join("")}
    </section>
  `;
}

function matchesQuery(text, query) {
  return String(text || "").toLowerCase().includes(query);
}

function filterCatalog(catalog, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return catalog.categories;
  return catalog.categories.map((category) => {
    const categoryHit = matchesQuery(category.name, needle);
    const operations = category.operations.filter((operation) =>
      categoryHit ||
      matchesQuery(operation.title, needle) ||
      matchesQuery(operation.path, needle) ||
      matchesQuery(operation.method, needle)
    );
    return operations.length || categoryHit ? { ...category, operations: categoryHit ? category.operations : operations } : null;
  }).filter(Boolean);
}

function hashFor(appId, suffix) {
  return `#app/${appId}/${suffix}`;
}

function renderSidenav(filtered, route) {
  const appId = route.app?.id || DEFAULT_APP_ID;
  const homeActive = route.type === "home" ? "active" : "";
  const items = filtered.map((category) => {
    const authActive = route.categoryId === category.id && (route.focus === "authentication" || !route.operationId) ? "active" : "";
    return `
      <div class="nav-category" data-category="${escapeHtml(category.id)}">
        <a class="nav-category-toggle" href="${hashFor(appId, `api-${escapeHtml(category.id)}-authentication`)}">${escapeHtml(category.name)}</a>
        <div class="nav-children">
          <a class="nav-link nav-auth ${authActive}" href="${hashFor(appId, `api-${escapeHtml(category.id)}-authentication`)}">Authentication</a>
          ${category.operations.map((operation) => {
            const active = route.categoryId === category.id && route.operationId === operation.id ? "active" : "";
            return `<a class="nav-link ${active}" href="${hashFor(appId, `api-${escapeHtml(category.id)}-${escapeHtml(operation.id)}`)}"><span class="${methodClass(operation.method)}">${escapeHtml(operation.method)}</span><span class="nav-title">${escapeHtml(operation.title)}</span></a>`;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");
  return `
    <a class="nav-home nav-apps" href="#apps">All applications</a>
    <a class="nav-home ${homeActive}" href="#app/${escapeHtml(appId)}">Overview</a>
    ${items || `<p class="nav-empty">No matching endpoints.</p>`}
  `;
}

function parseHashParts() {
  const hash = decodeURIComponent((location.hash || "").replace(/^#/, ""));
  if (!hash || hash === "apps") return { type: "apps" };
  if (hash.startsWith("app/")) {
    const rest = hash.slice(4);
    const slash = rest.indexOf("/");
    const appId = slash === -1 ? rest : rest.slice(0, slash);
    const inner = slash === -1 ? "" : rest.slice(slash + 1);
    const app = findApp(appId);
    if (!app) return { type: "apps" };
    if (!app.hasCatalog) return { type: "placeholder", app };
    return { type: "inner", app, inner };
  }
  if (hash === "getting-started" || hash.startsWith("api-")) {
    return { type: "inner", app: findApp(DEFAULT_APP_ID), inner: hash };
  }
  return { type: "apps" };
}

function parseRoute(catalog) {
  const parts = parseHashParts();
  if (parts.type !== "inner") return parts;
  const { app, inner } = parts;
  if (!inner || inner === "getting-started") return { type: "home", app };
  if (!inner.startsWith("api-")) return { type: "home", app };
  const rest = inner.slice(4);
  const categories = [...(catalog?.categories || [])].sort((left, right) => right.id.length - left.id.length);
  for (const category of categories) {
    if (rest === category.id || rest === `${category.id}-authentication`) {
      return { type: "category", app, categoryId: category.id, focus: "authentication" };
    }
    const prefix = `${category.id}-`;
    if (rest.startsWith(prefix)) {
      return { type: "category", app, categoryId: category.id, operationId: rest.slice(prefix.length) };
    }
  }
  return { type: "home", app };
}

function focusIdFromHash() {
  const hash = decodeURIComponent((location.hash || "").replace(/^#/, ""));
  if (hash.startsWith("app/")) {
    const slash = hash.indexOf("/", 4);
    return slash === -1 ? "getting-started" : hash.slice(slash + 1);
  }
  return hash || "getting-started";
}

function catalogUrlFor(appId) {
  const base = config.basePath || "";
  const urls = [`${base}/docs/apps/${encodeURIComponent(appId)}/catalog.json`];
  if (appId === DEFAULT_APP_ID && config.catalogUrl) {
    urls.push(config.catalogUrl);
  }
  return urls;
}

function closeMobileNav() {
  document.body.classList.remove("nav-open");
  const toggle = document.querySelector(".nav-toggle");
  const backdrop = document.querySelector(".sidebar-backdrop");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
  if (backdrop) backdrop.hidden = true;
}

async function copyFromButton(button) {
  const original = button.textContent;
  const targetId = button.getAttribute("data-copy-target");
  const value = targetId
    ? document.getElementById(targetId)?.textContent || ""
    : button.getAttribute("data-copy") || "";
  try {
    await copyText(value);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy failed";
  }
  window.setTimeout(() => {
    button.textContent = original;
  }, 1600);
}

function bindCopyButtons(root) {
  root.querySelectorAll("[data-copy], [data-copy-target]").forEach((button) => {
    button.addEventListener("click", () => copyFromButton(button));
  });
}

function bindTabs(root) {
  root.querySelectorAll("[data-tabs]").forEach((group) => {
    const tabs = [...group.querySelectorAll("[role='tab']")];
    const panels = [...group.querySelectorAll("[role='tabpanel']")];
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => {
        tabs.forEach((item, itemIndex) => {
          const selected = itemIndex === index;
          item.classList.toggle("active", selected);
          item.setAttribute("aria-selected", String(selected));
        });
        panels.forEach((panel, panelIndex) => {
          const selected = panelIndex === index;
          panel.classList.toggle("active", selected);
          panel.hidden = !selected;
        });
      });
    });
  });
}

async function main() {
  const content = document.getElementById("content");
  const sidenav = document.getElementById("sidenav");
  const search = document.getElementById("nav-search");
  const toggle = document.querySelector(".nav-toggle");
  const backdrop = document.querySelector(".sidebar-backdrop");
  const catalogs = {};
  let renderSeq = 0;

  function setChrome(route, catalog) {
    const hideSidebar = route.type === "apps" || route.type === "placeholder";
    document.body.classList.toggle("landing-mode", hideSidebar);
    if (toggle) toggle.hidden = hideSidebar;
    const brandTitle = document.getElementById("brand-title");
    if (brandTitle) {
      brandTitle.textContent = route.app?.name || catalog?.info?.title || "Boga API Documentation";
    }
    if (hideSidebar) closeMobileNav();
  }

  async function loadCatalog(appId) {
    if (catalogs[appId]) return catalogs[appId];
    let lastError = null;
    for (const url of catalogUrlFor(appId)) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Could not load catalog");
        catalogs[appId] = await response.json();
        return catalogs[appId];
      } catch (error) {
        lastError = error;
      }
    }
    catalogs[appId] = {
      info: { title: document.title },
      categories: [],
      authTypes: [],
      loadError: lastError?.message || "Could not load catalog"
    };
    return catalogs[appId];
  }

  async function render() {
    const seq = ++renderSeq;
    const query = search.value || "";
    const peek = parseHashParts();
    if (peek.type === "apps" || peek.type === "placeholder") {
      setChrome(peek);
      sidenav.innerHTML = "";
      content.innerHTML = peek.type === "apps" ? renderApps() : renderPlaceholder(peek.app);
      content.scrollTo({ top: 0 });
      return;
    }

    const catalog = await loadCatalog(peek.app?.id || DEFAULT_APP_ID);
    if (seq !== renderSeq) return;
    const route = parseRoute(catalog);
    const filtered = filterCatalog(catalog, query);
    setChrome(route, catalog);
    sidenav.innerHTML = renderSidenav(filtered, route);
    if (catalog.loadError) {
      content.innerHTML = `<p class="error">Could not load the API catalog. ${escapeHtml(catalog.loadError)}</p>`;
    } else if (route.type === "home") {
      content.innerHTML = renderHome(route.app);
    } else {
      const category = catalog.categories.find((item) => item.id === route.categoryId);
      content.innerHTML = category ? renderCategory(category) : renderHome(route.app);
    }
    bindCopyButtons(document);
    bindTabs(document);
    const focusId = route.type === "home" ? "getting-started" : focusIdFromHash();
    const focusNode = document.getElementById(focusId);
    if (focusNode) {
      focusNode.scrollIntoView({ block: "start" });
    } else {
      content.scrollTo({ top: 0 });
    }
    sidenav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => closeMobileNav());
    });
  }

  toggle?.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(open));
    if (backdrop) backdrop.hidden = !open;
  });
  backdrop?.addEventListener("click", closeMobileNav);
  search.addEventListener("input", () => {
    render();
  });
  window.addEventListener("hashchange", () => {
    render();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== search && !document.body.classList.contains("landing-mode")) {
      event.preventDefault();
      search.focus();
    }
  });
  await render();
}

main();
