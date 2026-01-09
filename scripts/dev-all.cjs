const concurrently = require("concurrently");

const commands = [
  {
    command: "bun run --cwd apps/WebCrawl dev",
    name: "webcrawl",
    prefixColor: "cyan",
  },
  {
    command: "npm --prefix apps/playwright-service-ts run dev",
    name: "playwright",
    prefixColor: "magenta",
  },
  {
    command: "bun run --cwd apps/lightpanda-test server",
    name: "lightpanda",
    prefixColor: "yellow",
  },
  {
    command: "bun run --cwd apps/webcrawl-demo dev",
    name: "demo",
    prefixColor: "green",
  },
];

const { result } = concurrently(commands, {
  killOthersOn: ["failure"],
  prefix: "name",
});

result.then(
  () => process.exit(0),
  () => process.exit(1),
);
