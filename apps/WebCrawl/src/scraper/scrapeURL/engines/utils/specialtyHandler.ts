import { Logger } from "winston";
import { AddFeatureError } from "../../error";

export async function specialtyScrapeCheck(
  logger: Logger,
  headers: Record<string, string> | undefined,
) {
  const contentType = (Object.entries(headers ?? {}).find(
    x => x[0].toLowerCase() === "content-type",
  ) ?? [])[1];

  if (!contentType) {
    return;
  }

  const documentTypes = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/msword",
    "application/rtf",
    "text/rtf",
    "application/vnd.oasis.opendocument.text",
  ];

  const isDocument = documentTypes.some(type => contentType.startsWith(type));
  const isPdf =
    contentType === "application/pdf" ||
    contentType.startsWith("application/pdf;");

  if (isDocument) {
    logger.info("Detected document content-type, switching engine", {
      contentType,
    });
    throw new AddFeatureError(["document"]);
  }

  if (isPdf) {
    logger.info("Detected PDF content-type, switching engine", {
      contentType,
    });
    throw new AddFeatureError(["pdf"]);
  }
}
