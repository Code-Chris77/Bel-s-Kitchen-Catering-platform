// Secrets configured via `.dev.vars` locally and `wrangler secret put` in
// production. They are not in wrangler.jsonc, so `wrangler types` does not
// know about them.
declare namespace Cloudflare {
  interface Env {
    KITCHEN_PASSWORD?: string;
    KITCHEN_SESSION_SECRET?: string;
    ADMIN_EMAIL?: string;
    ADMIN_PASSWORD?: string;
    ADMIN_SESSION_SECRET?: string;
    /** Keys the order tracking-code hashes. Falls back to KITCHEN_SESSION_SECRET. */
    TRACKING_SECRET?: string;
  }
}
