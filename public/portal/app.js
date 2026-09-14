const config = window.DOCS_CONFIG || { catalogUrl: "./catalog.json" };
const THEME_KEY = "boga-docs-theme";
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
    hasCatalog: false
  },
  {
    id: "budgeting",
    name: "Budgeting API",
    description: "Budget planning and financial-control APIs. Manage allocations, approvals, and reporting.",
    accent: "teal",
    hasCatalog: false
  },
  {
    id: "sync-process",
    name: "Sync Process API",
    description: "Synchronization APIs between Boga systems, partners, and downstream services.",
    accent: "sand",
    hasCatalog: false
  }
];

function getApps() {
  return Array.isArray(config.apps) && config.apps.length ? config.apps : FALLBACK_APPS;
}

function findApp(appId) {
  return getApps().find((app) => app.id === appId) || null;
}

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function syncThemeToggle() {
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  const dark = currentTheme() === "dark";
  button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  button.textContent = dark ? "Light mode" : "Dark mode";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore private-mode storage failures.
  }
  syncThemeToggle();
}

function bindThemeToggle() {
  syncThemeToggle();
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function copyText(text) {
  return navigator.clipboard.writeText(text);
}

function methodClass(method) {
  return `method ${escapeHtml(method)}`;
}

function parameterRows(parameters) {
  if (!parameters?.length) return "";
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Example</th><th>Description</th></tr>
        </thead>
        <tbody>
          ${parameters.map((parameter) => `
            <tr>
              <td><code>${escapeHtml(parameter.name)}</code></td>
              <td>${escapeHtml(parameter.schema?.format || parameter.schema?.type || "string")}</td>
              <td><span class="badge ${parameter.required ? "required" : "optional"}">${parameter.required ? "Yes" : "No"}</span></td>
              <td><code>${escapeHtml(parameter.example ?? "")}</code></td>
              <td>${escapeHtml(parameter.description || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
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

function renderHome(catalog, app) {
  return `
    <section class="hero" id="getting-started">
      <p class="crumb"><a href="#apps">Applications</a> / ${escapeHtml(app?.name || "Boga APP API")}</p>
      <h1>Getting Started</h1>
      <p class="lead">This portal is for developers, System Analysts, and Support. You are viewing <strong>${escapeHtml(app?.name || "Boga APP API")}</strong>. Use the left sidebar to jump by category. Each category starts with Authentication so you can see what to send before you test an endpoint.</p>
      <h2 class="section-title">How To Test An API</h2>
      <ol class="steps">
        <li>Select a category from the sidebar.</li>
        <li>Read <strong>Authentication</strong> at the top of that category.</li>
        <li>Open the endpoint and use <strong>Copy everything</strong>.</li>
        <li>Replace placeholders such as <code>&lt;access_token&gt;</code> and sample values.</li>
        <li>Paste into Postman, curl, or PowerShell. Never use production secrets or customer personal data.</li>
      </ol>
      <p class="note"><code>{baseUrl}</code> is the API host you are testing, for example <code>https://staging.example.internal</code>.</p>
      <h2 class="section-title">Authentication Types Used In This API</h2>
      <div class="auth-type-grid">
        ${catalog.authTypes.map((type) => `
          <article class="auth-type-card">
            <h3>${escapeHtml(type.title)}</h3>
            <p>${escapeHtml(type.summary)}</p>
            <p class="muted">${type.count} endpoint${type.count === 1 ? "" : "s"}</p>
            ${copyBox(`auth-type-${type.id}`, "headers", type.copyExample)}
          </article>
        `).join("")}
      </div>
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
  const copy = operation.copy || {};
  const extra = [];
  if (copy.curl) extra.push({ label: "Copy curl", value: copy.curl });
  if (copy.powershell) extra.push({ label: "Copy PowerShell", value: copy.powershell });
  if (operation.body?.example != null) {
    const bodyText = typeof operation.body.example === "string"
      ? operation.body.example
      : JSON.stringify(operation.body.example, null, 2);
    extra.push({ label: "Copy body", value: bodyText });
  }
  return `
    <article class="endpoint" id="api-${escapeHtml(category.id)}-${escapeHtml(operation.id)}">
      <h2 class="endpoint-title">${escapeHtml(operation.title)}</h2>
      <div class="method-path">
        <span class="${methodClass(operation.method)}">${escapeHtml(operation.method)}</span>
        <code class="path-code">${escapeHtml(operation.path)}</code>
        <button class="inline-copy" type="button" data-copy="${escapeHtml(operation.path)}">Copy URL</button>
      </div>
      <p>${escapeHtml(operation.summary)}</p>
      <p><strong>Who this is for:</strong> ${escapeHtml(operation.audience || "Application, System Analysts, and Support")}</p>
      <p><strong>Authentication:</strong> ${escapeHtml(operation.auth?.summary || "See category authentication.")}</p>
      ${copyBox(`copy-${category.id}-${operation.id}`, "everything", copy.all, extra)}
      ${operation.auth?.headers?.length ? `<h3 class="section-title">Headers To Send</h3>${parameterRows(operation.auth.headers.map((header) => ({
        name: header.name,
        required: true,
        schema: { type: "string" },
        example: header.example,
        description: header.note || "Replace the placeholder with the real value."
      })))}` : ""}
      ${operation.parameters.path.length ? `<h3 class="section-title">Path Parameters</h3>${parameterRows(operation.parameters.path)}` : ""}
      ${operation.parameters.query.length ? `<h3 class="section-title">Query Parameters</h3>${parameterRows(operation.parameters.query)}` : ""}
      ${operation.parameters.header.length ? `<h3 class="section-title">Other Headers</h3>${parameterRows(operation.parameters.header)}` : ""}
      ${operation.body ? `
        <h3 class="section-title">Request Body <span class="muted">${escapeHtml(operation.body.contentType || "")}</span></h3>
        ${operation.body.note ? `<p class="note">${escapeHtml(operation.body.note)}</p>` : ""}
        ${copyBox(
          `body-${category.id}-${operation.id}`,
          "JSON",
          typeof operation.body.example === "string" ? operation.body.example : JSON.stringify(operation.body.example, null, 2)
        )}
      ` : ""}
      ${operation.validation?.length ? `<h3 class="section-title">Validation</h3><ul>${operation.validation.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      <h3 class="section-title">Responses</h3>
      ${operation.responses.map((response) => `
        <div class="response ${response.kind}">
          <div class="response-label">${response.kind === "success" ? "Success" : "Error"} ${escapeHtml(response.code)}</div>
          <p>${escapeHtml(response.description)}</p>
          ${response.example ? `<pre>${escapeHtml(typeof response.example === "string" ? response.example : JSON.stringify(response.example, null, 2))}</pre>` : ""}
        </div>
      `).join("")}
      ${operation.errorMessages?.length ? `<p class="note"><strong>Known error messages:</strong> ${escapeHtml(operation.errorMessages.join("; "))}</p>` : ""}
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

function renderSidenav(filtered, route) {
  const homeActive = route.type === "home" ? "active" : "";
  const items = filtered.map((category) => {
    const authActive = route.categoryId === category.id && (route.focus === "authentication" || !route.operationId) ? "active" : "";
    return `
      <div class="nav-category" data-category="${escapeHtml(category.id)}">
        <a class="nav-category-toggle" href="#api-${escapeHtml(category.id)}-authentication">${escapeHtml(category.name)}</a>
        <div class="nav-children">
          <a class="nav-link nav-auth ${authActive}" href="#api-${escapeHtml(category.id)}-authentication">Authentication</a>
          ${category.operations.map((operation) => {
            const active = route.categoryId === category.id && route.operationId === operation.id ? "active" : "";
            return `<a class="nav-link ${active}" href="#api-${escapeHtml(category.id)}-${escapeHtml(operation.id)}"><span class="${methodClass(operation.method)}">${escapeHtml(operation.method)}</span><span class="nav-title">${escapeHtml(operation.title)}</span></a>`;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");
  return `
    <a class="nav-home nav-apps" href="#apps">All applications</a>
    <a class="nav-home ${homeActive}" href="#app/${DEFAULT_APP_ID}">Overview</a>
    ${items || `<p class="nav-empty">No matching endpoints.</p>`}
  `;
}

function parseRoute(catalog) {
  const hash = decodeURIComponent((location.hash || "").replace(/^#/, ""));
  const defaultApp = findApp(DEFAULT_APP_ID);
  if (!hash || hash === "apps") return { type: "apps" };
  if (hash.startsWith("app/")) {
    const app = findApp(hash.slice(4).split("/")[0]);
    if (!app) return { type: "apps" };
    if (!app.hasCatalog) return { type: "placeholder", app };
    return { type: "home", app };
  }
  if (hash === "getting-started") return { type: "home", app: defaultApp };
  if (!hash.startsWith("api-")) return { type: "apps" };
  const rest = hash.slice(4);
  const categories = [...catalog.categories].sort((left, right) => right.id.length - left.id.length);
  for (const category of categories) {
    if (rest === category.id || rest === `${category.id}-authentication`) {
      return { type: "category", app: defaultApp, categoryId: category.id, focus: "authentication" };
    }
    const prefix = `${category.id}-`;
    if (rest.startsWith(prefix)) {
      return { type: "category", app: defaultApp, categoryId: category.id, operationId: rest.slice(prefix.length) };
    }
  }
  return { type: "home", app: defaultApp };
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

async function main() {
  bindThemeToggle();
  const content = document.getElementById("content");
  const sidenav = document.getElementById("sidenav");
  const search = document.getElementById("nav-search");
  const toggle = document.querySelector(".nav-toggle");
  const backdrop = document.querySelector(".sidebar-backdrop");
  let catalog = { info: { title: document.title }, categories: [], authTypes: [] };

  function setChrome(route) {
    const hideSidebar = route.type === "apps" || route.type === "placeholder";
    document.body.classList.toggle("landing-mode", hideSidebar);
    if (toggle) toggle.hidden = hideSidebar;
    const brandTitle = document.getElementById("brand-title");
    if (brandTitle) {
      brandTitle.textContent = route.app?.name || catalog.info?.title || "Boga API Documentation";
    }
    if (hideSidebar) closeMobileNav();
  }

  function render() {
    const query = search.value || "";
    const route = parseRoute(catalog);
    const filtered = filterCatalog(catalog, query);
    setChrome(route);
    if (route.type === "apps") {
      sidenav.innerHTML = "";
      content.innerHTML = renderApps();
    } else if (route.type === "placeholder") {
      sidenav.innerHTML = "";
      content.innerHTML = renderPlaceholder(route.app);
    } else {
      sidenav.innerHTML = renderSidenav(filtered, route);
      if (catalog.loadError) {
        content.innerHTML = `<p class="error">Could not load the API catalog. ${escapeHtml(catalog.loadError)}</p>`;
      } else if (route.type === "home") {
        content.innerHTML = renderHome(catalog, route.app);
      } else {
        const category = catalog.categories.find((item) => item.id === route.categoryId);
        content.innerHTML = category ? renderCategory(category) : renderHome(catalog, route.app);
      }
    }
    bindCopyButtons(document);
    const hash = location.hash.replace(/^#/, "");
    if (route.type === "apps") {
      content.scrollTo({ top: 0 });
    } else {
      const focusId = !hash || hash.startsWith("app/")
        ? (route.type === "placeholder" ? "app-overview" : "getting-started")
        : hash;
      const focusNode = document.getElementById(focusId);
      if (focusNode) {
        focusNode.scrollIntoView({ block: "start" });
      } else {
        content.scrollTo({ top: 0 });
      }
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
  search.addEventListener("input", render);
  window.addEventListener("hashchange", render);
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== search && !document.body.classList.contains("landing-mode")) {
      event.preventDefault();
      search.focus();
    }
  });
  render();

  try {
    const response = await fetch(config.catalogUrl);
    if (!response.ok) throw new Error("Could not load catalog");
    catalog = await response.json();
  } catch (error) {
    catalog = { ...catalog, loadError: error.message };
  }
  if (parseRoute(catalog).type !== "apps") {
    render();
  }
}

main();
