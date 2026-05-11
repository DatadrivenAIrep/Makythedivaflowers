const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "MakyPrintAgent",
  script: path.join(__dirname, "dist", "index.js"),
});

svc.on("uninstall", () => console.log("MakyPrintAgent service removed."));
svc.uninstall();
