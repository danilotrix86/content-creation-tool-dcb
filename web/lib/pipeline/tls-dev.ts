import { Agent, fetch as undiciFetch } from "undici";

declare global {
  var __contentCreatorOriginalFetch: typeof fetch | undefined;
}

let warned = false;

/**
 * When antivirus or SSL inspection replaces certificates, Node's default `fetch` (undici)
 * can still fail with UNABLE_TO_VERIFY_LEAF_SIGNATURE — `NODE_TLS_REJECT_UNAUTHORIZED`
 * does not always apply to undici.
 *
 * With `DEV_TLS_INSECURE=1`, we swap `globalThis.fetch` to undici + an agent that skips
 * verification, and set `NODE_TLS_REJECT_UNAUTHORIZED=0` for libraries that use `https`
 * (e.g. OpenAI). Dev only; do not use in production.
 */
export function applyDevTlsInsecure(): void {
  if (process.env.DEV_TLS_INSECURE !== "1") return;

  if (typeof globalThis.fetch !== "function") return;

  if (globalThis.__contentCreatorOriginalFetch !== undefined) {
    return;
  }

  globalThis.__contentCreatorOriginalFetch = globalThis.fetch.bind(globalThis);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const agent = new Agent({
    connect: { rejectUnauthorized: false },
  });

  globalThis.fetch = function devInsecureFetch(
    input: Parameters<typeof fetch>[0],
    init?: RequestInit
  ): Promise<Response> {
    return undiciFetch(input as Parameters<typeof undiciFetch>[0], {
      ...(init as object),
      dispatcher: agent,
    } as import("undici").RequestInit) as unknown as Promise<Response>;
  };

  if (!warned) {
    warned = true;
    console.warn(
      "[TLS] DEV_TLS_INSECURE=1: using insecure undici TLS + NODE_TLS_REJECT_UNAUTHORIZED=0 (dev only)."
    );
  }
}
