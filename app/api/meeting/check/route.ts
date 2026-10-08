import { checkMeetingUrl } from "@/lib/videos";
import { jsonError, jsonOk } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

/**
 * Can this meeting page be shown inside our page (iframe)?
 *
 * Browsers silently refuse to show a page in an iframe when the page sends
 * `X-Frame-Options` or a `Content-Security-Policy: frame-ancestors` rule that
 * doesn't include us, and a web page can't detect that refusal from the outside.
 * So our server fetches the meeting link (only Teams / Meet / Zoom hosts) and
 * reads those headers. The answer:
 *   embeddable: true   → nothing forbids framing; we try the in-page view
 *   embeddable: false  → the service forbids it; we show the honest fallback
 *   embeddable: null   → couldn't check; we try, with a visible fallback
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const check = checkMeetingUrl(searchParams.get("url") ?? "");
  if (!check.ok) return jsonError(check.reason);

  const ourOrigin = new URL(req.url).origin;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    let url = check.url;
    let res: Response | null = null;
    // Follow redirects ourselves (max 5) so every hop stays on an allowed host.
    for (let hop = 0; hop < 5; hop++) {
      res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      const verdict = framingVerdict(res.headers, ourOrigin);
      if (verdict === false) {
        return jsonOk({ embeddable: false, service: check.service, reason: "The meeting service blocks embedding." });
      }
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        const next = new URL(loc, url).toString();
        const nextCheck = checkMeetingUrl(next);
        // Redirect to a sign-in or other site: those never allow framing.
        if (!nextCheck.ok) {
          return jsonOk({ embeddable: false, service: check.service, reason: "The meeting redirects to a sign-in page." });
        }
        url = nextCheck.url;
        continue;
      }
      break;
    }
    return jsonOk({ embeddable: res && res.ok ? true : null, service: check.service });
  } catch {
    return jsonOk({ embeddable: null, service: check.service });
  } finally {
    clearTimeout(timer);
  }
}

/** false = framing forbidden, null = no rule found. */
function framingVerdict(headers: Headers, ourOrigin: string): false | null {
  if (headers.get("x-frame-options")) return false; // DENY / SAMEORIGIN (ALLOW-FROM is ignored by browsers)
  const csp = headers.get("content-security-policy");
  if (csp) {
    const directive = csp
      .split(/[;,]/)
      .map((d) => d.trim())
      .find((d) => d.toLowerCase().startsWith("frame-ancestors"));
    if (directive) {
      const sources = directive.split(/\s+/).slice(1);
      const allowed = sources.some((s) => s === "*" || s === ourOrigin || s === new URL(ourOrigin).host);
      if (!allowed) return false;
    }
  }
  return null;
}
