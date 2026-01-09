import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().default(3002),
  LOGGING_LEVEL: z.string().optional(),

  PROXY_SERVER: z.string().optional(),
  PROXY_USERNAME: z.string().optional(),
  PROXY_PASSWORD: z.string().optional(),
  ALLOW_LOCAL_WEBHOOKS: z.coerce.boolean().optional(),

  PLAYWRIGHT_MICROSERVICE_URL: z.string().optional(),

  EXPOSE_ERROR_STACK: z.coerce.boolean().default(false),
  EXPOSE_ERROR_DETAILS: z.coerce.boolean().default(false),
  FIRECRAWL_DEBUG_FILTER_LINKS: z.coerce.boolean().default(false),
});

export const config = configSchema.parse(process.env);
