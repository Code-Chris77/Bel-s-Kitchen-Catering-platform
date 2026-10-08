/** Cloudflare Worker entry point. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { purgeExpiredData } from "../lib/retention";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Inline scripts/styles are required by the framework's hydration payload.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const PRIVATE_PAGES = ["/admin", "/kitchen", "/track"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isPrivatePage(pathname: string) {
  return PRIVATE_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}

/** Reject cross-site state-changing API calls (defence in depth on top of SameSite cookies). */
function isCrossSiteWrite(request: Request, url: URL) {
  if (SAFE_METHODS.has(request.method) || !url.pathname.startsWith("/api/")) return false;
  const origin = request.headers.get("origin");
  return origin !== null && origin !== url.origin;
}

function withSecurityHeaders(request: Request, url: URL, response: Response) {
  const secured = new Response(response.body, response);
  const headers = secured.headers;

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if ((headers.get("content-type") ?? "").includes("text/html")) {
    headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  }
  if (url.pathname.startsWith("/api/")) {
    headers.set("Cache-Control", "no-store");
  }
  if (isPrivatePage(url.pathname)) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("Cache-Control", "no-store");
  }
  return secured;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (isCrossSiteWrite(request, url)) {
      return Response.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const imageResponse = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format: format as ImageOutputOptions["format"], quality });
          return result.response();
        },
      }, allowedWidths);
      return withSecurityHeaders(request, url, imageResponse);
    }

    return withSecurityHeaders(request, url, await handler.fetch(request, env, ctx));
  },

  /** Daily cron (see wrangler.jsonc): anonymise old customer details, clear stale rate-limit rows. */
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      purgeExpiredData(env.DB).then((result) =>
        console.log(JSON.stringify({ event: "retention_purge", ...result })),
      ),
    );
  },
};

export default worker;
