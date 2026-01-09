import { getBaseConfig, runPipeline, type PipelineConfig, type PipelineResult } from "./pipeline";

const log = (message: string) => {
  process.stderr.write(`[lightpanda-test] ${message}\n`);
};

const getConfig = (): PipelineConfig => {
  const baseConfig = getBaseConfig();
  return {
    ...baseConfig,
    targetUrl: process.argv[2] || baseConfig.targetUrl,
  };
};

const main = async () => {
  const config = getConfig();
  const start = performance.now();

  log(`Connecting to Lightpanda at ${config.cdpUrl}`);
  log(`Navigating to ${config.targetUrl}`);

  const result: PipelineResult = await runPipeline(config);
  log(`Done in ${Math.round(performance.now() - start)}ms`);
  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    log(`Failed: ${result.error ?? "Unknown error"}`);
    process.exitCode = 1;
  }
};

main();
