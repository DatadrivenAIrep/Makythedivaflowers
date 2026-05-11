const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "MakyPrintAgent",
  description: "Polls the Diva Flowers server and prints paid orders.",
  script: path.join(__dirname, "dist", "index.js"),
  nodeOptions: [],
  workingDirectory: __dirname,
});

svc.on("install", () => {
  console.log("Service installed. Starting…");
  svc.start();
});
svc.on("start", () => console.log("MakyPrintAgent service started."));
svc.on("error", (e) => console.error("Service error:", e));

svc.install();
