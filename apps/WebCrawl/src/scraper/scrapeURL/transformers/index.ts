import { Meta } from "..";
import { Document } from "../../../types";
import { extractLinks } from "../lib/extractLinks";
import { extractImages } from "../lib/extractImages";
import { extractMetadata } from "../lib/extractMetadata";
import { hasFormatOfType } from "../../../lib/format-utils";
import { parseMarkdown } from "../../../lib/html-to-markdown";
import { htmlTransform } from "../lib/removeUnwantedElements";

export async function executeTransformers(
  meta: Meta,
  document: Document,
): Promise<Document> {
  const html = document.rawHtml ?? document.html ?? "";

  if (html) {
    try {
      const metadata = await extractMetadata(meta, html);
      document.metadata = { ...document.metadata, ...metadata };
    } catch (error) {
      meta.logger.warn("Failed to extract metadata", { error });
    }
  }

  if (html && hasFormatOfType(meta.options.formats, "markdown")) {
    try {
      if (!document.markdown) {
        const requestId = meta.id || meta.internalOptions.crawlId;
        const cleaned = await htmlTransform(
          html,
          document.metadata.url,
          { ...meta.options, onlyMainContent: true },
        );
        document.markdown = await parseMarkdown(cleaned, {
          logger: meta.logger,
          requestId,
        });
      }
    } catch (error) {
      meta.logger.warn("Failed to extract markdown", { error });
    }
  }

  if (html && hasFormatOfType(meta.options.formats, "html")) {
    document.html = html;
  }

  if (html && hasFormatOfType(meta.options.formats, "links")) {
    try {
      document.links = await extractLinks(html, document.metadata.url);
    } catch (error) {
      meta.logger.warn("Failed to extract links", { error });
    }
  }

  if (html && hasFormatOfType(meta.options.formats, "images")) {
    try {
      document.images = await extractImages(html, document.metadata.url);
    } catch (error) {
      meta.logger.warn("Failed to extract images", { error });
    }
  }

  return document;
}
