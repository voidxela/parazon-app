import { serve } from "@hono/node-server";
import { getUsersClient, getCacheClient, getVectorDb } from "@parazon/database";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`[api] listening on port ${port.toString()}`);
});

/**
 * Graceful shutdown on SIGTERM (sent by s6-overlay / container orchestrator).
 *
 * server.close() stops accepting new connections but lets in-flight requests
 * finish. Database connections are closed inside its callback — only after all
 * active HTTP handlers have completed — so no query is interrupted mid-flight.
 *
 * getVectorDb().$client is the libsql Database singleton used by the oracle
 * route. getUsersClient() and getCacheClient() are the @libsql/client instances
 * used by the other routes and workers.
 */
process.on("SIGTERM", () => {
  console.log("[api] SIGTERM received — shutting down");

  server.close(() => {
    console.log("[api] HTTP server closed — draining database connections");

    try { getUsersClient().close(); } catch { /* already closed */ }
    try { getCacheClient().close(); } catch { /* already closed */ }
    try { getVectorDb().$client.close(); } catch { /* not yet initialised or already closed */ }

    console.log("[api] shutdown complete");
    process.exit(0);
  });

  // Force exit if in-flight requests don't drain within 10 s
  setTimeout(() => {
    console.error("[api] shutdown timeout — forcing exit");
    process.exit(1);
  }, 10_000).unref();
});
