const { existsSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const packageRoot = join(__dirname, "..");
const binaryPrefix = "firecrawl-rs";

const hasBinary = readdirSync(packageRoot).some(name => {
  return name.startsWith(binaryPrefix) && name.endsWith(".node");
});

if (hasBinary) {
  console.log("[firecrawl-rs] native binary exists, skipping build");
  process.exit(0);
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCmd, ["run", "build"], {
  cwd: packageRoot,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
