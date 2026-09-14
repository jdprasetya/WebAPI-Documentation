const apps = [
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
  return apps;
}

function getApp(id) {
  return apps.find((app) => app.id === id) || null;
}

module.exports = {
  apps,
  getApps,
  getApp
};
