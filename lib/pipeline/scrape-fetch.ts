import { Agent, fetch as undiciFetch } from "undici";

/**
 * Scrape providers must NOT rely on the swapped `globalThis.fetch` from
 * `tls-dev.ts`: in the Next dev server that global is re-patched per request by
 * the framework, so the insecure dispatcher is frequently lost and requests die
 * with `fetch failed` under antivirus / HTTPS inspection.
 *
 * Instead we call undici directly with our own insecure agent — exactly what the
 * verified `scripts/test-scrapedo.mjs` probe does — so scraping behaves the same
 * in the pipeline as it does in the standalone test.
 */
const insecureAgent =
  process.env.DEV_TLS_INSECURE === "1"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

type ScrapeFetchInit = import("undici").RequestInit & { timeoutMs?: number };

/**
 * Fetch a scrape-provider URL with an explicit undici dispatcher (insecure in
 * dev when DEV_TLS_INSECURE=1) and an AbortController timeout so a hung
 * connection cannot stall the whole profile-escalation loop.
 */
export async function scrapeFetch(
  url: string,
  init?: ScrapeFetchInit
): Promise<Response> {
  const { timeoutMs = 60_000, ...rest } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return (await undiciFetch(url, {
      ...rest,
      signal: controller.signal,
      ...(insecureAgent ? { dispatcher: insecureAgent } : {}),
    })) as unknown as Response;
  } finally {
    clearTimeout(timer);
  }
}
