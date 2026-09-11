const app = require("./app");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

app.listen(port, host, () => {
  const basePath = process.env.BASE_PATH || "";
  console.log(`API documentation available at http://localhost:${port}${basePath}/docs/`);
});
