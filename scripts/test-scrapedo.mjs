/**
 * Standalone Scrape.do connectivity + geoCode probe.
 *
 * Usage:
 *   node scripts/test-scrapedo.mjs
 *   node scripts/test-scrapedo.mjs --playground
 *   node scripts/test-scrapedo.mjs --search-country hu
 *   node scripts/test-scrapedo.mjs --url https://lemon.casino/en/ --insecure
 *
 * Reads SCRAPEDO_TOKEN from .env.local (or process.env).
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Agent, fetch as undiciFetch } from "undici";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Mirror lib/pipeline/scrapedo.ts — keep in sync when adding aliases. */
const SCRAPEDO_GEO_ALIASES = { hu: "lt" };

function mapSearchCountryToScrapeDoGeo(searchCountry) {
  const code = searchCountry.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) return undefined;
  return SCRAPEDO_GEO_ALIASES[code] ?? code;
}

function loadEnvLocal() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function parseArgs(argv) {
  const out = {
    targetUrl: "https://lemon.casino/en/",
    geos: ["none", "lt"],
    schemes: ["http"],
    super: false,
    render: false,
    markdown: true,
    insecure: false,
    timeoutMs: 45_000,
    playground: false,
    searchCountry: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url" && argv[i + 1]) out.targetUrl = argv[++i];
    else if (a === "--search-country" && argv[i + 1]) {
      out.searchCountry = argv[++i].trim().toLowerCase();
      const mapped = mapSearchCountryToScrapeDoGeo(out.searchCountry);
      if (mapped) out.geos = [mapped];
    } else if (a === "--geo" && argv[i + 1])
      out.geos = ["none", ...argv[++i].split(",").map((g) => g.trim().toLowerCase())];
    else if (a === "--scheme" && argv[i + 1]) {
      const v = argv[++i].toLowerCase();
      out.schemes = v === "both" ? ["http", "https"] : [v === "https" ? "https" : "http"];
    } else if (a === "--super") out.super = true;
    else if (a === "--render") out.render = true;
    else if (a === "--no-markdown") out.markdown = false;
    else if (a === "--insecure") out.insecure = true;
    else if (a === "--playground") {
      out.playground = true;
      out.schemes = ["http"];
      out.geos = ["lt"];
      out.super = false;
      out.render = false;
      out.markdown = false;
    } else if (a === "--timeout" && argv[i + 1]) out.timeoutMs = Number(argv[++i]) || out.timeoutMs;
    else if (a === "--help" || a === "-h") {
      console.log(`Scrape.do probe

Options:
  --url <url>         Target page (default: https://lemon.casino/en/)
  --search-country <cc>  App mode: map search_country to Scrape.do geo (e.g. hu → lt)
  --geo <list>        geoCode values after baseline "none" (default: none,lt)
  --scheme http|https|both   API scheme (default: http — matches Scrape.do playground)
  --playground        Exact playground replica: http + geoCode=LT, no super, no markdown
  --super             Force residential proxy (super=true)
  --render            Headless render + customWait=3000
  --no-markdown       Omit output=markdown (playground returns HTML)
  --insecure          Skip TLS verification (DEV_TLS_INSECURE behavior)
  --timeout <ms>      Fetch timeout (default: 45000)
`);
      process.exit(0);
    }
  }
  return out;
}

function applyInsecureFetch() {
  if (globalThis.__scrapedoProbeInsecureFetch) return;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn("[TLS] --insecure / DEV_TLS_INSECURE: skipping certificate verification\n");
  const agent = new Agent({ connect: { rejectUnauthorized: false } });
  globalThis.fetch = (input, init) =>
    undiciFetch(input, { ...init, dispatcher: agent });
  globalThis.__scrapedoProbeInsecureFetch = true;
}

function buildApiUrl({ token, targetUrl, geo, superProxy, render, markdown, scheme }) {
  const params = new URLSearchParams({
    token,
    url: targetUrl,
  });
  if (markdown) params.set("output", "markdown");
  if (superProxy) params.set("super", "true");
  if (geo && geo !== "none") params.set("geoCode", geo);
  if (render) {
    params.set("render", "true");
    params.set("customWait", "3000");
  }
  return `${scheme}://api.scrape.do/?${params.toString()}`;
}

function errorDetails(err) {
  const parts = [err?.message ?? String(err)];
  const cause = err?.cause;
  if (cause) {
    if (cause.code) parts.push(`cause.code=${cause.code}`);
    if (cause.errno) parts.push(`cause.errno=${cause.errno}`);
    if (cause.message && cause.message !== err?.message) parts.push(`cause.message=${cause.message}`);
  }
  return parts.join(" | ");
}

function previewBody(text, max = 180) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}… (${text.length} chars total)`;
}

async function probeOne({ token, targetUrl, geo, superProxy, render, markdown, scheme, timeoutMs }) {
  const apiUrl = buildApiUrl({ token, targetUrl, geo, superProxy, render, markdown, scheme });
  const label = [
    scheme,
    geo === "none" ? "no geoCode" : `geoCode=${geo}`,
    superProxy ? "super" : "datacenter",
    render ? "render" : "no-render",
    markdown ? "markdown" : "html",
  ].join(", ");

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(apiUrl, { method: "GET", signal: controller.signal });
    const body = await res.text();
    const ms = Date.now() - started;

    return {
      ok: res.ok,
      label,
      status: res.status,
      ms,
      bodyChars: body.length,
      preview: previewBody(body),
      apiUrl: apiUrl.replace(token, token.slice(0, 6) + "…"),
    };
  } catch (err) {
    const ms = Date.now() - started;
    const isAbort = err?.name === "AbortError";
    return {
      ok: false,
      label,
      status: isAbort ? "TIMEOUT" : "FETCH_ERROR",
      ms,
      error: errorDetails(err),
      apiUrl: apiUrl.replace(token, token.slice(0, 6) + "…"),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv);

  if (process.env.DEV_TLS_INSECURE === "1" || args.insecure) {
    applyInsecureFetch();
  }

  const token = process.env.SCRAPEDO_TOKEN?.trim();

  console.log("=== Scrape.do probe ===\n");
  if (args.playground) console.log("Mode       : playground replica (http + geoCode=lt, no super, html)\n");
  if (args.searchCountry) {
    const mapped = mapSearchCountryToScrapeDoGeo(args.searchCountry);
    console.log(
      `App geo    : search_country=${args.searchCountry} → geoCode=${mapped ?? "(none)"}\n`
    );
  }
  console.log(`Target URL : ${args.targetUrl}`);
  console.log(`Schemes    : ${args.schemes.join(", ")}`);
  console.log(`Geos       : ${args.geos.join(", ")}`);
  console.log(`Profiles   : ${args.super ? "super only" : "datacenter then super per geo"}`);
  console.log(`Output     : ${args.markdown ? "markdown" : "html (playground)"}`);
  console.log(`Timeout    : ${args.timeoutMs}ms\n`);

  if (!token) {
    console.error("Missing SCRAPEDO_TOKEN. Set it in .env.local or the environment.");
    process.exit(1);
  }
  console.log(`Token      : ${token.slice(0, 6)}… (${token.length} chars)\n`);

  try {
    const dns = await import("node:dns/promises");
    const resolved = await dns.lookup("api.scrape.do");
    console.log(`DNS api.scrape.do → ${resolved.address}\n`);
  } catch (e) {
    console.warn(`DNS lookup failed: ${e.message}\n`);
  }

  const profiles = args.playground || args.super
    ? [{ superProxy: args.super, render: args.render }]
    : [
        { superProxy: false, render: false },
        { superProxy: true, render: args.render },
      ];

  const results = [];

  for (const scheme of args.schemes) {
    for (const geo of args.geos) {
      for (const profile of profiles) {
        const result = await probeOne({
          token,
          targetUrl: args.targetUrl,
          geo,
          ...profile,
          markdown: args.markdown,
          scheme,
          timeoutMs: args.timeoutMs,
        });
        results.push(result);

        if (result.ok) {
          console.log(`✓ ${result.label}`);
          console.log(`  HTTP ${result.status} in ${result.ms}ms | ${result.bodyChars} chars`);
          console.log(`  ${result.preview}`);
        } else if (result.status === "FETCH_ERROR" || result.status === "TIMEOUT") {
          console.log(`✗ ${result.label}`);
          console.log(`  ${result.status} in ${result.ms}ms`);
          console.log(`  ${result.error}`);
        } else {
          console.log(`✗ ${result.label}`);
          console.log(`  HTTP ${result.status} in ${result.ms}ms`);
          console.log(`  ${result.preview}`);
        }
        console.log(`  ${result.apiUrl}\n`);
      }
    }
  }

  const anySuccess = results.some((r) => r.ok);
  const allFetchErrors = results.every(
    (r) => r.status === "FETCH_ERROR" || r.status === "TIMEOUT"
  );

  console.log("=== Summary ===");
  if (anySuccess) {
    const winners = results.filter((r) => r.ok);
    console.log(`${winners.length}/${results.length} requests succeeded.`);
    for (const w of winners) {
      console.log(`  OK: ${w.label} → HTTP ${w.status}, ${w.bodyChars} chars`);
    }
  } else if (allFetchErrors) {
    const httpFailed = results.some((r) => r.label.startsWith("http,"));
    const httpsFailed = results.some((r) => r.label.startsWith("https,"));
    console.log("All requests failed at the network layer.");
    if (httpFailed && httpsFailed) {
      console.log("Both http:// and https:// api.scrape.do failed — likely local firewall/AV block.");
    } else if (httpsFailed && !httpFailed) {
      console.log("HTTPS failed; try --scheme http (Scrape.do playground default).");
    }
    console.log("Try: SCRAPEDO_DISABLED=1 locally, or deploy to Vercel where egress is open.");
  } else {
    console.log("Requests reached Scrape.do but returned HTTP errors (check token/credits/params).");
  }

  process.exit(anySuccess ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
