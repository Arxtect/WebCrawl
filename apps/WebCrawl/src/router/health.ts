import type { Elysia } from "elysia";

export function registerHealthRoutes(app: Elysia) {
  return app.get("/health", () => ({ status: "ok" }));
}

