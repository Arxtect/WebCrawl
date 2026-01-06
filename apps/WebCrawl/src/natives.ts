import path from "node:path";
import { config } from "./config";

const libExtension =
  process.platform === "win32"
    ? "dll"
    : process.platform === "darwin"
      ? "dylib"
      : "so";

export const HTML_TO_MARKDOWN_PATH =
  config.HTML_TO_MARKDOWN_PATH ??
  path.join(
    process.cwd(),
    "native",
    "html-to-markdown",
    `libhtml_to_md.${libExtension}`,
  );
